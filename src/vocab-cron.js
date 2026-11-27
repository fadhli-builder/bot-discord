const { log } = require('./log');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { stmt, hariIniWIB } = require('./db');
const BANK = require('./vocab-bank');

// Kuis kosa kata harian: 2 soal pilihan ganda kirim tiap 07:00 WIB.
// Soal dibangun deterministic dari (tanggal, kata) via seeded PRNG —
// pilihan & posisi jawaban selalu sama walau bot restart, jadi tombol
// soal pagi tetap valid seharian tanpa perlu simpan state di memori.

const CHANNEL_ID = process.env.VOCAB_CHANNEL_ID;
const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const JAM_KIRIM = 7; // 07:00 WIB
const JUMLAH_SOAL = 2;
const WARNA = 0x2e7d32; // hijau emerald

// ===== PRNG deterministic (mulberry32 + FNV-1a hash) =====
function hashStr(s) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pilih n kata acak yang belum ditanyakan 14 hari terakhir
function pilihKata(n) {
  const batas = tanggalWIB(-14);
  const pernah = new Set(stmt.getVocabSejak.all(batas).map((r) => r.word));
  const kandidat = BANK.filter((w) => !pernah.has(w.kata));
  const pool = kandidat.length >= n ? kandidat : BANK.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function tanggalWIB(offsetHari = 0) {
  return new Date(Date.now() + WIB + offsetHari * 864e5).toISOString().slice(0, 10);
}

// Soal deterministic: urutan pengecoh & posisi jawaban benar sama selalu untuk
// pasangan (tanggal, kata) yang sama.
function buatSoal(kata, tanggal) {
  const w = BANK.find((x) => x.kata === kata);
  if (!w) return null;
  const rnd = mulberry32(hashStr(tanggal + ':' + kata));
  const base = BANK.slice().sort((a, b) => a.kata.localeCompare(b.kata));
  const pool = base.filter((x) => x.kata !== kata);
  const pengecoh = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rnd() * pool.length);
    pengecoh.push(pool.splice(idx, 1)[0].arti);
  }
  const pilihan = [w.arti, ...pengecoh];
  for (let i = pilihan.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pilihan[i], pilihan[j]] = [pilihan[j], pilihan[i]];
  }
  return {
    kata: w.kata,
    jenis: w.jenis,
    contoh: w.contoh,
    terjemah: w.terjemah,
    pilihan,
    benarIdx: pilihan.indexOf(w.arti),
    tanggal,
  };
}

function barisTombol(soal, nomorSoal) {
  const qid = `${soal.tanggal}:${soal.kata}`;
  const row = new ActionRowBuilder();
  soal.pilihan.forEach((p, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`vocab:jawab:${qid}:${i}`)
        .setLabel(p.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
    );
  });
  return [row];
}

// Kirim kuis ke channel tujuan. Return true kalau sukses (dipakai script tes).
async function kirimVocab(client) {
  try {
    if (!CHANNEL_ID) throw new Error('VOCAB_CHANNEL_ID belum diisi di .env');
    const tanggal = hariIniWIB();
    const kata2 = pilihKata(JUMLAH_SOAL);
    const ch = await client.channels.fetch(CHANNEL_ID);

    const intro = {
      embeds: [
        {
          title: 'Kuis Kosa Kata Harian',
          description:
            `Selamat pagi! Siapkan ${JUMLAH_SOAL} soal buat hari ini.\n` +
            'Klik pilihanmu di tombol bawah — jawaban & pembahasannya langsung keluar.',
          color: WARNA,
          footer: { text: `Level: menengah • ${tanggal} • skor mingguan: /vocab` },
        },
      ],
    };
    await ch.send(intro);

    for (let i = 0; i < kata2.length; i++) {
      const soal = buatSoal(kata2[i].kata, tanggal);
      if (!soal) continue;
      stmt.insertVocabLog.run(soal.kata, tanggal);
      await ch.send({
        embeds: [
          {
            title: `Soal ${i + 1}/${kata2.length} — apa arti dari “${soal.kata}”?`,
            description: `*(${soal.jenis})*`,
            color: WARNA,
            footer: { text: 'Jawab lewat tombol — cuma bisa jawab sekali!' },
          },
        ],
        components: barisTombol(soal),
      });
      await new Promise((r) => setTimeout(r, 400));
    }
    log(`Vocab: ${kata2.length} soal terkirim ke channel (${kata2.map((k) => k.kata).join(', ')})`);
    return true;
  } catch (e) {
    log(`Vocab cron error: ${e && e.stack ? e.stack : e}`);
    return false;
  }
}

function msSampaiJamKirim() {
  const now = new Date(Date.now() + WIB);
  const target = new Date(now);
  target.setUTCHours(JAM_KIRIM, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

module.exports = function startVocabCron(client) {
  function jadwalkan() {
    const delay = msSampaiJamKirim();
    log(`Vocab cron aktif: kirim berikutnya ${Math.round(delay / 60000)} menit lagi (jam 07:00 WIB)`);
    setTimeout(async () => {
      await kirimVocab(client);
      jadwalkan(); // pasang ulang timer biar selalu pas jam kirim
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimVocab = kirimVocab;
module.exports.buatSoal = buatSoal;
