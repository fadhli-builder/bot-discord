const { SlashCommandBuilder } = require('discord.js');
const { stmt } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Keluar sementara dari pool teman random'),

  async execute(interaction) {
    const u = stmt.getUser.get(interaction.user.id);
    if (!u) {
      return interaction.reply({ content: 'Kamu belum terdaftar. Ketik `/daftar` dulu ya!', ephemeral: true });
    }
    if (!u.aktif) {
      return interaction.reply({ content: 'Kamu emang udah mode pause', ephemeral: true });
    }
    stmt.setUserAktif.run(0, interaction.user.id);
    return interaction.reply({
      content:
        'Pause aktif. Kamu gak akan kepilih jadi teman random, dan gak bisa `/kenalan` dulu.\n' +
        'Sapaan yang udah masuk DM tetap bisa dijawab. Balik lagi kapan aja pakai `/aktifkan` ya!',
      ephemeral: true,
    });
  },
};
