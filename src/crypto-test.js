// Tes sekali-kirim rekap crypto — login sesi pendek terpisah, gak ganggu
// cron harian yang jalan di pm2. Pemakaian: node src/crypto-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimRekap } = require('./crypto-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let ok = false;
  try {
    ok = await kirimRekap(c);
    console.log(ok ? 'TES CRYPTO: terkirim' : 'TES CRYPTO: gagal (cek log bot)');
  } catch (e) {
    console.error('TES CRYPTO GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(ok ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
