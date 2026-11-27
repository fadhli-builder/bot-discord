const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { stmt, hariIniWIB } = require('../db');
const { log } = require('../log');

const BATAS_HARIAN = 3;

const ICEBREAKER = [
  'Kalau bisa makan satu makanan seumur hidup, pilih apa?',
  'Film/serie apa yang bisa kamu tonton berulang kali?',
  'Kamu tim pagi atau tim begadang?',
  'Game apa yang lagi kamu mainin sekarang?',
  'Kalau libur sehari bebas ongkos, mau ngapain?',
  'Fakta unik tentang kamu yang jarang orang tau?',
  'Kopi atau teh?',
  'Tempat paling pengen kamu kunjungi di Indonesia?',
  'Lagu yang lagi kamu repeat saat ini?',
  'Kalau jadi hewan satu hari, mau jadi apa?',
  'Hal kecil apa yang bikin hari kamu langsung happy?',
  'Nasi padang atau nasi goreng?',
  'Skill baru apa yang pengen kamu kuasai tahun ini?',
  'Komedi apa yang bikin kamu ketawa paling kenceng?',
  'Kalau dapat superpower sehari, pilih yang mana?',
];

function acak(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function kartuProfil(pengirim, u) {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Ada teman random buat kamu!')
    .setDescription(
      'Seseorang dari server ini pengen kenalan. Cek profilnya — kalau cocok, klik **Lanjut** ya. ' +
      'Gak cocok? Klik **Lewati**, tenang aja dia gak akan tau siapa kamu.',
    )
    .addFields(
      { name: 'Nama', value: u.nama, inline: true },
      { name: 'Umur', value: u.umur == null ? 'dirahasiakan' : String(u.umur), inline: true },
      { name: 'Hobi', value: u.hobi },
      { name: 'Bio', value: u.bio },
    )
    .setFooter({ text: 'Dikirim otomatis oleh KenalBot • identitas lengkap muncul kalau kalian lanjut' });
}

function tombol(kenalanId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`kenalan:lanjut:${kenalanId}`)
      .setLabel('Lanjut kenalan').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`kenalan:lewati:${kenalanId}`)
      .setLabel('Lewati').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`kenalan:report:${kenalanId}`)
      .setLabel('Report').setStyle(ButtonStyle.Danger),
  );
}

function tombolMati(kenalanId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`kenalan:lanjut:${kenalanId}`)
      .setLabel('Lanjut kenalan').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`kenalan:lewati:${kenalanId}`)
      .setLabel('Lewati').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`kenalan:report:${kenalanId}`)
      .setLabel('Report').setStyle(ButtonStyle.Danger).setDisabled(true),
  );
}

