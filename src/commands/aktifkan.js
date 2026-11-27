const { SlashCommandBuilder } = require('discord.js');
const { stmt } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aktifkan')
    .setDescription('Kembali ikut pool teman random'),

  async execute(interaction) {
    const u = stmt.getUser.get(interaction.user.id);
    if (!u) {
      return interaction.reply({ content: 'Kamu belum terdaftar. Ketik `/daftar` dulu ya!', ephemeral: true });
    }
    if (u.aktif) {
      return interaction.reply({ content: 'Kamu emang udah aktif', ephemeral: true });
    }
    stmt.setUserAktif.run(1, interaction.user.id);
    return interaction.reply({
      content: 'Aktif lagi! Kamu bisa `/kenalan` dan bisa kepilih jadi teman random.',
      ephemeral: true,
    });
  },
};
