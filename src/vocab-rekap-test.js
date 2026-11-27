// Tes sekali-kirim rekap mingguan vocab — login sesi pendek terpisah,
// gak ganggu cron harian yang jalan di pm2.
// Pemakaian: VOCAB_RECAP_FORCE=1 node src/vocab-rekap-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimRekapMingguan } = require('./vocab-rekap');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let hasil = { status: 'gagal', pesan: 'tidak jalan' };
  try {
    hasil = await kirimRekapMingguan(c);
    console.log('TES REKAP:', JSON.stringify(hasil));
  } catch (e) {
    console.error('TES REKAP GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(hasil.status === 'terkirim' ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
