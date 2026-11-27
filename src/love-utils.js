// Util fitur ship: dipakai command /love.
const { EmbedBuilder } = require('discord.js');

const PROMPT_LOVE = [
  'Siapa yang bakal chat duluan malam ini?',
  'Kalau ketemu di dunia nyata, sapa duluan gak nih?',
  'Jujur, siapa yang lebih dulu kepikiran hari ini?',
  'Kira-kira nanado yaudah, yang penting cocoknya pas',
  'Siapa yang lebih romantis? Serahkan ke voting server!',
  'Klaim gelar "ship paling cocok" bulan ini yuk!',
];

// [ambang skor, judul] — dicek dari ambang tertinggi ke bawah.
const JUDUL_SKOR = [
  [85, 'Siapin undangannya, sampai tua kelihatan'],
  [70, 'Lirik-lirikan di angkot energy'],
  [50, 'Chemistry mulai keliatan'],
  [30, 'Teman sembako level: nyari alasan buat chat'],
  [15, 'Masih sebelah pinggiran, tapi bisa jalan pelan-pelan'],
  [1, 'Hmm... mungkin di kehidupan lain ya'],
];

function acak(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function acakUrutan(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Skor absurd: 4% dapat 0.1%, 4% dapat 100%, sisanya 1-100 biasa.
function skorCocok() {
  const r = Math.random();
  if (r < 0.04) return 0.1;
  if (r < 0.08) return 100;
  return 1 + Math.floor(Math.random() * 100);
}

function judulSkor(s) {
  if (s <= 0.5) return '0.1%... mending jadi temen main game aja';
  if (s >= 100) return 'CIEEEE 100% SEMPURNA! Langsung nikah kapan?';
  for (const [ambang, judul] of JUDUL_SKOR) {
    if (s >= ambang) return judul;
  }
  return JUDUL_SKOR[JUDUL_SKOR.length - 1][1];
}

function barCinta(s) {
  const penuh = Math.min(10, Math.round(s / 10));
  return '█'.repeat(penuh) + '░'.repeat(10 - penuh);
}

// Nama ship klasik: separuh nama pertama + separuh nama kedua.
function namaShip(namaA, namaB) {
  const ka = (namaA || 'dia').trim().split(/\s+/)[0];
  const kb = (namaB || 'dia').trim().split(/\s+/)[0];
  return (
    ka.slice(0, Math.ceil(ka.length / 2)) +
    kb.slice(Math.floor(kb.length / 2))
  );
}

function kartuShip({ title, persen, namaA, namaB }) {
  return new EmbedBuilder()
    .setColor(0xe91e63)
    .setTitle(title)
    .setDescription(`${barCinta(persen)}\n**${persen}%** — ${judulSkor(persen)}`)
    .addFields(
      { name: 'Nama ship', value: namaShip(namaA, namaB), inline: true },
      { name: 'Chat pembuka', value: acak(PROMPT_LOVE), inline: true },
    )
    .setFooter({ text: 'KenalBot • hasil ship itu random ya, jangan dijadiin janji' });
}

module.exports = { acak, acakUrutan, skorCocok, judulSkor, barCinta, namaShip, kartuShip };
