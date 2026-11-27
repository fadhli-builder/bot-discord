const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  resolveLagu, downloadAudio, mulaiKaraoke,
  getSesi, togglePause, toggleAutoplay, stop, updateLayar,
} = require('../karaoke-player');
const { log } = require('../log');

// /karaoke — bot join VC, putar lagu: data resmi dari katalog Deezer,
// audio full dari SoundCloud. Mode musik murni tanpa lirik
// (permintaan Bos, 2026-11-05). Tombol layar (customId "karaoke:aksi")
// juga dirute ke sini.

module.exports = {
  data: new SlashCommandBuilder()
    .setName('karaoke')
    .setDescription('Bot musik: putar lagu di voice channel (data Deezer, audio full)')
    .addStringOption((o) =>
      o.setName('lagu')
        .setDescription('Judul lagu & penyanyi, atau link SoundCloud')
        .setRequired(true)),

  async execute(interaction) {
    if (!interaction.member?.voice?.channelId) {
      return interaction.reply({
        content: 'Masuk voice channel dulu ya, biar botnya bisa gabung',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply(); // proses resolve+download bisa 30-60 detik
    try {
      const q = interaction.options.getString('lagu', true);
      const lagu = await resolveLagu(q);
      await interaction.editReply({
        embeds: [{
          title: 'Bersiap...',
          description: `**${lagu.judul}** — **${lagu.artis || lagu.uploader}**\nDownload audio full, bentar ya...`,
          color: 0x6a1b9a,
        }],
      });

      const file = await downloadAudio(lagu.url);
      await mulaiKaraoke({ interaction, lagu, file, query: q });
    } catch (e) {
      log(`Karaoke error: ${e && e.stack ? e.stack : e}`);
      const pesan = String(e.message || e);
      await interaction
        .editReply({ content: `${pesan}`, embeds: [], components: [] })
        .catch(() => {});
    }
  },

  // Tombol layar: customId = karaoke:<aksi>
  async handleButton(interaction) {
    const aksi = interaction.customId.split(':')[1];
    const guildId = interaction.guildId;

    if (aksi === 'stop') {
      const ok = stop(guildId);
      return interaction
        .update({
          content: ok ? 'Pemutar musik dimatikan — sampai jumpa di sesi berikutnya!' : 'Gak ada sesi musik yang jalan.',
          embeds: [], components: [],
        })
        .catch(() => {});
    }
    if (!getSesi(guildId)) {
      return interaction.reply({ content: 'Gak ada musik yang jalan nih', flags: MessageFlags.Ephemeral });
    }
    if (aksi === 'pp') {
      togglePause(guildId);
    } else if (aksi === 'auto') {
      const nyala = toggleAutoplay(guildId);
      await interaction.reply({
        content: nyala
          ? 'Autoplay nyala. Setelah lagu ini, bot lanjut sendiri dengan lagu lain se-vibe.'
          : 'Autoplay mati. Bot berhenti setelah lagu ini selesai.',
        flags: MessageFlags.Ephemeral,
      });
      updateLayar(guildId);
      return;
    } else {
      return interaction.reply({ content: 'Tombol gak dikenal.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferUpdate();
    updateLayar(guildId);
  },
};