async function kirimDm(user, payload) {
  const dm = await user.createDM();
  await dm.send(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kenalan')
    .setDescription('Dapat teman random dari server ini — identitas dirahasiakan sampai kalian lanjut'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const me = interaction.user.id;

    const u = stmt.getUser.get(me);
    if (!u) {
      return interaction.editReply('Kamu belum terdaftar. Ketik `/daftar` dulu ya!');
    }
    if (!u.aktif) {
      return interaction.editReply('Kamu lagi mode pause. Ketik `/aktifkan` dulu ya.');
    }

    // Jatah harian (reset tengah malam WIB)
    const terpakai = stmt.countHariIni.get(me, hariIniWIB()).n;
    if (terpakai >= BATAS_HARIAN) {
      return interaction.editReply(
        `Jatah kenalan hari ini udah habis (${BATAS_HARIAN}/${BATAS_HARIAN}) Coba lagi besok ya!`,
      );
    }

    // Ambil kandidat, acak urutannya
    const kandidat = stmt.kandidat.all(me, me, me, me, me);
    for (let i = kandidat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kandidat[i], kandidat[j]] = [kandidat[j], kandidat[i]];
    }
    if (!kandidat.length) {
      return interaction.editReply('Belum ada yang cocok, coba lagi nanti (ajak teman lain daftar juga biar makin ramai!)');
    }

    // Cari kandidat yang masih ada di server; yang sudah keluar → aktif=false
    let target = null;
    for (const k of kandidat) {
      try {
        await interaction.guild.members.fetch(k.discord_id);
        target = k;
        break;
      } catch (_) {
        stmt.setUserAktif.run(0, k.discord_id);
        log(`Kandidat ${k.discord_id} sudah keluar server → aktif=false`);
      }
    }
    if (!target) {
      return interaction.editReply('Belum ada yang cocok, coba lagi nanti');
    }

    // Catat sapaan dulu (status pending), baru kirim DM
    const info = stmt.insertKenalan.run(me, target.discord_id);
    const sisa = BATAS_HARIAN - terpakai - 1;

    try {
      const penerima = await interaction.client.users.fetch(target.discord_id);
      await kirimDm(penerima, {
        embeds: [kartuProfil(interaction.user, u)],
        components: [tombol(info.lastInsertRowid)],
      });
    } catch (e) {
      // DM ditutup → batalkan, gak masuk hitungan harian
      stmt.setKenalanStatus.run('cancelled', info.lastInsertRowid);
      log(`DM gagal ke ${target.discord_id}: ${e.message}`);
      return interaction.editReply(
        'Waduh, teman random yang kepilih lagi tutup DM-nya. Sapaan dibatalkan dan gak masuk hitungan harian. Coba lagi ya!',
      );
    }

    return interaction.editReply(
      `Sapaan terkirim ke teman random! Semoga diterima\n` +
      `Sisa jatah hari ini: **${sisa}/${BATAS_HARIAN}**\n` +
      `Kalau dia lanjut, kamu bakal langsung di-DM!`,
    );
  },

  // ===== Tombol di DM target =====
  async handleButton(interaction) {
    const [, action, idStr] = interaction.customId.split(':');
    const row = stmt.getKenalan.get(Number(idStr));
    if (!row) {
      return interaction.reply({ content: 'Data sapaan ini udah gak ada (mungkin profil pengirim dihapus).', ephemeral: true });
    }
    if (interaction.user.id !== row.ke) {
      return interaction.reply({ content: 'Ini bukan sapaan buat kamu ya', ephemeral: true });
    }
    if (row.status !== 'pending') {
      return interaction.reply({ content: 'Sapaan ini udah dijawab sebelumnya.', ephemeral: true });
    }

    if (action === 'lanjut') return this.lanjut(interaction, row);
    if (action === 'lewati') return this.lewati(interaction, row);
    if (action === 'report') return this.bukaFormReport(interaction, row);
    return interaction.reply({ content: 'Aksi gak dikenal.', ephemeral: true });
  },

  async lanjut(interaction, row) {
    stmt.setKenalanStatus.run('accepted', row.id);

    const client = interaction.client;
    let pengirim, penerima;
    try {
      [pengirim, penerima] = await Promise.all([
        client.users.fetch(row.dari),
        client.users.fetch(row.ke),
      ]);
    } catch (e) {
      log(`Gagal fetch user saat lanjut #${row.id}: ${e.message}`);
      return interaction.update({ content: 'Terjadi kendala, sapaan ini ditutup.', components: [] });
    }

    const tanya = acak(ICEBREAKER);
    const gagal = [];

    try {
      await kirimDm(pengirim, {
        content:
          `**Diterima!** Teman random kamu jadi lanjut kenalan!\n` +
          `Ini dia: <@${row.ke}>\n\n` +
          `**Pembuka obrolan:** ${tanya}`,
      });
    } catch (_) { gagal.push(row.dari); }
    try {
      await kirimDm(penerima, {
        content:
          `Mantap! Kamu terhubung sama: <@${row.dari}>\n` +
          `Saling sapa ya! (DM dia langsung — kalian udah saling kenal sekarang)\n\n` +
          `**Pembuka obrolan:** ${tanya}`,
      });
    } catch (_) { gagal.push(row.ke); }

    // Kalau salah satu DM gagal → fallback ke channel match
    if (gagal.length) {
      try {
        const ch = await client.channels.fetch(process.env.MATCH_CHANNEL_ID);
        await ch.send({
          content:
            `Match baru! <@${row.dari}> <@${row.ke}>\n` +
            `(DM salah satu tertutup, jadi pengumuman di sini dulu)\n` +
            `**Pembuka obrolan:** ${tanya}`,
        });
      } catch (e) {
        log(`Fallback MATCH_CHANNEL gagal: ${e.message}`);
      }
    }

    return interaction.update({
      content: 'Siap! Kalian sudah saling terhubung — cek DM masing-masing!',
      components: [],
    });
  },

  async lewati(interaction, row) {
    stmt.setKenalanStatus.run('rejected', row.id);
    try {
      const pengirim = await interaction.client.users.fetch(row.dari);
      await kirimDm(pengirim, {
        content: 'Teman random kamu belum melanjutkan kali ini. Gak apa-apa — coba lagi nanti, siapa tau cocok!',
      });
    } catch (_) { /* pengirim DM tertutup → diamkan */ }
    return interaction.update({ content: 'Oke, dilewati. Tenang, dia gak tau siapa kamu.', components: [] });
  },

  async bukaFormReport(interaction, row) {
    const modal = new ModalBuilder()
      .setCustomId(`kenalan:reportmodal:${row.id}`)
      .setTitle('Laporkan sapaan ini');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('alasan')
          .setLabel('Alasan (opsional)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(false),
      ),
    );
    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const [, action, idStr] = interaction.customId.split(':');
    if (action !== 'reportmodal') return;
    const row = stmt.getKenalan.get(Number(idStr));
    if (!row || row.status !== 'pending' || interaction.user.id !== row.ke) {
      return interaction.reply({ content: 'Sapaan ini gak bisa dilaporkan (udah ditutup/sebelumnya).', ephemeral: true });
    }

    const alasan = (interaction.fields.getTextInputValue('alasan') || '').trim();
    stmt.insertReport.run(interaction.user.id, row.dari, row.id, alasan);
    stmt.setKenalanStatus.run('rejected', row.id);

    // Laporan ke channel mod
    try {
      const pelaporProfil = stmt.getUser.get(row.ke);
      const terlaporProfil = stmt.getUser.get(row.dari);
      const ch = await interaction.client.channels.fetch(process.env.MOD_CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Laporan sapaan')
        .addFields(
          { name: 'Pelapor', value: `<@${row.ke}> (${row.ke})`, inline: true },
          { name: 'Terlapor', value: `<@${row.dari}> (${row.dari})`, inline: true },
          { name: 'Alasan', value: alasan || '_(kosong)_' },
          { name: 'Profil terlapor', value: terlaporProfil
            ? `Nama: ${terlaporProfil.nama} | Umur: ${terlaporProfil.umur ?? '-'} | Hobi: ${terlaporProfil.hobi}\nBio: ${terlaporProfil.bio}`
            : '(profil sudah dihapus)' },
          { name: 'Profil pelapor', value: pelaporProfil
            ? `Nama: ${pelaporProfil.nama} | Umur: ${pelaporProfil.umur ?? '-'} | Hobi: ${pelaporProfil.hobi}`
            : '(profil sudah dihapus)' },
        );
      await ch.send({ embeds: [embed] });
    } catch (e) {
      log(`Gagal kirim report ke MOD_CHANNEL: ${e.message}`);
    }

    // Otomatis tolak sapaannya + kabari pengirim secara netral
    try {
      const pengirim = await interaction.client.users.fetch(row.dari);
      await kirimDm(pengirim, {
        content: 'Teman random kamu belum melanjutkan kali ini. Coba lagi nanti ya!',
      });
    } catch (_) { /* diamkan */ }

    return interaction.reply({
      content: 'Laporan terkirim, terima kasih. Mod kami akan tinjau. Sapaan ini sudah ditutup.',
      ephemeral: true,
    });
  },
};
