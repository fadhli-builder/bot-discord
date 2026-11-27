require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { stmt } = require('./db');
const { buildEmbed, buildComponents } = require('./commands/kostum');

// Sekali pakai: isi 8 nama peserta ke sesi vote kostum.
// Kalau ada sesi OPEN -> isi/update ke situ + edit pesan vote.
// Kalau gak ada sesi open -> bikin sesi BARU langsung 8 nama.
// Pakai: node src/kostum-isi-nama.js

const NAMA = ['Onie', 'Arma', 'Cobrr', 'Rezz', 'Sano', 'Nuy', 'Pedel', 'Sia'];
const GUILD_ID = '1519026001357705236';
const CHANNEL_ID = '1566041784889516103';
const OPERATOR = '703608175370436729';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isiNama(eventId) {
  const sudah = stmt.getKostumKandidat.all(eventId);
  for (let i = 0; i < NAMA.length; i++) {
    const nomor = i + 1;
    const ada = sudah.find((k) => k.nomor === nomor);
    if (ada) stmt.updateKostumKandidatNama.run(NAMA[i], eventId, nomor);
    else stmt.insertKostumKandidat.run(eventId, nomor, NAMA[i]);
  }
  return stmt.getKostumKandidat.all(eventId);
}

client.once('ready', async () => {
  try {
    let ev = stmt.getKostumEventAktif.get(GUILD_ID);

    if (ev) {
      // Sesi buka ada: isi nama ke situ, edit pesan votenya.
      const kandidat = isiNama(ev.id);
      if (ev.message_id) {
        const ch = await client.channels.fetch(ev.channel_id);
        const msg = await ch.messages.fetch(ev.message_id);
        await msg.edit({ embeds: [buildEmbed(kandidat)], components: buildComponents(ev.id, kandidat) });
        console.log(`OK: nama diisi ke sesi ${ev.id} (pesan ${msg.id} di #${ch.name})`);
      } else {
        console.log(`OK: nama diisi ke sesi ${ev.id} (tanpa pesan — sesi ini gak punya message_id)`);
      }
      console.log(kandidat.map((k) => `${k.nomor}. ${k.nama}`).join('\n'));
    } else {
      // Gak ada sesi buka: bikin baru langsung dengan 8 nama.
      const info = stmt.insertKostumEvent.run(GUILD_ID, CHANNEL_ID, OPERATOR);
      const eventId = info.lastInsertRowid;
      NAMA.forEach((nama, i) => stmt.insertKostumKandidat.run(eventId, i + 1, nama));
      const kandidat = stmt.getKostumKandidat.all(eventId);
      const ch = await client.channels.fetch(CHANNEL_ID);
      const msg = await ch.send({ embeds: [buildEmbed(kandidat)], components: buildComponents(eventId, kandidat) });
      stmt.setKostumMessage.run(msg.id, eventId);
      console.log(`OK: sesi BARU ${eventId} LIVE di #${ch.name} (pesan ${msg.id})`);
      console.log(kandidat.map((k) => `${k.nomor}. ${k.nama}`).join('\n'));
    }

    await client.destroy();
    process.exit(0);
  } catch (e) {
    console.error('Gagal:', e && e.message ? e.message : e);
    try { await client.destroy(); } catch (_) {}
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
