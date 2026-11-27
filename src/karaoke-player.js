// Pemutar musik voice: katalog Deezer (judul/artis/durasi resmi) + audio full
// SoundCloud (via yt-dlp). Mode musik murni — TANPA lirik/scroller (dicabut
// atas permintaan Bos, 2026-11-05). Satu sesi per guild — lagu baru menggantikan
// yang lama. Autoplay: setelah lagu selesai, bot cari lagu lain se-vibe/genre
// (acak, bukan yang sudah diputar) sampai dihentikan atau VC ditinggal kosong.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
} = require('@discordjs/voice');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { log } = require('./log');
const { bersihkanJudul, artisDariJudul, judulInti } = require('./karaoke-lyrics');

const YTDLP = '/usr/local/bin/yt-dlp';
const DURASI_MAX = 15 * 60; // 15 menit — buat karaoke cukup
const DURASI_MIN = 60; // skip snippet/preview pendek (hasil pencarian)
const DURASI_FILE_MIN = 40; // file hasil download lebih pendek dari ini = terpotong/DRM, buang
const SCREEN_MS = 15000; // update layar musik tiap 15 detik (timestamp maju, hemat rate limit)

// guildId → sesi aktif. genCounter: nomor unik tiap sesi — buat membatalkan
// autoplay lama yang masih in-flight pas user muter lagu baru.
const sesi = new Map();
let genCounter = 0;

function execYt(args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message).split('\n')[0].slice(0, 300)));
      resolve(stdout.trim());
    });
  });
}

function rapikanMeta(m) {
  return {
    id: m.id ? String(m.id) : null,
    url: m.webpage_url,
    judul: m.title || 'Tanpa judul',
    uploader: m.uploader || m.channel || '?',
    durasi: Math.round(m.duration || 0),
  };
}

// Cari beberapa kandidat lagu di SoundCloud sekaligus (buat dipilih acak).
// CATATAN: scsearch balikin wrapper playlist — lagu-lagunya di entries[].
// WAJIB -i (ignore-errors): satu lagu DRM/berbayar di hasil pencarian gak boleh
// nge-gagal-kan seluruh pencarian — cukup di-skip dari daftar.
async function cariKandidat(query, n = 10) {
  const metaRaw = await execYt(['-i', '-J', '--no-warnings', '--no-playlist', query], 60000);
  let meta = JSON.parse(metaRaw);
  if (meta._type === 'playlist' && Array.isArray(meta.entries)) meta = meta.entries;
  if (!Array.isArray(meta)) meta = [meta];
  return meta
    .filter((m) => m && m.webpage_url && m._type !== 'playlist')
    .filter((m) => !m.duration || (m.duration >= DURASI_MIN && m.duration <= DURASI_MAX))
    .slice(0, n)
    .map(rapikanMeta);
}

// ===== Jalur "sejenis": related tracks SoundCloud =====
// Algoritma related = lagu lain yang mirip vibe/genrenya (bukan cuma se-artis) —
// Teh Hijau dilanjut indie se-vibe, Kendrick dilanjut hip hop.
let scClientId = null;

async function clientIdSoundcloud() {
  if (scClientId) return scClientId;
  const res = await fetch('https://soundcloud.com/', { signal: AbortSignal.timeout(10000) });
  const html = await res.text();
  const assets = [...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"'\\]+\.js/g)].map((m) => m[0]);
  for (const url of assets.slice(-8)) {
    try {
      const js = await (await fetch(url, { signal: AbortSignal.timeout(10000) })).text();
      const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{16,})"/);
      if (m) { scClientId = m[1]; return scClientId; }
    } catch (_) {}
  }
  throw new Error('client_id SoundCloud gak ketemu');
}

