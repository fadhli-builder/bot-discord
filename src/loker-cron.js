const { log } = require('./log');
const { stmt } = require('./db');

// Info loker Indonesia harian jam 09:00 WIB — sumber: Kalibrr (halaman publik,
// data JSON ada di blok __NEXT_DATA__). Hasil riset live 2026-10-13 dari server:
// Glints & Loker.id kebalut Cloudflare (403), API Kemnaker 404, Kalibrr 200 OK.
// Yang dikirim cuma lowongan BARU (dedupe via tabel loker_log di SQLite).
const CHANNEL_ID = process.env.LOKER_CHANNEL_ID;

const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36';
const JUMLAH_KIRIM = 10; // maksimal lowongan baru per pengiriman

// --- Ambil daftar loker Indonesia dari Kalibrr ---
async function ambilLokerKalibrr(page = 1) {
  const url = `https://www.kalibrr.com/home/jobs?country=ids&sort=posted_date&page=${page}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Kalibrr HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Kalibrr: blok data __NEXT_DATA__ tidak ditemukan');
  const data = JSON.parse(m[1]);
  const jobs = data && data.props && data.props.pageProps && data.props.pageProps.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) throw new Error('Kalibrr: daftar loker kosong');
  return jobs;
}

function urlLoker(j) {
  return `https://www.kalibrr.com/c/${(j.company && j.company.code) || j.companyName}/jobs/${j.id}/${j.slug}`;
}

function formatEmbed(jobs) {
  const fields = jobs.map((j) => {
    const kota = (j.googleLocation && j.googleLocation.addressComponents && j.googleLocation.addressComponents.city) || 'Indonesia';
    const tipe = j.tenure || '';
    return {
      name: String(j.name).slice(0, 250),
      value: `**${j.companyName}** • ${kota}${tipe ? ' • ' + tipe : ''}\n[Lihat & Lamar](${urlLoker(j)})`,
      inline: false,
    };
  });
  return {
    color: 0x2ecc71,
    title: 'Info Loker Terbaru dari Indonesia',
    url: 'https://www.kalibrr.com/job-board/c/indonesia',
    description: 'Lowongan kerja terbaru hari ini (sumber: Kalibrr). Semoga berkah buat yang lagi cari rezeki!',
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'KenalBot • rekap otomatis harian' },
  };
}

async function kirimLoker(client) {
  try {
    if (!CHANNEL_ID) throw new Error('LOKER_CHANNEL_ID belum diisi di .env');

    const jobs = await ambilLokerKalibrr(1);
    jobs.sort((a, b) => String(b.activationDate).localeCompare(String(a.activationDate)));

    // bersihin catatan lama (>60 hari) biar tabel gak gendut
    stmt.deleteLokerLama.run();

    const belumTerkirim = jobs.filter((j) => !stmt.getLokerTerkirim.get(String(j.id)));
    // tandai semua yang keambil hari ini, biar gak dikirim dobel besok
    for (const j of jobs) stmt.insertLokerLog.run(String(j.id));

    if (belumTerkirim.length === 0) {
      log('Loker: tidak ada lowongan baru hari ini');
      return true;
    }

    const dipilih = belumTerkirim.slice(0, JUMLAH_KIRIM);
    const ch = await client.channels.fetch(CHANNEL_ID);
    await ch.send({ embeds: [formatEmbed(dipilih)] });
    log(`Loker: ${dipilih.length} lowongan baru terkirim ke #${ch.name ?? CHANNEL_ID}`);
    return true;
  } catch (e) {
    log(`Loker cron error: ${e && e.stack ? e.stack : e}`);
    return false;
  }
}

function msSampaiJam9WIB() {
  const now = new Date(Date.now() + WIB); // geser biar angka UTC = jam dinding WIB
  const target = new Date(now);
  target.setUTCHours(9, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

module.exports = function startLokerCron(client) {
  function jadwalkan() {
    const delay = msSampaiJam9WIB();
    log(`Loker cron aktif: kirim berikutnya ${Math.round(delay / 60000)} menit lagi (jam 09:00 WIB)`);
    setTimeout(async () => {
      await kirimLoker(client);
      jadwalkan(); // pasang ulang timer, biar selalu pas 09:00 WIB
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimLoker = kirimLoker;
