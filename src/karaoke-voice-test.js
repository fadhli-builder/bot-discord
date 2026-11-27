// Tes voice bot musik sekali-jalan: join VC pertama, resolve lewat jalur baru
// (katalog Deezer → audio SoundCloud), putar 8 detik, keluar. Gak ganggu bot
// pm2 (sesi pendek terpisah). Pemakaian: node src/karaoke-voice-test.js
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel, createAudioResource, createAudioPlayer,
  NoSubscriberBehavior, entersState, VoiceConnectionStatus, AudioPlayerStatus,
} = require('@discordjs/voice');
const { resolveLagu, downloadAudio } = require('./karaoke-player');

const c = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
c.once('ready', async () => {
  let file = null;
  try {
    const guild = c.guilds.cache.get(process.env.GUILD_ID);
    const vc = guild.channels.cache.filter((ch) => ch.isVoiceBased() && ch.id !== guild.afkChannelId).first();
    if (!vc) throw new Error('gak ada voice channel di guild');
    console.log('1) join VC:', vc.name);
    const conn = joinVoiceChannel({ channelId: vc.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true });
    await entersState(conn, VoiceConnectionStatus.Ready, 20000);
    console.log('   connection READY');
    console.log('2) resolve (Deezer → SoundCloud) + download lagu...');
    const lagu = await resolveLagu('Tulus Monokrom');
    file = await downloadAudio(lagu.url);
    console.log('   OK:', lagu.judul, '—', lagu.artis || lagu.uploader, '|', lagu.durasi + 's | file siap');
    console.log('3) putar audio...');
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    conn.subscribe(player);
    player.play(createAudioResource(file));
    await entersState(player, AudioPlayerStatus.Playing, 15000);
    console.log('   AUDIO PLAYING (8 detik, lalu stop)');
    await new Promise((r) => setTimeout(r, 8000));
    conn.destroy();
    fs.unlinkSync(file);
    console.log('TES VOICE OK');
    process.exit(0);
  } catch (e) {
    console.error('GAGAL:', e.message);
    try { if (file) fs.unlinkSync(file); } catch (_) {}
    process.exit(1);
  }
});
c.login(process.env.DISCORD_TOKEN);
