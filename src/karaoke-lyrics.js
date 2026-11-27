// Lirik karaoke dari lrclib.net (gratis, tanpa API key).
// LRC ber-timestamp di-parse jadi [{t, baris}] untuk scroller sinkron musik.
//
// Judul dari SoundCloud sering kotor: "Teh hijauby Tulus",
// "Sedia Aku Sebelum Hujan Idgitaf.mp3", "LAGU (Official Audio)" —
// jadi sebelum nyari ke lrclib, judul dibersihkan + dicoba beberapa varian.

const API = 'https://lrclib.net/api';

function parseLRC(text) {
  if (!text) return null;
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (m) {
      out.push({
        t: Number(m[1]) * 60000 + Math.round(parseFloat(m[2]) * 1000),
        baris: m[3].trim(),
      });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out.length ? out : null;
}

// Buang ekstensi file, tag [..]/(..), emoji, kata klip (official/lirik/...), "by X" di ekor
function bersihkanJudul(raw) {
  let t = String(raw || '');
  t = t.replace(/\.(mp3|mp4|m4a|wav|flac|ogg)\b/gi, ' ');
  t = t.replace(/[\[\(（]([^)\]]*)[\]\)）]/g, ' '); // (Official Video) [Lyrics] dll
  t = t.replace(/\bby\s+[^|\-–—]+$/i, ' ');
  t = t.replace(/\bfeat\.?\b|\bft\.?\b/gi, '-');
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, ' ');
  t = t.replace(/\b(lirik|lyrics|lyric|karaoke|full audio|official audio|official music video|audio\s+saja|video)\b/gi, ' ');
  return t.replace(/\s{2,}/g, ' ').trim();
}

function bersihkanArtis(raw) {
  let t = String(raw || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, ' ')
    .replace(/^by\s+/i, '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t;
}

// Ambil kandidat artis yang menempel di judul: "... by Tulus" / "TULUS - Monokrom"
function artisDariJudul(raw) {
  const t = String(raw || '');
  let m = t.match(/\bby\s+([^|\-–—]+)$/i);
  if (m) return bersihkanArtis(m[1]);
  const dash = bersihkanJudul(t).split(/\s[-–—]\s/);
  if (dash.length === 2) return bersihkanArtis(dash[0]);
  return '';
}

// Daftar judul buat dicoba: bersih, sisi kanan dash, buang kata terakhir
// (nama artis sering nempel di ekor: "...Sebelum Hujan Idgitaf"), sisi kiri dash.
function varianJudul(raw) {
  const bersih = bersihkanJudul(raw);
  const set = new Set([bersih]);
  const dash = bersih.split(/\s[-–—]\s/);
  if (dash.length === 2) {
    set.add(dash[1].trim());
    set.add(dash[0].trim());
  }
  const kata = bersih.split(' ');
  if (kata.length >= 4) set.add(kata.slice(0, -1).join(' '));
  set.delete('');
  return [...set];
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length ? data : null;
  } catch (_) {
    return null;
  }
}

// Pilih baris terbaik: yang artisnya cocok & punya synced > synced apa pun > plain apa pun
function pilihBaris(rows, artiss) {
  const artisLower = artiss.filter(Boolean).map((a) => a.toLowerCase());
  const cocok = (r) => artisLower.some((a) => (r.artistName || '').toLowerCase().includes(a));
  return (
    rows.find((r) => r.syncedLyrics && cocok(r)) ||
    rows.find((r) => r.syncedLyrics) ||
    rows.find((r) => r.plainLyrics && cocok(r)) ||
    rows.find((r) => r.plainLyrics) ||
    rows[0]
  );
}

async function bungkus(hasil) {
  if (!hasil) return null;
  return {
    synced: parseLRC(hasil.syncedLyrics),
    plain: hasil.plainLyrics || null,
    judul: hasil.trackName,
    artis: hasil.artistName,
  };
}

// Cari lirik dengan multi-varian judul × artis. Return null kalau benar-benar absen.
async function cariLirik(judul, artis) {
  const juduls = varianJudul(judul);
  const artiss = [...new Set([bersihkanArtis(artis), artisDariJudul(judul), ''])];
  const enc = encodeURIComponent;
  let fallback = null;

  for (const j of juduls) {
    if (!j) continue;
    for (const a of artiss) {
      let rows = await fetchJson(
        `${API}/search?track_name=${enc(j)}${a ? `&artist_name=${enc(a)}` : ''}`
      );
      if (!rows && a) {
        rows = await fetchJson(`${API}/search?track_name=${enc(j)}`);
      }
      if (rows) {
        const hasil = await bungkus(pilihBaris(rows, artiss));
        if (hasil && (hasil.synced || hasil.plain)) {
          if (hasil.synced) return hasil;
          if (!fallback) fallback = hasil;
        }
      }
    }
    // Terakhir: pencarian full-text buat varian judul ini
    const rows = await fetchJson(`${API}/search?q=${enc(artiss[0] ? artiss[0] + ' ' : '')}${enc(j)}`);
    if (rows) {
      const hasil = await bungkus(pilihBaris(rows, artiss));
      if (hasil && (hasil.synced || hasil.plain)) {
        if (hasil.synced) return hasil;
        if (!fallback) fallback = hasil;
      }
    }
  }
  return fallback;
}

// Index baris aktif pada waktu ms (baris terakhir dengan t <= ms)
function barisAktif(lirik, ms) {
  let idx = -1;
  for (let i = 0; i < lirik.length; i++) {
    if (lirik[i].t <= ms) idx = i;
    else break;
  }
  return idx;
}

// Jendela tampilan: 2 baris sebelum, baris aktif, 3 baris sesudah
function jendelaTeks(lirik, idx) {
  const mulai = Math.max(0, idx - 2);
  const akhir = Math.min(lirik.length - 1, idx + 3);
  const bagian = [];
  for (let i = mulai; i <= akhir; i++) {
    bagian.push(i === idx ? `» **${lirik[i].baris || '...'}**` : lirik[i].baris || '...');
  }
  return bagian.join('\n');
}

// Judul "inti": buat deteksi cover/mix/remix dari lagu yang sama
function judulInti(raw) {
  return bersihkanJudul(raw)
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(remix|cover|mix|mixtape|live|akustik|acoustic|sped\s*up|slowed|reverb|karaoke|instrumental|versi|version|edit|bootleg|flip|extended)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

module.exports = { cariLirik, parseLRC, barisAktif, jendelaTeks, bersihkanJudul, varianJudul, artisDariJudul, judulInti };
