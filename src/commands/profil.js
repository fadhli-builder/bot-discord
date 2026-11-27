const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { stmt } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Lihat profil kamu'),

  async execute(interaction) {
    const u = stmt.getUser.get(interaction.user.id);
    if (!u) {
      return interaction.reply({ content: 'Kamu belum terdaftar. Ketik `/daftar` dulu ya!', ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`Profil ${u.nama}`)
      .addFields(
        { name: 'Umur', value: u.umur == null ? 'dirahasiakan' : String(u.umur), inline: true },
        { name: 'Status', value: u.aktif ? 'Aktif' : 'Pause', inline: true },
        { name: 'Hobi', value: u.hobi },
        { name: 'Bio', value: u.bio },
      )
      .setFooter({ text: `Terdaftar sejak ${u.created_at} UTC` });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
