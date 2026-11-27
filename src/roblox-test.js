// Tes sekali-kirim info game Roblox hype — login sesi pendek terpisah, gak
// ganggu cron harian yang jalan di pm2. Pemakaian: node src/roblox-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimRoblox } = require('./roblox-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let ok = false;
  try {
    ok = await kirimRoblox(c);
    console.log(ok ? 'TES ROBLOX: terkirim' : 'TES ROBLOX: gagal (cek log bot)');
  } catch (e) {
    console.error('TES ROBLOX GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(ok ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
