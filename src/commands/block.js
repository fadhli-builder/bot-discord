const { SlashCommandBuilder } = require('discord.js');
const { stmt } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('block')
    .setDescription('Blokir seseorang dari fitur kenalan (dua arah)')
    .addUserOption((o) =>
      o.setName('target').setDescription('User yang mau diblokir').setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('target');

    if (target.id === interaction.user.id) {
      return interaction.editReply('Ngeblok diri sendiri? Gak akan bisa, Bos');
    }
    if (target.bot) {
      return interaction.editReply('Yang diblokir harus user manusia ya');
    }

    stmt.insertBlock.run(interaction.user.id, target.id);
    return interaction.editReply(
      `<@${target.id}> diblokir dari fitur kenalan.\n` +
      'Efeknya dua arah: dia gak akan dapet sapaan dari kamu, dan kamu gak akan dapet sapaan dari dia.',
    );
  },
};
