require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { stmt, hapusKostumEvent } = require('./db');
const { buildEmbed, buildComponents } = require('./commands/kostum');

// Uji sekali pakai: buat sesi vote kostum + kirim pesan votenya ke channel.
// Sesi dibuat "atas nama" owner guild biar dia bisa langsung kelola pakai /kostum.
// Pakai: node src/kostum-test.js <channelId>

const CHANNEL_ID = process.argv[2];
if (!CHANNEL_ID) {
  console.error('Pemakaian: node src/kostum-test.js <channelId>');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async (c) => {
  try {
    const ch = await client.channels.fetch(CHANNEL_ID);
    if (!ch || !ch.guild) throw new Error('Channel bukan channel guild teks');
    const guildId = ch.guild.id;

    const aktif = stmt.getKostumEventAktif.get(guildId);
    if (aktif) {
      console.log(`SUDAH-AKTIF: sesi ${aktif.id} masih buka (channel ${aktif.channel_id}) — gak bikin dobel. EXIT:1`);
      await client.destroy();
      process.exit(1);
    }

    const ownerId = ch.guild.ownerId;
    const info = stmt.insertKostumEvent.run(guildId, CHANNEL_ID, ownerId);
    const eventId = info.lastInsertRowid;
    for (let i = 1; i <= 3; i++) stmt.insertKostumKandidat.run(eventId, i, `Kostum ${i}`);
    const kandidat = stmt.getKostumKandidat.all(eventId);

    const msg = await ch.send({
      embeds: [buildEmbed(kandidat)],
      components: buildComponents(eventId, kandidat),
    });
    stmt.setKostumMessage.run(msg.id, eventId);

    console.log(`Sesi ${eventId} terkirim ke #${ch.name} (pesan ${msg.id}, dikelola owner ${ownerId})`);
    console.log('EXIT:0');
    await client.destroy();
    process.exit(0);
  } catch (e) {
    console.error('Gagal:', e && e.message ? e.message : e);
    console.log('EXIT:1');
    try { await client.destroy(); } catch (_) {}
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
