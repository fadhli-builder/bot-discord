// Tes sekali-kirim konten hadits pagi — login sesi pendek terpisah, gak ganggu
// cron harian yang jalan di pm2. Pemakaian: node src/hadist-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimHadist } = require('./hadist-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let hasil = { status: 'gagal', pesan: 'tidak jalan' };
  try {
    hasil = await kirimHadist(c);
    console.log('TES HADIST:', JSON.stringify(hasil));
  } catch (e) {
    console.error('TES HADIST GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(hasil.status === 'terkirim' ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
