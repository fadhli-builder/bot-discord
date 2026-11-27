// Tes sekali-kirim rekap saham — login sesi pendek terpisah, gak ganggu
// cron harian yang jalan di pm2. Pemakaian: node src/stock-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimRekap } = require('./stock-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let ok = false;
  try {
    ok = await kirimRekap(c);
    console.log(ok ? 'TES SAHAM: terkirim' : 'TES SAHAM: gagal (cek log bot)');
  } catch (e) {
    console.error('TES SAHAM GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(ok ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
