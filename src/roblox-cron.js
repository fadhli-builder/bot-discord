const { log } = require('./log');

// Info game Roblox harian jam 18:00 WIB — TIGA seksi dalam satu siaran:
// 1) HYPE: sort "Top Trending" (lonjakan pemain mingguan, region Indonesia otomatis)
// 2) MAIN RAMEAN: sort resmi "Fun with Friends" — game seru dimainkan bareng
// teman (party kecil 2-6 orang), diurut dari yang paling rame
// 3) HOROR: omni-search kata "horror", diurut dari yang paling rame
// Riset live 2026-10-14 dari server: explore-api, search-api, thumbnails —
// semuanya 200 OK tanpa auth. Ikon game via thumbnails API (batch).
const CHANNEL_ID = process.env.ROBLOX_CHANNEL_ID;

const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36';
const JUMLAH_TRENDING = 6;
const JUMLAH_RAMEAN = 4;
const JUMLAH_HORROR = 4;
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, timeoutMs = 15_000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url.split('?')[0]}`);
  return res.json();
}

// --- Ambil daftar game dari salah satu sort eksplorasi Roblox ---
async function ambilSort(sortId) {
  const sessionId = 'kenalbot-' + Date.now();
  const sorts = (await fetchJSON(
    `https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sessionId}`)).sorts || [];
  const sort = sorts.find(s => s.contentType === 'Games' && s.sortId === sortId);
  if (!sort) throw new Error(`sort "${sortId}" tidak ditemukan`);
  const j = await fetchJSON(
    `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${sessionId}&sortId=${sort.sortId}`);
  const games = (j.games || []).filter(g => !g.isSponsored && g.universeId);
  if (!games.length) throw new Error(`sort "${sortId}": daftar kosong`);
  return games;
}

const ambilTrending = () => ambilSort('top-trending');
const ambilRamean = () => ambilSort('fun-with-friends');

// --- Horor: cari kata "horror" di omni-search Roblox ---
async function ambilHoror() {
  const sessionId = 'kenalbot-' + Date.now();
  const j = await fetchJSON(
    `https://apis.roblox.com/search-api/omni-search?searchQuery=horror&pageToken=&sessionId=${sessionId}&pageType=all`);
  const semua = [];
  for (const grup of (j.searchResults || [])) {
    if (grup.contentGroupType !== 'Game') continue;
    for (const g of (grup.contents || [])) {
      if (g && g.universeId && !g.isSponsored) semua.push(g);
    }
  }
  // buang duplikat antar grup
  const unik = new Map();
  for (const g of semua) if (!unik.has(g.universeId)) unik.set(g.universeId, g);
  if (unik.size === 0) throw new Error('omni-search horror: hasil kosong');
  return [...unik.values()].sort((a, b) => (b.playerCount || 0) - (a.playerCount || 0));
}

// Ikon game — kalau gagal, embed tetap dikirim tanpa thumbnail (degradasi halus)
async function ambilIkon(universeIds) {
  try {
    const j = await fetchJSON(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(',')}&size=256x256&format=Png`);
    const map = {};
    ((j && j.data) || []).forEach(d => {
      if (d.state === 'Completed' && d.imageUrl) map[d.targetId] = d.imageUrl;
    });
    return map;
  } catch {
    return {};
  }
}

const angka = n => new Intl.NumberFormat('id-ID').format(n || 0);

// Satu embed = satu game
function kartuGame(g, warna, { tampilPembuat = false } = {}) {
  const totalVote = (g.totalUpVotes || 0) + (g.totalDownVotes || 0);
  const like = totalVote ? Math.round((g.totalUpVotes / totalVote) * 100) : 0;
  let desk =
    `${angka(g.playerCount)} pemain aktif\n` +
    `${like}% suka • ${g.genreL1 || '-'}`;
  if (tampilPembuat && g.creatorName) desk += `\n oleh ${g.creatorName}`;
  if (g.ageRecommendationDisplayName) desk += `\n${g.ageRecommendationDisplayName}`;
  const e = {
    color: warna,
    title: String(g.name).slice(0, 250),
    url: `https://www.roblox.com/games/${g.rootPlaceId}`,
    description: desk,
  };
  return e;
}

