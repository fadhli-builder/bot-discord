const { log } = require('./log');
const { stmt } = require('./db');

// Info film harian jam 19:00 WIB — film yang lagi RAME di Indonesia dengan
// rating IMDb bagus. Sumber: GraphQL publik JustWatch (locale Indonesia),
// riset live 2026-11-01 dari server: popularTitles sortBy TRENDING +
// filter objectTypes [MOVIE] -> 200 OK, poster images.justwatch.com 200 webp.
// Tanpa API key, tanpa chat model — murni data.
// Dedupe: tabel film_log; catatan kedaluwarsa 14 hari -> film lama boleh
// muncul lagi kalau masih trending setelah 2 minggu.
const CHANNEL_ID = process.env.FILM_CHANNEL_ID;

const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36';
const JUMLAH_KIRIM = 5; // film per pengiriman
const MIN_RATING = 7.0; // batas "rating bagus" versi IMDb
const POSTER_PROFILE = 's332'; // ukuran poster JustWatch yang terverifikasi 200

const GRAPHQL_URL = 'https://apis.justwatch.com/graphql';
const QUERY = `query {
  popularTitles(country: "ID", first: 100, sortBy: TRENDING, filter: { objectTypes: [MOVIE] }) {
    edges { node {
      objectId
      content(country: "ID", language: "id") {
        title originalReleaseYear fullPath posterUrl shortDescription
        scoring { imdbScore }
        genres { shortName translation(language: "id") }
      }
    } }
  }
}`;

async function ambilFilmTrending() {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`JustWatch HTTP ${res.status}`);
  const j = await res.json();
  if (j.errors && j.errors.length) throw new Error(`JustWatch GraphQL: ${j.errors[0].message}`);
  const edges = j && j.data && j.data.popularTitles && j.data.popularTitles.edges;
  if (!Array.isArray(edges) || edges.length === 0) throw new Error('JustWatch: daftar film kosong');

  const films = [];
  for (const e of edges) {
    const c = e && e.node && e.node.content;
    if (!c || !c.fullPath) continue;
    const skor = c.scoring && typeof c.scoring.imdbScore === 'number' ? c.scoring.imdbScore : null;
    if (skor === null || skor < MIN_RATING) continue; // cuma yang ratingnya bagus
    const genre = (c.genres || [])
      .map((g) => (g && (g.translation || g.shortName)) || '')
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    films.push({
      id: String(e.node.objectId),
      judul: String(c.title || 'Tanpa judul'),
      tahun: c.originalReleaseYear || '',
      skor,
      genre,
      desk: String(c.shortDescription || '').trim(),
      url: 'https://www.justwatch.com' + c.fullPath,
      poster: c.posterUrl
        ? 'https://images.justwatch.com' +
          c.posterUrl.replace('{profile}', POSTER_PROFILE).replace('{format}', 'webp')
        : null,
    });
  }
  if (!films.length) throw new Error(`JustWatch: tidak ada film dengan IMDb >= ${MIN_RATING}`);
  return films;
}

function kartuFilm(f, urutan) {
  const e = {
    color: 0xe50914,
    title: `${urutan}. ${f.judul}${f.tahun ? ` (${f.tahun})` : ''}`.slice(0, 250),
    url: f.url,
    description:
      `IMDb ${f.skor.toFixed(1)}/10${f.genre ? ' • ' + f.genre : ''}` +
      (f.desk ? `\n\n${f.desk.slice(0, 180)}` : ''),
  };
  if (f.poster) e.thumbnail = { url: f.poster }; // gagal load poster -> embed tetap tampil
  return e;
}

async function kirimFilm(client) {
  try {
    if (!CHANNEL_ID) throw new Error('FILM_CHANNEL_ID belum diisi di .env');

    const films = await ambilFilmTrending();
    films.sort((a, b) => b.skor - a.skor); // rating tertinggi dulu

    // bersihin catatan >14 hari biar film lama boleh muncul lagi
    stmt.deleteFilmLama.run();

    const belumTerkirim = films.filter((f) => !stmt.getFilmTerkirim.get(f.id));
    // tandai semua yang keambil hari ini, biar gak dikirim dobel besok
    for (const f of films) stmt.insertFilmLog.run(f.id);

    if (belumTerkirim.length === 0) {
      log('Film: tidak ada film baru yang layak kirim hari ini');
      return true;
    }

    const dipilih = belumTerkirim.slice(0, JUMLAH_KIRIM);
    const embeds = dipilih.map((f, i) => kartuFilm(f, i + 1));
    const ch = await client.channels.fetch(CHANNEL_ID);
    await ch.send({
      content:
        '**Film Terbaik yang Lagi Rame di Indonesia**\n' +
        'Pilihan dari film paling dicari minggu ini versi JustWatch — diurut dari rating IMDb tertinggi:',
      embeds,
    });
    log(`Film: ${dipilih.length} film terkirim ke #${ch.name ?? CHANNEL_ID}`);
    return true;
  } catch (e) {
    log(`Film cron error: ${e && e.stack ? e.stack : e}`);
    return false;
  }
}

function msSampaiJam19WIB() {
  const now = new Date(Date.now() + WIB); // geser biar angka UTC = jam dinding WIB
  const target = new Date(now);
  target.setUTCHours(19, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

module.exports = function startFilmCron(client) {
  function jadwalkan() {
    const delay = msSampaiJam19WIB();
    log(`Film cron aktif: kirim berikutnya ${Math.round(delay / 60000)} menit lagi (jam 19:00 WIB)`);
    setTimeout(async () => {
      await kirimFilm(client);
      jadwalkan(); // pasang ulang timer, biar selalu pas 19:00 WIB
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimFilm = kirimFilm;
