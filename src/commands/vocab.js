const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { stmt, hariIniWIB, streakNyala, catatStreakVocab } = require('../db');
const { buatSoal } = require('../vocab-cron');

// /vocab — skor pribadi + leaderboard mingguan kuis kosa kata.
// Tombol jawaban soal juga dirute ke sini (customId "vocab:jawab:...").
// Sejak fitur streak (2026-11-26): /vocab tampil PUBLIC (bukan ephemeral),
// ada kolom streak — streak GAK direset per minggu, beda dgn papan skor.

const WIB_OFFSET = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const WARNA = 0x2e7d32;

// Senin pekan ini (mulai pekan) dalam tanggal WIB — leaderboard reset tiap Senin
function seninWIB() {
  const now = new Date(Date.now() + WIB_OFFSET);
  const dow = now.getUTCDay(); // 0=Minggu .. 6=Sabtu
  const delta = dow === 0 ? 6 : dow - 1;
  return new Date(now.getTime() - delta * 864e5).toISOString().slice(0, 10);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vocab')
    .setDescription('Cek skormu & leaderboard kuis kosa kata mingguan'),

  async execute(interaction) {
    const sejak = seninWIB();
    const hari = hariIniWIB();
    const stat = stmt.getVocabStatUser.get(interaction.user.id, sejak) || { b: null, total: 0 };
    const st = stmt.getVocabStreak.get(interaction.user.id);
    const nyala = st ? streakNyala(st.tanggal_terakhir, hari) : false;
    const teksStreak = !st || !st.streak_kini
      ? 'Belum ada — jawab soal hari ini buat mulai streak!'
      : nyala
        ? `🔥 ${st.streak_kini} hari (rekor ${st.streak_terpanjang})`
        : `🔥 padam — rekor ${st.streak_terpanjang}. Jawab soal hari ini buat nyalain lagi!`;
    const lb = stmt.getVocabLeaderboard.all(sejak);
    const medali = ['1.', '2.', '3.'];
    const baris = lb.length
      ? lb
          .map((r, i) => {
            const api = streakNyala(r.tgl_terakhir, hari) ? ' 🔥' : '';
            return `${medali[i] ?? `**${i + 1}.**`} <@${r.user_id}> — ${r.b} benar / ${r.total} jawab · streak ${r.streak}${api}`;
          })
          .join('\n')
      : '_Belum ada yang jawab minggu ini._';
    await interaction.reply({
      embeds: [
        {
          title: 'Kuis Kosa Kata — Papan Skor Mingguan',
          color: WARNA,
          fields: [
            {
              name: 'Skormu (minggu ini)',
              value: stat.total
                ? `${stat.b ?? 0} benar dari ${stat.total} jawaban`
                : 'Belum jawab minggu ini — tunggu kuis pagi besok!',
            },
            { name: 'Streak kamu (gak ikut reset mingguan)', value: teksStreak },
            { name: 'Leaderboard (reset tiap Senin)', value: baris },
          ],
          footer: { text: 'Kuis harian jam 07:00 WIB • jawab lewat tombol di channel-nya' },
        },
      ],
    });
  },

  // Tombol pilihan jawaban: customId = vocab:jawab:<tanggal>:<kata>:<index>
  async handleButton(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[1] !== 'jawab') return;
    const [, , tanggal, kata, idxStr] = parts;
    const pilih = Number.parseInt(idxStr, 10);
    const soal = buatSoal(kata, tanggal);
    if (!soal || Number.isNaN(pilih)) {
      return interaction.reply({ content: 'Soalnya gak ketemu nih', flags: MessageFlags.Ephemeral });
    }

    // Satu user satu jawaban per kata per hari — jawaban kedua gak dihitung
    const sudah = stmt.getVocabJawab.get(interaction.user.id, kata, tanggal);
    if (sudah) {
      return interaction.reply({
        content: sudah.benar
          ? 'Kamu udah bener jawab soal ini. Poinnya dihitung sekali aja ya!'
          : 'Kamu udah jawab soal ini dan belum tepat — semangat, besok ada soal baru',
        flags: MessageFlags.Ephemeral,
      });
    }

    const benar = pilih === soal.benarIdx ? 1 : 0;
    stmt.insertVocabAnswer.run(interaction.user.id, interaction.user.username, kata, benar, tanggal);

    // Streak: naik tiap hari ADA jawaban (benar/salah sama), gak pernah direset
    // per minggu. Panggilan kedua di hari sama otomatis gak nambah (dijaga di
    // catatStreakVocab). Jawaban benar soal lain di hari sama gak nambah juga.
    const { streak } = catatStreakVocab(interaction.user.id, tanggal);
    const infoStreak = streak === 1
      ? 'Streak dimulai: 🔥 1 hari — balik lagi besok biar gak padam!'
      : `Streak lanjut: 🔥 ${streak} hari!`;

    const pembahasan =
      `**${soal.kata}** *(${soal.jenis})* = **${soal.arti}**\n` +
      `> ${soal.contoh}\n> _${soal.terjemah}_`;

    if (benar) {
      // Benar: pengumuman + streak tampil public, pembahasan detail privat
      await interaction.reply({ content: `<@${interaction.user.id}> jawab benar! +1 poin · ${infoStreak}` });
      await interaction.followUp({ content: pembahasan, flags: MessageFlags.Ephemeral });
    } else {
      // Salah: streak tetap diumumkan public (permintaan Bos), tapi jawaban
      // benar gak ikut public biar soal buat orang lain gak bocor seharian;
      // pembahasan lengkap tetap privat.
      await interaction.reply({
        content: `<@${interaction.user.id}> belum tepat · ${infoStreak}`,
      });
      await interaction.followUp({ content: pembahasan, flags: MessageFlags.Ephemeral });
    }
  },
};
