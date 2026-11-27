const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { stmt, hapusKostumEvent } = require('../db');

// /kostum — sesi vote kostum ANONIM (Halloween).
// Prinsip kerash: identitas pemilih TIDAK PERNAH ditampilkan siapa pun.
// user_id di tabel vote cuma buat jamin 1 orang 1 suara + boleh ganti pilihan.
// Semua pesan ke member tanpa emoji (aturan tetap server ini).

const WARNA = 0xff7518; // oranye Halloween
const MAX_KANDIDAT = 10; // 2 baris tombol @5
const PANJANG_NAMA = 50;
// Operator tunggal: cuma ID ini yang boleh jalankan /kostum (permintaan Bos).
const ID_OPERATOR = '703608175370436729';

function bersihkanNama(nama) {
  return String(nama || '').replace(/\s+/g, ' ').trim().slice(0, PANJANG_NAMA);
}

function bolehKelola(interaction, ev) {
  // Anonimitas tetap aman: cek ini cuma soal hak kelola, bukan liat suara.
  return Boolean(interaction.user && interaction.user.id === ID_OPERATOR);
}

function barisKandidat(kandidat) {
  return kandidat.map((k) => `${k.nomor}. ${k.nama}`).join('\n');
}

function buildEmbed(kandidat) {
  return {
    title: 'Vote Kostum Paling Menarik',
    description: [
      barisKandidat(kandidat),
      '',
      'Cara vote: klik tombol nomor di bawah.',
      'Satu orang satu suara, boleh ganti pilihan selama sesi masih buka.',
      'Identitas pemilih dirahasiakan — yang keluar cuma jumlah suara.',
    ].join('\n'),
    color: WARNA,
    footer: { text: 'Sesi anonim • kelola pakai /kostum' },
  };
}

function buildComponents(eventId, kandidat) {
  const rows = [];
  for (let i = 0; i < kandidat.length; i += 5) {
    const chunk = kandidat.slice(i, i + 5);
    rows.push(
      new ActionRowBuilder().addComponents(
        chunk.map(
          (k) =>
            new ButtonBuilder()
              .setCustomId(`kostum:vote:${eventId}:${k.nomor}`)
              .setLabel(`Vote ${k.nomor}`)
              .setStyle(ButtonStyle.Primary)
        )
      )
    );
  }
  return rows;
}

function buildEmbedDitutup() {
  return {
    title: 'Vote Kostum — Ditutup',
    description: 'Sesi vote berakhir. Hasil diumumkan di channel ini.',
    color: WARNA,
  };
}

function buildEmbedHasil(hasil) {
  const maxSuara = hasil.reduce((m, h) => Math.max(m, h.suara), 0);
  const baris = hasil.map(
    (h, i) =>
      `${h.suara === maxSuara && maxSuara > 0 ? '**' : ''}${i + 1}. ${h.nama} — ${h.suara} suara${
        h.suara === maxSuara && maxSuara > 0 ? '**' : ''
      }`
  );
  if (maxSuara === 0) {
    baris.push('', 'Belum ada suara yang masuk.');
  } else {
    const juara = hasil.filter((h) => h.suara === maxSuara);
    baris.push(
      '',
      juara.length > 1
        ? `Seri di puncak: ${juara.map((j) => j.nama).join(' & ')} (${maxSuara} suara)`
        : `Pemenang: ${juara[0].nama} (${maxSuara} suara)`
    );
  }
  return { title: 'Hasil Vote Kostum', description: baris.join('\n'), color: WARNA };
}

async function editPesanEvent(client, ev, payload) {
  if (!ev.message_id) return false;
  try {
    const ch = await client.channels.fetch(ev.channel_id);
    const msg = await ch.messages.fetch(ev.message_id);
    await msg.edit(payload);
    return true;
  } catch (_) {
    return false; // pesan terhapus / bot kehilangan akses — sesi tetap valid di DB
  }
}