// Lagu se-jenis buat autoplay. riwayatCore = daftar judul inti yang udah diputar.
async function cariSejenis(trackId, riwayatCore) {
  const ambil = async () => {
    const cid = await clientIdSoundcloud();
    const res = await fetch(
      `https://api-v2.soundcloud.com/tracks/${trackId}/related?client_id=${cid}&limit=24`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (res.status === 401 || res.status === 403) { scClientId = null; throw new Error('client_id ditolak'); }
    if (!res.ok) throw new Error('related HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : data.collection || [];
  };
  let rows;
  try {
    rows = await ambil();
  } catch (e) {
    if (scClientId === null) rows = await ambil(); // client_id barusan di-null → ekstrak ulang sekali
    else throw e;
  }

  const mirip = (a, b) => a === b || (a.length > 5 && b.length > 5 && (a.includes(b) || b.includes(a)));
  const hasil = [];
  const dipakai = new Set();
  for (const r of rows) {
    if (!r || !r.permalink_url || !r.streamable) continue;
    if (r.policy === 'SNIPPET') continue; // preview berbayar/DRM
    const durasi = Math.round((r.full_duration || r.duration || 0) / 1000);
    if (durasi < DURASI_MIN || durasi > DURASI_MAX) continue;
    const inti = judulInti(r.title);
    if (!inti) continue;
    if (riwayatCore.some((x) => mirip(x, inti))) continue; // cover/mix lagu yang udah diputar
    if ([...dipakai].some((x) => mirip(x, inti))) continue; // varian sesama kandidat
    dipakai.add(inti);
    hasil.push({
      id: String(r.id),
      url: r.permalink_url,
      judul: r.title,
      uploader: r.user?.username || '?',
      durasi,
    });
    if (hasil.length >= 10) break;
  }
  return hasil;
}

// ===== Katalog Deezer (data resmi lagu) =====
// Deezer cuma nyediain DATA resmi (judul/artis/durasi) gratis tanpa key;
// audio-nya cuma preview 30 detik, makanya audio full tetap dari SoundCloud
// (satu-satunya sumber full yang gak keblokir dari server ini).
async function cariDeezer(q) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const t = (data.data || [])[0];
    if (!t || !t.title) return null;
    return {
      judul: t.title,
      artis: (t.artist && t.artist.name) || '?',
      durasi: Math.round(t.duration || 0),
      link: t.link,
    };
  } catch (_) {
    return null; // Deezer gagal/down → fallback pencarian SoundCloud polos
  }
}

// Resolve 1 lagu. Link SoundCloud langsung → resolve langsung di SC.
// Selain itu: katalog Deezer tentukan judul/artis/durasi resmi, lalu audio
// full dicari di SoundCloud dengan kunci "artis judul" + dicocokkan durasinya
// (±12%) biar yang diputar beneran lagu yang diminta, bukan cover/mix.
async function resolveLagu(query) {
  if (/^https?:\/\/(www\.)?soundcloud\.com\//.test(query)) {
    const daftar = await cariKandidat(query, 1);
    if (!daftar.length) throw new Error('Lagu gak ketemu — cek lagi link SoundCloud-nya');
    const lagu = daftar[0];
    if (lagu.durasi > DURASI_MAX) {
      throw new Error(`Lagu kepanjangan (${Math.round(lagu.durasi / 60)} menit), maksimal 15 menit`);
    }
    return lagu;
  }

  const bersih = String(query || '').replace(/^scsearch\d*:/, '').trim();
  const dz = await cariDeezer(bersih);
  const kunci = dz ? `${dz.artis} ${dz.judul}` : bersih;
  const daftar = await cariKandidat(`scsearch3:${kunci}`, 3);
  if (!daftar.length) {
    throw new Error('Lagu gak ketemu — coba judul + nama penyanyi, atau link SoundCloud langsung');
  }
  let pilih = daftar[0];
  if (dz && dz.durasi > 0) {
    const toleransi = Math.max(8, Math.round(dz.durasi * 0.12));
    const cocok = daftar
      .filter((k) => k.durasi > 0 && Math.abs(k.durasi - dz.durasi) <= toleransi)
      .sort((a, b) => Math.abs(a.durasi - dz.durasi) - Math.abs(b.durasi - dz.durasi));
    if (cocok.length) pilih = cocok[0];
  }
  if (pilih.durasi > DURASI_MAX) {
    throw new Error(`Lagu kepanjangan (${Math.round(pilih.durasi / 60)} menit), maksimal 15 menit`);
  }
  if (dz) pilih.artis = dz.artis; // artis resmi dari katalog — buat layar & autoplay
  return pilih;
}

// Durasi file audio (detik) via ffprobe; 0 kalau gak kebaca
function durasiFile(file) {
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
    return Number.parseFloat(out) || 0;
  } catch (_) {
    return 0;
  }
}

