require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { log } = require('./log');

if (!process.env.DISCORD_TOKEN) {
  console.error('[FATAL] DISCORD_TOKEN belum diisi di file .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // Buat /love: pantau siapa aja yang aktif di server. Author pesan tetap kebaca
    // walpa tanpa MessageContent — dan MessageContent itu privileged (login bakal
    // ditolak portal kalau dipaksa), jadi sengaja gak dipakai.
    GatewayIntentBits.GuildMessages,
    // Buat /karaoke: pemutar voice butuh event voice state (bukan privileged).
    GatewayIntentBits.GuildVoiceStates,
  ],
});
client.commands = new Collection();

const cmdDir = path.join(__dirname, 'commands');
for (const f of fs.readdirSync(cmdDir).filter((x) => x.endsWith('.js'))) {
  const cmd = require(path.join(cmdDir, f));
  client.commands.set(cmd.data.name, cmd);
}
log(`Dimuat ${client.commands.size} command: ${[...client.commands.keys()].join(', ')}`);

client.once(Events.ClientReady, (c) => {
  log(`Bot online sebagai ${c.user.tag}`);
  require('./cron-expired')(client);
  require('./crypto-cron')(client); // rekap crypto harian jam 07:00 WIB
  require('./stock-cron')(client); // rekap saham harian (AS+IDX) jam 07:30 WIB
  require('./loker-cron')(client); // info loker Indonesia harian jam 09:00 WIB
  require('./film-cron')(client); // info film trending + rating bagus harian jam 19:00 WIB
  require('./roblox-cron')(client); // info game Roblox hype harian jam 18:00 WIB
  require('./vocab-cron')(client); // kuis kosa kata harian jam 07:00 WIB
  require('./vocab-rekap')(client); // rekap papan skor vocab mingguan, Minggu 19:00 WIB
  require('./hadist-cron')(client); // one day one hadith — konten pagi jam 06:00 WIB
  require('./commands/love').init(client); // panasin cache member /love pas bot nyala
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash command
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction);
      return;
    }
    // Modal (form) — routing via customId "nama-command:aksi"
    if (interaction.isModalSubmit()) {
      const cmd = client.commands.get(interaction.customId.split(':')[0]);
      if (cmd && typeof cmd.handleModal === 'function') await cmd.handleModal(interaction);
      return;
    }
    // Tombol — routing via customId "nama-command:aksi:id"
    if (interaction.isButton()) {
      const cmd = client.commands.get(interaction.customId.split(':')[0]);
      if (cmd && typeof cmd.handleButton === 'function') await cmd.handleButton(interaction);
    }
  } catch (err) {
    log(`ERROR interaction: ${err && err.stack ? err.stack : err}`);
    const payload = { content: 'Waduh, ada error di sisi server. Coba lagi sebentar lagi ya!', ephemeral: true };
    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
      }
    } catch (_) { /* diamkan, jangan crash */ }
  }
});

process.on('unhandledRejection', (r) => log('unhandledRejection:', r));
process.on('uncaughtException', (e) => {
  log('uncaughtException:', e && e.stack ? e.stack : e);
  process.exit(1);
});

client.login(process.env.DISCORD_TOKEN);
