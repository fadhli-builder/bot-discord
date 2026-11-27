const { log } = require('./log');

// One Day One Hadith: kirim 1 konten terkurasi tiap pagi ke channel Discord.
// Sumber konten: src/hadist-bank.js (bank statis terkurasi — Shahihain +
// hadits dishahihkan Al-Albani + pepatah sahabat berlabel jelas).
// Jadwal: JAM_KIRIM WIB tiap hari. Urutan konten: acak SEKALI dengan seed
// tetap (deterministik, sama tiap restart), muter melingkar per hari —
// tanpa DB, tanpa dedupe (satu timer = satu kirim per hari).

const BANK = require('./hadist-bank');
const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const JAM_KIRIM = 6; // 06:00 WIB

// Acak sekali dengan seed tetap — urutan campur (hadis/doa/pepatah) tapi
// selalu sama urutannya walau bot direstart, dan gak ada ulangan dalam 1 putaran.
function acakDeterministik(arr) {
  let seed = 20261106;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const BANK_ACAK = acakDeterministik(BANK);

function tanggalWIB(offsetHari = 0) {
  return new Date(Date.now() + WIB + offsetHari * 864e5).toISOString().slice(0, 10);
}

// Konten hari ini: indeks stabil dari tanggal WIB (muter melingkar per bank)
function kontenHariIni(tanggal = tanggalWIB()) {
  const hari = Math.round(Date.parse(tanggal + 'T00:00:00Z') / 864e5);
  const idx = ((hari % BANK_ACAK.length) + BANK_ACAK.length) % BANK_ACAK.length;
  return BANK_ACAK[idx];
}

function embedUntuk(item, tanggal) {
  const judul =
    item.jenis === 'atsar' ? 'One Day One Wisdom — Pepatah Sahabat'
    : item.jenis === 'dua' ? 'One Day One Dzikir'
    : 'One Day One Hadith';
  const deskripsi = [
    item.arab || null,
    item.terjemah ? `*${item.terjemah}*` : null,
  ].filter(Boolean).join('\n\n');
  const footer = item.jenis === 'atsar'
    ? `${item.sumber} • bukan hadits — ucapan sahabat • ${tanggal}`
    : `${item.sumber} • ${tanggal}`;
  return {
    embeds: [{
      title: judul,
      description: deskripsi,
      color: 0x1b5e20,
      footer: { text: footer },
    }],
  };
}

// Kirim konten hari ini ke channel tujuan. Return { status, pesan } (dipakai script tes).
async function kirimHadist(client, tanggal = tanggalWIB()) {
  try {
    const kanalId = process.env.HADIST_CHANNEL_ID;
    if (!kanalId) throw new Error('HADIST_CHANNEL_ID belum diisi di .env');
    const ch = await client.channels.fetch(kanalId);
    await ch.send(embedUntuk(kontenHariIni(tanggal), tanggal));
    log(`Hadist: konten pagi ${tanggal} terkirim ke channel`);
    return { status: 'terkirim', pesan: `konten pagi ${tanggal} terkirim` };
  } catch (e) {
    log(`Hadist cron error: ${e && e.stack ? e.stack : e}`);
    return { status: 'gagal', pesan: e && e.message ? e.message : String(e) };
  }
}

function msSampaiJamKirim() {
  const now = new Date(Date.now() + WIB);
  const target = new Date(now);
  target.setUTCHours(JAM_KIRIM, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

module.exports = function startHadistCron(client) {
  if (!process.env.HADIST_CHANNEL_ID) {
    log('Hadist cron NONAKTIF: HADIST_CHANNEL_ID belum diisi di .env');
    return;
  }
  function jadwalkan() {
    const delay = msSampaiJamKirim();
    log(`Hadist cron aktif: kirim berikutnya ${Math.round(delay / 60000)} menit lagi (jam ${JAM_KIRIM}:00 WIB)`);
    setTimeout(async () => {
      await kirimHadist(client);
      jadwalkan(); // pasang ulang timer biar selalu pas jam kirim
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimHadist = kirimHadist;
module.exports.kontenHariIni = kontenHariIni;
module.exports.embedUntuk = embedUntuk;
module.exports.BANK_ACAK = BANK_ACAK;
