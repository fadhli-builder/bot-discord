const { log } = require('./log');

// Rekap saham harian jam 07:30 WIB — satu channel dengan rekap crypto.
// AS: API publik Nasdaq (resmi, tanpa key). IDX: chart API Yahoo Finance,
// dengan jalur cadangan r.jina.ai karena Yahoo sering memblokir IP server
// ("Edge: Too Many Requests") dan IDX resmi kebalut Cloudflare.
const CHANNEL_ID = process.env.STOCK_CHANNEL_ID || process.env.CRYPTO_CHANNEL_ID;

const SAHAM_AS = [
  { simbol: 'AAPL', nama: 'Apple' },
  { simbol: 'MSFT', nama: 'Microsoft' },
  { simbol: 'NVDA', nama: 'NVIDIA' },
  { simbol: 'GOOGL', nama: 'Alphabet' },
  { simbol: 'AMZN', nama: 'Amazon' },
  { simbol: 'TSLA', nama: 'Tesla' },
];
const SAHAM_IDX = [
  { simbol: 'BBCA.JK', nama: 'Bank BCA' },
  { simbol: 'BBRI.JK', nama: 'Bank BRI' },
  { simbol: 'BMRI.JK', nama: 'Bank Mandiri' },
  { simbol: 'TLKM.JK', nama: 'Telkom' },
  { simbol: 'ASII.JK', nama: 'Astra' },
];

const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36';