// Download audio ke file temp (playback lebih stabil daripada stream langsung).
// WAJIB --no-simulate: --print aja tanpa itu bikin yt-dlp cuma simulasi tanpa
// download beneran. Nama file diglob setelah selesai (after_move:FILEPATH gak selalu isi).
// File divalidasi ffprobe: lebih pendek dari DURASI_FILE_MIN = preview DRM/terpotong → error
// (kandidat di-skip, gak sampai diputar 8 detik lalu senyap).
async function downloadAudio(urlLagu) {
  const stamp = Date.now();
  const template = path.join('/tmp', `karaoke-${stamp}.%(ext)s`);
  await execYt([
    '--no-simulate',
    '-f', 'bestaudio/best',
    '-o', template,
    '--no-playlist', '--no-warnings',
    urlLagu,
  ], 180000);
  const files = fs.readdirSync('/tmp').filter((f) => f.startsWith(`karaoke-${stamp}.`));
  const file = files.length ? path.join('/tmp', files[0]) : null;
  if (!file || !fs.existsSync(file) || fs.statSync(file).size < 10000) {
    throw new Error('Download audio gagal');
  }
  const dur = durasiFile(file);
  if (dur < DURASI_FILE_MIN) {
    fs.promises.unlink(file).catch(() => {});
    throw new Error(`file cuma ${Math.round(dur)}s — preview DRM/terpotong, skip`);
  }
  return file;
}

function elapsedMusik(s) {
  return s.base + (s.paused ? 0 : Date.now() - s.mark);
}
function elapsedTotal(s) {
  return Math.max(0, elapsedMusik(s) + s.offsetMs);
}

