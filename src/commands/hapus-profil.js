const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { hapusSemua, stmt } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hapus-profil')
    .setDescription('Hapus profil & seluruh data kamu dari bot'),

  async execute(interaction) {
    const u = stmt.getUser.get(interaction.user.id);
    if (!u) {
      return interaction.reply({ content: 'Kamu memang belum terdaftar kok', ephemeral: true });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hapus-profil:confirm:${interaction.user.id}`)
        .setLabel('Ya, hapus semua')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hapus-profil:batal:${interaction.user.id}`)
        .setLabel('Batal')
        .setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({
      content: 'Semua data kamu (profil, riwayat kenalan, block, report) akan **dihapus permanen**. Yakin?',
      components: [row],
      ephemeral: true,
    });
  },

  async handleButton(interaction) {
    const [, action, ownerId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: 'Ini bukan konfirmasi kamu ya', ephemeral: true });
    }
    if (action === 'batal') {
      return interaction.update({ content: 'Batal. Datamu tetap aman', components: [] });
    }
    hapusSemua(interaction.user.id);
    return interaction.update({
      content: 'Semua datamu udah terhapus bersih. Kalau berubah pikiran, tinggal `/daftar` lagi ya!',
      components: [],
    });
  },
};