// --- Saham AS: satu panggilan per ticker, API resmi Nasdaq ---
async function ambilAS({ simbol }) {
  const url = `https://api.nasdaq.com/api/quote/${simbol}/info?assetclass=stocks`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Nasdaq HTTP ${res.status}`);
  const j = await res.json();
  const d = j && j.data && j.data.primaryData;
  if (!d || !d.lastSalePrice) throw new Error('Nasdaq: data kosong');
  return {
    harga: parseFloat(String(d.lastSalePrice).replace(/[^0-9.]/g, '')),
    ubah: parseFloat(d.netChange) || 0,
    persen: parseFloat(String(d.percentageChange).replace('%', '')) || 0,
  };
}

// Yahoo sukses kadang dibungkus teks markdown (via jina) — ambil JSON-nya aja.
function parseYahoo(text, simbol) {
  const awal = text.indexOf('{"chart"');
  if (awal === -1) throw new Error(`Yahoo ${simbol}: JSON tidak ditemukan`);
  const j = JSON.parse(text.slice(awal));
  const meta = j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!meta || !meta.regularMarketPrice) throw new Error(`Yahoo ${simbol}: meta kosong`);
  const harga = meta.regularMarketPrice;
  const persen = meta.regularMarketChangePercent ?? 0;
  const tutup = meta.chartPreviousClose ?? meta.previousClose;
  const ubah = tutup ? harga - tutup : (harga * persen) / 100;
  return { harga, ubah, persen };
}

// --- Saham IDX: Yahoo, jalur 1 langsung, jalur 2 lewat r.jina.ai (2x percobaan) ---
async function ambilIDX({ simbol }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${simbol}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return parseYahoo(await res.text(), simbol);
  } catch (_) { /* lanjut jalur cadangan */ }
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch('https://r.jina.ai/' + encodeURIComponent(url), {
        signal: AbortSignal.timeout(40_000),
      });
      if (res.ok) return parseYahoo(await res.text(), simbol);
    } catch (_) {
      await tidur(2000);
    }
  }
  throw new Error(`Yahoo ${simbol}: semua jalur gagal`);
}

function baris(persen, hargaStr) {
  const panah = persen >= 0 ? '' : '';
  const tanda = persen >= 0 ? '+' : '';
  return `${hargaStr} • ${tanda}${persen.toFixed(2)}% /hari`;
}

function formatEmbed(hasilAS, hasilIDX) {
  const hariIni = new Date(Date.now() + WIB).toISOString().slice(0, 10);
  const fields = [];
  const semuaPersen = [];

  fields.push({ name: 'Saham AS (penutupan terakhir)', value: '\u200b' });
  for (const s of SAHAM_AS) {
    const d = hasilAS[s.simbol];
    if (!d) {
      fields.push({ name: `${s.nama} (${s.simbol})`, value: 'data gagal diambil', inline: true });
      continue;
    }
    semuaPersen.push(d.persen);
    fields.push({
      name: `${s.nama} (${s.simbol})`,
      value: baris(d.persen, '$' + d.harga.toLocaleString('en-US', { maximumFractionDigits: 2 })),
      inline: true,
    });
  }

  fields.push({ name: 'Saham Indonesia (penutupan kemarin)', value: '\u200b' });
  let idxGagal = 0;
  for (const s of SAHAM_IDX) {
    const d = hasilIDX[s.simbol];
    const kode = s.simbol.replace('.JK', '');
    if (!d) {
      idxGagal++;
      fields.push({ name: `${s.nama} (${kode})`, value: 'data gagal diambil', inline: true });
      continue;
    }
    semuaPersen.push(d.persen);
    fields.push({
      name: `${s.nama} (${kode})`,
      value: baris(d.persen, 'Rp ' + d.harga.toLocaleString('id-ID')),
      inline: true,
    });
  }

  // Hijau kalau semua naik, merah kalau semua turun, ungu kalau campur.
  const naik = semuaPersen.filter((p) => p >= 0).length;
  const warna =
    semuaPersen.length === 0 ? 0x9b59b6
      : naik === semuaPersen.length ? 0x2ecc71
        : naik === 0 ? 0xe74c3c
          : 0x9b59b6;

  let desc = 'Rekap harian: AS = penutupan semalam, IDX = penutupan kemarin.';
  if (idxGagal > 0) desc += `\n${idxGagal} saham IDX gagal diambil (sumber non-resmi sesekali rewel).`;

  return {
    embeds: [
      {
        title: 'Rekap Saham Harian',
        description: desc,
        color: warna,
        fields,
        footer: { text: `Sumber: Nasdaq (AS) • Yahoo Finance (IDX) • ${hariIni} 07:30 WIB` },
      },
    ],
  };
}

// Kirim rekap saham ke channel tujuan. Return true kalau sukses (dipakai script tes).
async function kirimRekap(client) {
  try {
    if (!CHANNEL_ID) throw new Error('STOCK_CHANNEL_ID belum diisi di .env');

    // Ambil data satu-per-one (bukan paralel) biar sopan ke sumber data.
    const hasilAS = {};
    for (const s of SAHAM_AS) {
      try {
        hasilAS[s.simbol] = await ambilAS(s);
      } catch (e) {
        log(`Stock: ${s.simbol} gagal (${e.message})`);
      }
      await tidur(400);
    }

    const hasilIDX = {};
    for (const s of SAHAM_IDX) {
      try {
        hasilIDX[s.simbol] = await ambilIDX(s);
      } catch (e) {
        log(`Stock: ${s.simbol} gagal (${e.message})`);
      }
      await tidur(1500);
    }

    if (Object.keys(hasilAS).length === 0 && Object.keys(hasilIDX).length === 0) {
      throw new Error('semua sumber data gagal, rekap dibatalkan');
    }

    const ch = await client.channels.fetch(CHANNEL_ID);
    await ch.send(formatEmbed(hasilAS, hasilIDX));
    log(`Stock: rekap harian terkirim ke #${ch.name ?? CHANNEL_ID}`);
    return true;
  } catch (e) {
    log(`Stock cron error: ${e && e.stack ? e.stack : e}`);
    return false;
  }
}

function msSampaiJam730WIB() {
  const now = new Date(Date.now() + WIB); // geser biar angka UTC = jam dinding WIB
  const target = new Date(now);
  target.setUTCHours(7, 30, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

module.exports = function startStockCron(client) {
  function jadwalkan() {
    const delay = msSampaiJam730WIB();
    const menit = Math.round(delay / 60000);
    log(`Stock cron aktif: kirim berikutnya ${menit} menit lagi (jam 07:30 WIB)`);
    setTimeout(async () => {
      await kirimRekap(client);
      jadwalkan(); // pasang ulang timer, biar selalu pas 07:30 WIB
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimRekap = kirimRekap;
