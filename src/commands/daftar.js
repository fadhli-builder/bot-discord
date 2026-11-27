const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder,
} = require('discord.js');
const { stmt } = require('../db');

const UMIN = 10;
const UMAX = 80;

const gateOn = () => String(process.env.AGE_GATE_ENABLED).toLowerCase() === 'true';

function cekUmur(raw) {
  const minAge = parseInt(process.env.MIN_AGE || '18', 10);
  const v = (raw || '').trim();
  if (!v) {
    if (gateOn()) return { ok: false, umur: null, err: `Umur wajib diisi (minimal ${minAge} tahun).` };
    return { ok: true, umur: null };
  }
  if (!/^\d{1,3}$/.test(v)) return { ok: false, umur: null, err: 'Umur harus berupa angka ya.' };
  const n = parseInt(v, 10);
  if (n < UMIN || n > UMAX) return { ok: false, umur: null, err: `Umur harus di antara ${UMIN}-${UMAX} tahun.` };
  if (gateOn() && n < minAge) {
    return { ok: false, umur: null, err: `Maaf, kamu belum memenuhi syarat umur (minimal ${minAge} tahun). Datamu tidak disimpan.` };
  }
  return { ok: true, umur: n };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daftar')
    .setDescription('Daftar / update profil biar bisa kenalan sama teman random'),

  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('daftar:submit').setTitle('Pendaftaran Teman Random');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('nama').setLabel('Nama panggilan')
          .setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(40).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('umur')
          .setLabel(gateOn() ? `Umur (wajib, min. ${process.env.MIN_AGE || 18})` : 'Umur (opsional)')
          .setStyle(TextInputStyle.Short).setMaxLength(3).setRequired(gateOn())
          .setPlaceholder('Contoh: 21'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('hobi').setLabel('Hobi')
          .setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(100).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('bio').setLabel('Bio singkat (maks 200 karakter)')
          .setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(200).setRequired(true),
      ),
    );
    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const nama = interaction.fields.getTextInputValue('nama').trim();
    const hobi = interaction.fields.getTextInputValue('hobi').trim();
    const bio = interaction.fields.getTextInputValue('bio').trim();
    const cek = cekUmur(interaction.fields.getTextInputValue('umur'));

    const errs = [];
    if (!cek.ok) errs.push(cek.err);
    if (nama.length < 2 || hobi.length < 2 || bio.length < 2) {
      errs.push('Semua kolom kecuali umur wajib diisi (minimal 2 karakter).');
    }
    if (errs.length) {
      return interaction.reply({ content: '' + errs.join('\n'), ephemeral: true });
    }

    stmt.upsertUser.run({ id: interaction.user.id, nama, umur: cek.umur, hobi, bio });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Pendaftaran tersimpan!')
      .setDescription('Profil kamu udah kesimpen. Nanti pas fitur kenalan aktif, kamu bisa dipasangkan sama teman random dari server ini. Ajak teman-teman lain daftar juga biar makin seru!')
      .addFields(
        { name: 'Nama', value: nama },
        { name: 'Umur', value: cek.umur ? String(cek.umur) : 'dirahasiakan', inline: true },
        { name: 'Status', value: 'Aktif', inline: true },
        { name: 'Hobi', value: hobi },
        { name: 'Bio', value: bio },
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
