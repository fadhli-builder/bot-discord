// Tes sekali-kirim kuis vocab — login sesi pendek terpisah, gak ganggu
// cron harian yang jalan di pm2. Pemakaian: node src/vocab-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimVocab } = require('./vocab-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let ok = false;
  try {
    ok = await kirimVocab(c);
    console.log(ok ? 'TES VOCAB: terkirim' : 'TES VOCAB: gagal (cek log bot)');
  } catch (e) {
    console.error('TES VOCAB GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(ok ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
