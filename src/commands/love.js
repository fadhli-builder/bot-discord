const { SlashCommandBuilder, Events, MessageFlags } = require('discord.js');
const { stmt, hariIniWIB } = require('../db');
const { log } = require('../log');
const { acakUrutan, skorCocok, kartuShip } = require('../love-utils');

const COOLDOWN_MS = 10 * 1000;
const BATAS_HARIAN = 2; // jatah ship sukses per hari (reset tengah malam WIB)
const REFRESH_MS = 10 * 60 * 1000; // coba ambil list penuh member tiap 10 menit
const cooldown = new Map(); // userId -> timestamp terakhir ship
// Pool kandidat ship. Cara ambil list penuh member tanpa Server Members Intent:
// endpoint pencarian member (search per huruf) — resmi, tanpa intent privileged.
// Ditambah siapa aja yang keliatan aktif (pesan/command) biar makin lengkap.
const poolAktif = new Map(); // userId -> { id, username }
const HURUF = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const API = 'https://discord.com/api/v10';
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

function catat(user) {
  if (!user || user.bot) return;
  poolAktif.set(user.id, { id: user.id, username: user.username });
}

// Sweep pencarian member a-z0-9 (jarak antar request dijaga biar gak kena rate limit).
async function isiPool(guild) {
  let penuh = true;
  const hasil = new Map();
  for (const huruf of HURUF) {
    try {
      const r = await fetch(
        `${API}/guilds/${guild.id}/members/search?query=${huruf}&limit=1000`,
        { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } },
      );
      if (!r.ok) { penuh = false; break; } // 429/403 — pakai hasil sebagian, ulang interval depan
      for (const m of await r.json()) hasil.set(m.user.id, m.user);
    } catch (_) {
      penuh = false;
      break;
    }
    await jeda(1200);
  }
  for (const u of hasil.values()) catat(u);
  if (hasil.size) {
    log(`Pool /love diperbarui: ${poolAktif.size} kandidat${penuh ? '' : ' (sebagian, bersambung)'}`);
  }
}

// Isi pool pas bot nyala + pantau aktivitas + sweep ulang berkala.
function init(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID) ?? client.guilds.cache.first();
  if (!guild) return;
  for (const m of guild.members.cache.values()) catat(m.user);
  client.on(Events.MessageCreate, (msg) => { if (msg.guild) catat(msg.author); });
  client.on(Events.InteractionCreate, (i) => catat(i.user));
  isiPool(guild).catch(() => {});
  const timer = setInterval(() => isiPool(guild).catch(() => {}), REFRESH_MS);
  if (timer.unref) timer.unref();
}

module.exports = {
  init,
  data: new SlashCommandBuilder()
    .setName('love')
    .setDescription('Ship kamu sama member server random — cek berapa persen cocoknya')
    .addUserOption((o) =>
      o.setName('target')
        .setDescription('(Opsional) Langsung ship sama orang ini')
        .setRequired(false),
    ),

  // /love sengaja independen dari /kenalan: kandidatnya SEMUA member server,
  // bukan cuma yang daftar profil. Register tidak wajib buat kena ship.
  async execute(interaction) {
    await interaction.deferReply(); // sengaja publik — hasil ship memang buat dipamerin

    const me = interaction.user.id;
    catat(interaction.user); // yang ngeship juga masuk pool kandidat
    const now = Date.now();
    if (now - (cooldown.get(me) || 0) < COOLDOWN_MS) {
      return interaction.editReply('Santai dulu. Tunggu sebentar sebelum ship lagi.');
    }

    // Jatah harian (reset tengah malam WIB) — cuma ship yang sukses yang dihitung
    const terpakai = stmt.countLoveHariIni.get(me, hariIniWIB()).n;
    if (terpakai >= BATAS_HARIAN) {
      return interaction.editReply(
        `Jatah ship hari ini udah habis (${terpakai}/${BATAS_HARIAN}) Besok lagi ya!`,
      );
    }

    const target = interaction.options.getUser('target');
    let b = null;

    if (target) {
      if (target.bot) {
        return interaction.editReply('Ship sama bot? Yah, dia cuma bisa nge-shipping kalian doang');
      }
      if (target.id === me) {
        return interaction.editReply('Ship sama diri sendiri... self-love sih bagus, tapi gak bisa');
      }
      b = target;
    } else {
      // Kandidat: member yang keliatan aktif di server (bukan bot/dirinya), diacak.
      const kandidat = acakUrutan([...poolAktif.values()].filter((u) => u.id !== me));
      if (kandidat.length === 0) {
        return interaction.editReply('Belum ada member aktif lain buat di-ship. Ngobrol dulu di channel, nanti bisa!');
      }
      b = kandidat[0];
    }

    // Hormati blokir dua arah dari fitur kenalan (tanpa membocorkan siapa yang memblokir)
    if (stmt.sudahBlock.get(me, b.id, b.id, me).n > 0) {
      return interaction.editReply('Fitur ship ini dimatikan buat kalian berdua');
    }

    cooldown.set(me, now);
    const persen = skorCocok();
    const profA = stmt.getUser.get(me);
    const profB = stmt.getUser.get(b.id);
    const embed = kartuShip({
      title: 'Hasil Ship',
      persen,
      namaA: profA ? profA.nama : interaction.user.username,
      namaB: profB ? profB.nama : b.username,
    });

    stmt.insertLoveLog.run(me, hariIniWIB());
    const sisa = BATAS_HARIAN - terpakai - 1;
    await interaction.editReply({
      content: `<@${me}> <@${b.id}>`,
      embeds: [embed],
    });
    // Info sisa jatah — ephemeral, cuma keliatan sama yang ngeship
    interaction.followUp({
      content: sisa > 0
        ? `Sisa jatah ship kamu hari ini: **${sisa}/${BATAS_HARIAN}**`
        : `Itu ship ke-${BATAS_HARIAN} kamu hari ini — jatahnya udah habis, besok lagi ya`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  },
};