function msSampaiJam18WIB() {
  const now = new Date(Date.now() + WIB); // geser biar angka UTC = jam dinding WIB
  const target = new Date(now);
  target.setUTCHours(18, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

async function kirimRoblox(client) {
  try {
    if (!CHANNEL_ID) throw new Error('ROBLOX_CHANNEL_ID belum diisi di .env');

    // Ambil tiga sumber — yang gagal gak bikin seksi lain batal
    let trending = [], ramean = [], horor = [];
    const gagal = [];
    try { trending = (await ambilTrending()).slice(0, JUMLAH_TRENDING); }
    catch (e) { gagal.push(`hype: ${e.message}`); }
    try { ramean = [...(await ambilRamean())].sort((a, b) => (b.playerCount || 0) - (a.playerCount || 0)).slice(0, JUMLAH_RAMEAN); }
    catch (e) { gagal.push(`ramean: ${e.message}`); }
    try { horor = (await ambilHoror()).slice(0, JUMLAH_HORROR); }
    catch (e) { gagal.push(`horor: ${e.message}`); }
    if (!trending.length && !ramean.length && !horor.length) {
      throw new Error('semua sumber gagal: ' + gagal.join(' | '));
    }
    if (gagal.length) log(`Roblox: sebagian sumber gagal (${gagal.join(' | ')}) — sisanya tetap dikirim`);

    const semuaId = [...trending, ...ramean, ...horor].map(g => g.universeId);
    const ikon = await ambilIkon(semuaId);

    const ch = await client.channels.fetch(CHANNEL_ID);

    // Pesan 1: game yang lagi hype
    if (trending.length) {
      const embeds = trending.map(g => {
        const e = kartuGame(g, 0x00A2FF);
        if (ikon[g.universeId]) e.thumbnail = { url: ikon[g.universeId] };
        return e;
      });
      await ch.send({
        content: '**Game Roblox yang Lagi HYPE Hari Ini**\nTop Trending minggu ini versi Roblox Indonesia — lonjakan pemain harian terbesar:',
        embeds,
      });
      await tidur(700);
    }

    // Pesan 2: game ramean bareng teman
    if (ramean.length) {
      const embeds = ramean.map(g => {
        const e = kartuGame(g, 0x2ECC71);
        if (ikon[g.universeId]) e.thumbnail = { url: ikon[g.universeId] };
        return e;
      });
      await ch.send({
        content: '**MAIN RAMEAN — Seru Dimainkan Bareng (Party Kecil 2–6 Orang)**\nRekomendasi "Fun with Friends" versi Roblox, diurut dari yang paling rame:',
        embeds,
      });
      await tidur(700);
    }

    // Pesan 3: game horor
    if (horor.length) {
      const embeds = horor.map(g => {
        const e = kartuGame(g, 0x8E44AD, { tampilPembuat: true });
        if (ikon[g.universeId]) e.thumbnail = { url: ikon[g.universeId] };
        return e;
      });
      await ch.send({
        content: '**HOROR SERU — Berani-beranian Bareng**\nGame horor paling rame hari ini (makin rame makin terpercaya, tapi tetap waswas):',
        embeds,
      });
    }

    log(`Roblox: terkirim — hype ${trending.length}, ramean ${ramean.length}, horor ${horor.length} ke #${ch.name ?? CHANNEL_ID}`);
    return true;
  } catch (e) {
    log(`Roblox cron error: ${e && e.stack ? e.stack : e}`);
    return false;
  }
}

module.exports = function startRobloxCron(client) {
  function jadwalkan() {
    const delay = msSampaiJam18WIB();
    log(`Roblox cron aktif: kirim berikutnya ${Math.round(delay / 60000)} menit lagi (jam 18:00 WIB)`);
    setTimeout(async () => {
      await kirimRoblox(client);
      jadwalkan(); // pasang ulang timer, biar selalu pas 18:00 WIB
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimRoblox = kirimRoblox;
