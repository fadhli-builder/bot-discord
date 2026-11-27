// Tes sekali-kirim info film — login sesi pendek terpisah, gak ganggu
// cron harian yang jalan di pm2. Pemakaian: node src/film-test.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { kirimFilm } = require('./film-cron');

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', async () => {
  let ok = false;
  try {
    ok = await kirimFilm(c);
    console.log(ok ? 'TES FILM: terkirim' : 'TES FILM: gagal (cek log bot)');
  } catch (e) {
    console.error('TES FILM GAGAL:', e && e.stack ? e.stack : e);
  } finally {
    c.destroy();
    setTimeout(() => process.exit(ok ? 0 : 1), 500);
  }
});
c.login(process.env.DISCORD_TOKEN);