async function balasEphemeral(interaction, content) {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

module.exports = {
  buildEmbed,
  buildComponents,
  data: new SlashCommandBuilder()
    .setName('kostum')
    .setDescription('Sesi vote kostum anonim (mulai, tambah, ganti, cek, tutup, ulang)')
    .addSubcommand((sc) =>
      sc
        .setName('mulai')
        .setDescription('Mulai sesi vote kostum baru dengan kandidat 1, 2, 3')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Channel tujuan vote (kosongkan = channel ini)')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('tambah')
        .setDescription('Tambah kandidat kostum baru')
        .addStringOption((o) => o.setName('nama').setDescription('Nama kostum').setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName('ganti')
        .setDescription('Ganti nama kandidat (misal 1, 2, 3 jadi nama asli)')
        .addIntegerOption((o) =>
          o.setName('nomor').setDescription('Nomor kandidat').setRequired(true).setMinValue(1)
        )
        .addStringOption((o) => o.setName('nama').setDescription('Nama baru').setRequired(true))
    )
    .addSubcommand((sc) =>
      sc.setName('cek').setDescription('Lihat jumlah suara sementara (privat, cuma ke kamu)')
    )
    .addSubcommand((sc) =>
      sc.setName('tutup').setDescription('Tutup sesi vote dan umumkan hasilnya di channel')
    )
    .addSubcommand((sc) =>
      sc.setName('ulang').setDescription('Hapus sesi vote beserta semua suara (mulai dari nol)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(false);
    const guildId = interaction.guildId;

    // Gerbang tunggal: semua subcommand /kostum cuma buat operator.
    if (!bolehKelola(interaction, null)) {
      return balasEphemeral(interaction, 'Command vote ini cuma bisa dipakai operatornya.');
    }

    if (sub === 'mulai') {
      const aktif = stmt.getKostumEventAktif.get(guildId);
      if (aktif) {
        return balasEphemeral(
          interaction,
          `Masih ada sesi vote yang buka (nomor ${aktif.id}). Tutup dulu pakai /kostum tutup, atau reset pakai /kostum ulang.`
        );
      }
      const targetId = interaction.options.getChannel('channel')?.id ?? interaction.channelId;
      const info = stmt.insertKostumEvent.run(guildId, targetId, interaction.user.id);
      const eventId = info.lastInsertRowid;
      for (let i = 1; i <= 3; i++) stmt.insertKostumKandidat.run(eventId, i, `Kostum ${i}`);
      const kandidat = stmt.getKostumKandidat.all(eventId);

      let msg;
      try {
        const ch = await interaction.client.channels.fetch(targetId);
        msg = await ch.send({
          embeds: [buildEmbed(kandidat)],
          components: buildComponents(eventId, kandidat),
        });
      } catch (e) {
        hapusKostumEvent(eventId); // gagal kirim: bersihkan sesi, jangan ninggalin sampah
        return balasEphemeral(
          interaction,
          `Gagal kirim pesan vote ke channel <#${targetId}>. Cek izin bot di sana. (${e && e.message ? e.message : e})`
        );
      }
      stmt.setKostumMessage.run(msg.id, eventId);
      return balasEphemeral(
        interaction,
        `Sesi vote jalan di <#${targetId}>. Kandidat masih 1, 2, 3 — ganti ke nama asli pakai:\n/kostum ganti nomor:1 nama:Nama Kostum\nTambah kandidat: /kostum tambah nama:... • Tutup + umumkan hasil: /kostum tutup`
      );
    }

    // Subcommand kelola butuh sesi yang ada
    const evAktif = stmt.getKostumEventAktif.get(guildId);

    if (sub === 'tambah') {
      if (!evAktif) return balasEphemeral(interaction, 'Belum ada sesi vote yang buka. Mulai dulu pakai /kostum mulai.');
      if (!bolehKelola(interaction, evAktif)) return balasEphemeral(interaction, 'Cuma operator vote yang bisa ngatur kandidat.');
      const nama = bersihkanNama(interaction.options.getString('nama'));
      if (!nama) return balasEphemeral(interaction, 'Namanya kosong — tulis dulu nama kostumnya.');
      const kandidat = stmt.getKostumKandidat.all(evAktif.id);
      if (kandidat.length >= MAX_KANDIDAT) return balasEphemeral(interaction, `Kandidat udah mentok ${MAX_KANDIDAT}. Hapus/reset sesi dulu kalau mau ubah total.`);
      const nomor = kandidat.length + 1;
      stmt.insertKostumKandidat.run(evAktif.id, nomor, nama);
      const baru = stmt.getKostumKandidat.all(evAktif.id);
      await editPesanEvent(interaction.client, evAktif, {
        embeds: [buildEmbed(baru)],
        components: buildComponents(evAktif.id, baru),
      });
      return balasEphemeral(interaction, `Kandidat ${nomor} masuk: ${nama}. Pesan vote di channel udah diupdate.`);
    }

    if (sub === 'ganti') {
      if (!evAktif) return balasEphemeral(interaction, 'Belum ada sesi vote yang buka. Mulai dulu pakai /kostum mulai.');
      if (!bolehKelola(interaction, evAktif)) return balasEphemeral(interaction, 'Cuma operator vote yang bisa ngatur kandidat.');
      const nomor = interaction.options.getInteger('nomor');
      const nama = bersihkanNama(interaction.options.getString('nama'));
      const kandidat = stmt.getKostumKandidatNomor.get(evAktif.id, nomor);
      if (!kandidat) return balasEphemeral(interaction, `Nomor ${nomor} gak ada. Kandidat yang ada: ${stmt.getKostumKandidat.all(evAktif.id).map((k) => k.nomor).join(', ')}.`);
      if (!nama) return balasEphemeral(interaction, 'Namanya kosong — tulis dulu nama barunya.');
      stmt.updateKostumKandidatNama.run(nama, evAktif.id, nomor);
      const baru = stmt.getKostumKandidat.all(evAktif.id);
      await editPesanEvent(interaction.client, evAktif, {
        embeds: [buildEmbed(baru)],
        components: buildComponents(evAktif.id, baru),
      });
      return balasEphemeral(interaction, `Kandidat ${nomor} sekarang: ${nama}. Pesan vote di channel udah diupdate.`);
    }

    if (sub === 'cek') {
      if (!evAktif) return balasEphemeral(interaction, 'Gak ada sesi vote yang buka. Kalau udah ditutup, hasilnya ada di channel vote.');
      const hasil = stmt.getKostumHasil.all(evAktif.id);
      return balasEphemeral(
        interaction,
        ['Suara sementara (anonim):', ...hasil.map((h) => `${h.nomor}. ${h.nama} — ${h.suara} suara`)].join('\n')
      );
    }

    if (sub === 'tutup') {
      if (!evAktif) return balasEphemeral(interaction, 'Gak ada sesi vote yang buka (mungkin udah ditutup).');
      if (!bolehKelola(interaction, evAktif)) return balasEphemeral(interaction, 'Cuma operator vote yang bisa nutup sesi.');
      stmt.tutupKostumEvent.run(evAktif.id);
      const hasil = stmt.getKostumHasilUrut.all(evAktif.id);
      await editPesanEvent(interaction.client, evAktif, {
        embeds: [buildEmbedDitutup()],
        components: [],
      });
      try {
        const ch = await interaction.client.channels.fetch(evAktif.channel_id);
        await ch.send({ embeds: [buildEmbedHasil(hasil)] });
      } catch (_) {
        return balasEphemeral(interaction, 'Sesi ditutup, tapi pengumuman hasil gagal dikirim ke channel (cek izin bot). Hasil: ' + hasil.map((h) => `${h.nama} ${h.suara}`).join(', '));
      }
      return balasEphemeral(interaction, 'Sesi vote ditutup dan hasil udah diumumkan di channel. Suara terkunci.');
    }

    if (sub === 'ulang') {
      const ev = evAktif || stmt.getKostumEventTerakhir.get(guildId);
      if (!ev) return balasEphemeral(interaction, 'Belum pernah ada sesi vote di server ini.');
      if (!bolehKelola(interaction, ev)) return balasEphemeral(interaction, 'Cuma operator vote yang bisa reset sesi.');
      return balasEphemeral(
        interaction,
        `Hapus sesi vote nomor ${ev.id} beserta SEMUA suara yang masuk? Ini gak bisa dibatalin.`
      ).then(async () => {
        const { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
        await interaction.followUp({
          content: 'Yakin reset?',
          flags: MessageFlags.Ephemeral,
          components: [
            new AR().addComponents(
              new BB().setCustomId(`kostum:resetya:${ev.id}`).setLabel('Ya, hapus semua').setStyle(BS.Danger),
              new BB().setCustomId(`kostum:resetno:${ev.id}`).setLabel('Batal').setStyle(BS.Secondary)
            ),
          ],
        });
      });
    }

    return balasEphemeral(interaction, 'Subcommand gak dikenal.');
  },

  // Tombol: kostum:vote:<eventId>:<nomor> | kostum:resetya:<eventId> | kostum:resetno:<eventId>
  async handleButton(interaction) {
    const parts = interaction.customId.split(':');
    const aksi = parts[1];
    const eventId = Number(parts[2]);

    if (aksi === 'vote') {
      const ev = stmt.getKostumEvent.get(eventId);
      if (!ev || ev.guild_id !== interaction.guildId) {
        return balasEphemeral(interaction, 'Sesi vote ini gak ada.');
      }
      if (ev.status !== 'open') {
        return balasEphemeral(interaction, 'Sesi vote ini udah ditutup. Terima kasih udah ikut!');
      }
      const nomor = Number(parts[3]);
      const kandidat = stmt.getKostumKandidatNomor.get(ev.id, nomor);
      if (!kandidat) return balasEphemeral(interaction, 'Nomor kandidat gak ada.');

      const lama = stmt.getKostumVoteUser.get(ev.id, interaction.user.id);
      stmt.upsertKostumVote.run(ev.id, interaction.user.id, nomor);
      if (lama && lama.nomor === nomor) {
        return balasEphemeral(interaction, `Votemu udah ke kandidat ini dari tadi. Suaramu tetap dirahasiakan.`);
      }
      if (lama) {
        const lamaK = stmt.getKostumKandidatNomor.get(ev.id, lama.nomor);
        return balasEphemeral(interaction, `Votemu diubah: ${lamaK ? lamaK.nama : 'kandidat ' + lama.nomor} ke **${kandidat.nama}**. Suaramu dirahasiakan.`);
      }
      return balasEphemeral(interaction, `Votemu kecatat buat **${kandidat.nama}**. Identitas pemilih gak ditampilkan ke siapa pun.`);
    }

    if (aksi === 'resetya') {
      const ev = stmt.getKostumEvent.get(eventId);
      if (!ev) return balasEphemeral(interaction, 'Sesinya udah gak ada.');
      if (!bolehKelola(interaction, ev)) return balasEphemeral(interaction, 'Cuma operator vote yang bisa reset.');
      await editPesanEvent(interaction.client, ev, {
        content: 'Sesi vote ini dibatalkan.',
        embeds: [],
        components: [],
      });
      hapusKostumEvent(ev.id);
      return balasEphemeral(interaction, 'Sesi vote dihapus bersih — kandidat dan semua suara hilang. Mulai baru pakai /kostum mulai.');
    }

    if (aksi === 'resetno') {
      return interaction.update({ content: 'Batal — sesi gak dihapus.', components: [] });
    }

    return balasEphemeral(interaction, 'Aksi gak dikenal.');
  },
};
