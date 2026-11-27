require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Lengkapi dulu DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID di file .env');
  process.exit(1);
}

const commands = [];
const dir = path.join(__dirname, 'commands');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  commands.push(require(path.join(dir, f)).data.toJSON());
}

const rest = new REST().setToken(DISCORD_TOKEN);
(async () => {
  console.log(`Mendaftarkan ${commands.length} slash command ke guild ${GUILD_ID}...`);
  const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Berhasil didaftarkan:', data.map((c) => c.name).join(', '));
})().catch((e) => {
  console.error('Gagal mendaftarkan command:', e);
  process.exit(1);
});