function layarEmbed(s) {
  const ms = elapsedTotal(s);
  const menit = Math.floor(ms / 60000);
  const detik = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const total = s.lagu.durasi || 0;
  const totalStr = total
    ? `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    : '?';
  const artis = s.lagu.artis || s.lagu.uploader;
  return {
    title: `Lagu: ${s.lagu.judul}`,
    description: `**${artis}**\nDiputar di voice channel — selamat mendengarkan.`,
    color: 0x6a1b9a,
    footer: {
      text: `${menit}:${detik} / ${totalStr}${s.autoplay ? ' • autoplay nyala' : ''}`,
    },
  };
}

function tombolLayar() {
  const btn = (id, label) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Secondary);
  return [
    new ActionRowBuilder().addComponents(
      btn('karaoke:pp', 'Pause/Lanjut'),
      btn('karaoke:stop', 'Stop'),
      btn('karaoke:auto', 'Autoplay'),
    ),
  ];
}

// Perbarui layar lirik sekarang juga (dipakai timer & tombol)
async function updateLayar(guildId) {
  const s = sesi.get(guildId);
  if (!s || !s.pesanLayar) return;
  try {
    await s.pesanLayar.edit({ embeds: [layarEmbed(s)], components: tombolLayar() });
  } catch (_) { /* pesan kehapus dll — diamkan */ }
}

function bersihkan(guildId) {
  const s = sesi.get(guildId);
  if (!s) return;
  log(`Karaoke: sesi diakhiri — ${s.lagu.judul}`);
  if (s.timer) clearInterval(s.timer);
  try { s.player?.stop(true); } catch (_) {}
  try { s.conn?.destroy(); } catch (_) {}
  if (s.file) fs.promises.unlink(s.file).catch(() => {});
  sesi.delete(guildId);
}

// Jumlah manusia (bukan bot) yang masih di voice channel
function manusiaDiVC(s) {
  // Khusus tes transisi (default mati): bot diperbolehkan lanjut walpa sendirian
  if (process.env.KARAOKE_TEST_SKIP_VC_CHECK === '1') return 1;
  try {
    const vc = s.guild.channels.cache.get(s.conn.joinConfig.channelId);
    return vc ? vc.members.filter((m) => !m.user.bot).size : 0;
  } catch (_) {
    return 0;
  }
}

// Mainkan file di player sesi + reset jam & state lagu
async function putarkan(s, { lagu, file }) {
  if (s.file) fs.promises.unlink(s.file).catch(() => {});
  s.lagu = lagu;
  s.file = file;
  s.base = 0;
  s.mark = Date.now();
  s.paused = false;
  s.offsetMs = 0;
  s.lastIdx = -999;
  s.transisi = false;
  s.riwayat.push(judulInti(lagu.judul) || lagu.judul.toLowerCase());
  if (s.riwayat.length > 12) s.riwayat.shift();
  s.player.play(createAudioResource(file));
  await entersState(s.player, AudioPlayerStatus.Playing, 15000);
}

// Autoplay: cari lagu lain se-artis (acak, bukan yang sudah diputar),
// download, lanjutkan. Coba maksimal 3 kandidat sebelum menyerah.
async function cobaAutoplay(guildId, gen) {
  const s = sesi.get(guildId);
  if (!s || s.gen !== gen || !s.autoplay) return;
  if (manusiaDiVC(s) === 0) {
    log('Karaoke: VC kosong saat transisi, bot pamit');
    bersihkan(guildId);
    return;
  }
  try {
    if (s.pesanLayar) {
      await s.pesanLayar.edit({
        embeds: [{ title: 'Autoplay', description: 'Mencari lagu berikutnya...', color: 0x6a1b9a }],
        components: [],
      }).catch(() => {});
    }
    // Dua putaran pencarian: dulu se-artis, kalau mentok pakai kata kunci asli
    // (kunci dibersihkan dari prefix scsearch biar gak jadi 'scsearch10:scsearch1:...')
    const bersihKunci = (x) => String(x || '').replace(/^scsearch\d*:/, '').trim();
    const kunciList = [];
    if (s.artis) kunciList.push(bersihKunci(s.artis));
    const kunciQuery = bersihKunci(s.query);
    if (kunciQuery && kunciQuery !== bersihKunci(s.artis)) kunciList.push(kunciQuery);
    let sukses = false;

    // Putaran 0: lagu SEJENIS via related SoundCloud — beda lagu, se-vibe/genre
    if (s.lagu.id) {
      try {
        const kandidat = await cariSejenis(s.lagu.id, s.riwayat);
        for (const k of kandidat.slice(0, 3)) {
          if (sesi.get(guildId)?.gen !== gen) return; // user muter lagu baru — batal
          let file = null;
          try {
            file = await downloadAudio(k.url);
            const sNow = sesi.get(guildId);
            if (!sNow || sNow.gen !== gen) { fs.promises.unlink(file).catch(() => {}); return; }
            await putarkan(sNow, { lagu: k, file });
            log(`Karaoke autoplay (sejenis): ${k.judul}`);
            sukses = true;
            break;
          } catch (e) {
            if (file) fs.promises.unlink(file).catch(() => {});
            log(`Karaoke autoplay skip "${k.judul}": ${e.message}`);
          }
        }
      } catch (e) {
        log(`Karaoke autoplay: jalur sejenis gagal, pakai pencarian: ${e.message}`);
      }
    }

    for (const kunci of kunciList) {
      if (sesi.get(guildId)?.gen !== gen) return; // user muter lagu baru — batal
      let kandidat = [];
      try {
        kandidat = await cariKandidat(`scsearch10:${kunci}`, 10);
      } catch (e) {
        log(`Karaoke autoplay: pencarian "${kunci}" gagal total: ${e.message}`);
        continue; // lanjut ke kunci berikutnya, JANGAN langsung nyerah
      }
      const segar = kandidat.filter((k) => {
        const inti = judulInti(k.judul) || k.judul.toLowerCase();
        return !s.riwayat.some((x) => x === inti || (inti.length > 5 && x.length > 5 && (x.includes(inti) || inti.includes(x))));
      });
      // acak urutan biar tiap sesi beda
      for (let i = segar.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [segar[i], segar[j]] = [segar[j], segar[i]];
      }
      for (const k of segar.slice(0, 3)) {
        if (sesi.get(guildId)?.gen !== gen) return; // user muter lagu baru — batal
        let file = null;
        try {
          file = await downloadAudio(k.url);
          const sNow = sesi.get(guildId);
          if (!sNow || sNow.gen !== gen) { fs.promises.unlink(file).catch(() => {}); return; }
          await putarkan(sNow, { lagu: k, file });
          log(`Karaoke autoplay: ${k.judul}`);
          sukses = true;
          break;
        } catch (e) {
          if (file) fs.promises.unlink(file).catch(() => {}); // jangan nyangkut di /tmp
          log(`Karaoke autoplay skip "${k.judul}": ${e.message}`);
        }
      }
      if (sukses) break;
    }
    if (!sukses) throw new Error('semua kandidat gagal diputar');
    updateLayar(guildId);
  } catch (e) {
    log(`Karaoke autoplay berhenti: ${e.message}`);
    const sNow = sesi.get(guildId);
    if (!sNow || sNow.gen !== gen) return; // sesi udah diganti user — jangan ganggu sesi baru
    if (sNow.pesanLayar) {
      sNow.pesanLayar.edit({
        embeds: [{ title: 'Autoplay berhenti', description: 'Gak nemu lagu berikutnya yang bisa diputar. Terima kasih udah nyanyi!', color: 0x6a1b9a }],
        components: [],
      }).catch(() => {});
    }
    bersihkan(guildId);
  }
}

// Jalur utama: join VC → mainkan → kirim layar karaoke → scroller jalan.
async function mulaiKaraoke({ interaction, lagu, file, query }) {
  const guildId = interaction.guildId;
  bersihkan(guildId); // lagu lama (kalau ada) dimatikan

  const vcId = interaction.member?.voice?.channelId;
  if (!vcId) throw new Error('Harus di voice channel dulu!');

  const conn = joinVoiceChannel({
    channelId: vcId,
    guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  try {
    await entersState(conn, VoiceConnectionStatus.Ready, 20000);
  } catch (_) {
    bersihkan(guildId);
    throw new Error('Bot gagal masuk voice channel — cek izin Connect & Speak buat bot');
  }

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  conn.subscribe(player);

  // PENTING: mainkan lagu PERTAMA di sini — jalur autoplay cuma nge-play lagu
  // berikutnya pas lagu selesai, jadi tanpa ini bot cuma diam di VC.
  player.play(createAudioResource(file));
  try {
    await entersState(player, AudioPlayerStatus.Playing, 15000);
  } catch (_) {
    bersihkan(guildId);
    throw new Error('Audio gagal diputar (format gak didukung?)');
  }

  const sesiBaru = {
    conn, player, file,
    gen: ++genCounter, transisi: false,
    lagu,
    base: 0, mark: Date.now(), paused: false, offsetMs: 0,
    pesanLayar: null, timer: null, lastTeks: '',
    autoplay: true,
    riwayat: [judulInti(lagu.judul) || lagu.judul.toLowerCase()],
    // "jenis" lagu buat autoplay: artis resmi dari katalog Deezer dulu kalau ada,
    // lalu tebakan dari judul, fallback uploader
    artis: lagu.artis || (() => {
      const dariJudul = artisDariJudul(lagu.judul);
      if (dariJudul) return dariJudul;
      const bersih = bersihkanJudul(lagu.judul);
      const tebakan = (bersih.split(/\s[-–—]\s/)[0] || '').trim();
      return tebakan || bersih || lagu.uploader;
    })(),
    query: query || lagu.judul,
    guild: interaction.guild,
  };
  sesi.set(guildId, sesiBaru);

  player.on(AudioPlayerStatus.Idle, () => {
    const s = sesi.get(guildId);
    if (!s) return;
    if (s.autoplay) {
      // Bekuin jam lagu + tandai transisi: watchdog gak boleh bunuh sesi
      // selama bot nyari & download lagu berikutnya (bisa 30-60 detik).
      s.base += Date.now() - s.mark;
      s.paused = true;
      s.transisi = true;
      cobaAutoplay(guildId, s.gen);
    } else {
      log(`Karaoke: selesai — ${s.lagu.judul}`);
      bersihkan(guildId);
    }
  });
  conn.on('Disconnected', () => bersihkan(guildId));

  const layar = await interaction.editReply({
    embeds: [layarEmbed(sesiBaru)],
    components: tombolLayar(),
  });
  sesiBaru.pesanLayar = await layar.fetch();

  // Pembarui layar: timestamp maju tiap SCREEN_MS kalau teks footer berubah
  sesiBaru.timer = setInterval(() => {
    const s = sesi.get(guildId);
    if (!s || s.transisi) return; // lagi nyari lagu berikutnya — jangan dianggap nyangkut
    if (elapsedTotal(s) > (s.lagu.durasi + 90) * 1000) {
      log(`Karaoke: melewati durasi, sesi diakhiri — ${s.lagu.judul}`);
      return bersihkan(guildId);
    }
    const teks = layarEmbed(s).footer.text;
    if (teks === s.lastTeks) return;
    s.lastTeks = teks;
    updateLayar(guildId);
  }, SCREEN_MS);

  log(`Karaoke: memutar ${lagu.judul} — ${lagu.artis || lagu.uploader} (${lagu.durasi}s) di guild ${guildId}`);
  return sesiBaru;
}

// ===== Kontrol dari tombol =====
function getSesi(guildId) {
  return sesi.get(guildId) || null;
}
function togglePause(guildId) {
  const s = sesi.get(guildId);
  if (!s) return null;
  if (s.paused) {
    s.mark = Date.now();
    s.paused = false;
    s.player.unpause();
  } else {
    s.base += Date.now() - s.mark;
    s.paused = true;
    s.player.pause();
  }
  return s.paused;
}
function toggleAutoplay(guildId) {
  const s = sesi.get(guildId);
  if (!s) return null;
  s.autoplay = !s.autoplay;
  return s.autoplay;
}
function stop(guildId) {
  const s = sesi.get(guildId);
  if (!s) return false;
  bersihkan(guildId);
  return true;
}

module.exports = { resolveLagu, cariKandidat, cariDeezer, cariSejenis, downloadAudio, mulaiKaraoke, getSesi, togglePause, toggleAutoplay, stop, bersihkan, updateLayar };
