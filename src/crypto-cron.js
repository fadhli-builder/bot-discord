const { log } = require('./log');

// Rekap crypto harian: harga + perubahan 24 jam (USD) dari CoinGecko (gratis,
// tanpa API key — 1 panggilan/hari jauh dari batas rate limit).
const CHANNEL_ID = process.env.CRYPTO_CHANNEL_ID;
const COINS = [
  { id: 'bitcoin', nama: 'Bitcoin', simbol: 'BTC' },
  { id: 'ethereum', nama: 'Ethereum', simbol: 'ETH' },
  { id: 'solana', nama: 'Solana', simbol: 'SOL' },
  { id: 'binancecoin', nama: 'BNB', simbol: 'BNB' },
];
const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)

async function ambilData() {
  const ids = COINS.map((c) => c.id).join(',');
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=' + ids +
    '&vs_currencies=usd&include_24hr_change=true';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  return res.json();
}

function formatEmbed(data) {
  const hariIni = new Date(Date.now() + WIB).toISOString().slice(0, 10);
  const fields = [];
  let naik = 0;
  for (const c of COINS) {
    const d = data[c.id];
    if (!d) continue;
    const ubah = d.usd_24h_change ?? 0;
    if (ubah >= 0) naik++;
    const panah = ubah >= 0 ? '' : '';
    const harga = '$' + d.usd.toLocaleString('en-US', { maximumFractionDigits: 2 });
    fields.push({
      name: `${c.nama} (${c.simbol})`,
      value: `${harga} • ${ubah >= 0 ? '+' : ''}${ubah.toFixed(2)}% /24 jam`,
    });
  }
  // Hijau kalau semua naik, merah kalau semua turun, ungu kalau campur.
  const warna = naik === fields.length ? 0x2ecc71 : naik === 0 ? 0xe74c3c : 0x9b59b6;
  return {
    embeds: [
      {
        title: 'Rekap Crypto Harian',
        description: 'Pergerakan harga 24 jam terakhir (USD).',
        color: warna,
        fields,
        footer: { text: `Sumber: CoinGecko • ${hariIni} 07:00 WIB` },
      },
    ],
  };
}

// Kirim rekap ke channel tujuan. Return true kalau sukses (dipakai script tes).
async function kirimRekap(client) {
  try {
    if (!CHANNEL_ID) throw new Error('CRYPTO_CHANNEL_ID belum diisi di .env');
    let data;
    try {
      data = await ambilData();
    } catch (e) {
      // CoinGecko kadang rewel (429/timeout) — coba sekali lagi setelah 30 detik.
      log(`Crypto: fetch gagal (${e.message}), coba lagi 30 detik`);
      await new Promise((r) => setTimeout(r, 30 * 1000));
      data = await ambilData();
    }
    const ch = await client.channels.fetch(CHANNEL_ID);
    await ch.send(formatEmbed(data));
    log(`Crypto: rekap harian terkirim ke #${ch.name ?? CHANNEL_ID}`);
    return true;
  } catch (e) {
    log(`Crypto cron error: ${e && e.stack ? e.stack : e}`);
    return false;
  }
}

function msSampaiJam7WIB() {
  const now = new Date(Date.now() + WIB); // geser biar angka UTC = jam dinding WIB
  const target = new Date(now);
  target.setUTCHours(7, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

module.exports = function startCryptoCron(client) {
  function jadwalkan() {
    const delay = msSampaiJam7WIB();
    const menit = Math.round(delay / 60000);
    log(`Crypto cron aktif: kirim berikutnya ${menit} menit lagi (jam 07:00 WIB)`);
    setTimeout(async () => {
      await kirimRekap(client);
      jadwalkan(); // pasang ulang timer, biar selalu pas 07:00 WIB
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimRekap = kirimRekap;
