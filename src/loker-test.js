// Tes sekali-kirim info loker — login sesi pendek terpisah, gak ganggu
// cron harian yang jalan di pm2. Pemakaian: node src/loker-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimLoker } = require('./loker-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let ok = false;
  try {
    ok = await kirimLoker(c);
    console.log(ok ? 'TES LOKER: terkirim' : 'TES LOKER: gagal (cek log bot)');
  } catch (e) {
    console.error('TES LOKER GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(ok ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
