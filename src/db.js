require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'kenalbot.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  nama       TEXT NOT NULL,
  umur       INTEGER,
  hobi       TEXT NOT NULL DEFAULT '',
  bio        TEXT NOT NULL DEFAULT '',
  aktif      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kenalan (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  dari         TEXT NOT NULL,
  ke           TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS blocks (
  dari       TEXT NOT NULL,
  ke         TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (dari, ke)
);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pelapor    TEXT NOT NULL,
  terlapor   TEXT NOT NULL,
  kenalan_id INTEGER,
  alasan     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kenalan_dari   ON kenalan(dari);
CREATE INDEX IF NOT EXISTS idx_kenalan_ke     ON kenalan(ke);
CREATE INDEX IF NOT EXISTS idx_kenalan_status ON kenalan(status);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS love_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dari       TEXT NOT NULL,
  tanggal    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loker_log (
  job_id     TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Info film: dedupe film yang sudah pernah dikirim.
-- Catatan dibersihin tiap run di atas 14 hari -> film boleh muncul lagi setelah 2 minggu.
CREATE TABLE IF NOT EXISTS film_log (
  film_id    TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kuis kosa kata: vocab_log = kata yang sudah pernah ditanyakan (dedupe),
-- vocab_answer = jawaban tiap user (1 user 1 jawaban per kata per hari).
CREATE TABLE IF NOT EXISTS vocab_log (
  word       TEXT NOT NULL,
  tanggal    TEXT NOT NULL,
  PRIMARY KEY (word, tanggal)
);

CREATE TABLE IF NOT EXISTS vocab_answer (
  user_id    TEXT NOT NULL,
  username   TEXT NOT NULL DEFAULT '',
  word       TEXT NOT NULL,
  benar      INTEGER NOT NULL,
  tanggal    TEXT NOT NULL,
  PRIMARY KEY (user_id, word, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_lovelog_dari ON love_log(dari, tanggal);
CREATE INDEX IF NOT EXISTS idx_vocab_answer_tanggal ON vocab_answer(tanggal);

-- Streak vocab: GAK pernah direset per minggu (beda dgn leaderboard).
-- Naik tiap hari ada jawaban (benar/salah sama-sama dihitung); bolong satu
-- hari penuh = mulai dari 1 lagi. "Nyala/padam" gak disimpan — dihitung
-- dari tanggal_terakhir pas ditampilkan (derive-don't-store).
CREATE TABLE IF NOT EXISTS vocab_streak (
  user_id           TEXT PRIMARY KEY,
  streak_kini       INTEGER NOT NULL DEFAULT 0,
  streak_terpanjang INTEGER NOT NULL DEFAULT 0,
  tanggal_terakhir  TEXT NOT NULL DEFAULT ''
);

-- Vote kostum (Halloween): sesi, kandidat, dan suara anonim.
CREATE TABLE IF NOT EXISTS kostum_event (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  status     TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at  TEXT
);

CREATE TABLE IF NOT EXISTS kostum_kandidat (
  event_id INTEGER NOT NULL REFERENCES kostum_event(id),
  nomor    INTEGER NOT NULL,
  nama     TEXT NOT NULL,
  PRIMARY KEY (event_id, nomor)
);

-- user_id disimpan HANYA untuk menjamin satu orang satu suara + boleh ganti
-- pilihan. Tidak ada fitur yang boleh menampilkan pemilih per kandidat.
CREATE TABLE IF NOT EXISTS kostum_vote (
  event_id   INTEGER NOT NULL REFERENCES kostum_event(id),
  user_id    TEXT NOT NULL,
  nomor      INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (event_id, nomor) REFERENCES kostum_kandidat(event_id, nomor)
);
`);

// ===== Prepared statements (semua query wajib lewat sini) =====
const stmt = {
  // --- users ---
  upsertUser: db.prepare(`
    INSERT INTO users (discord_id, nama, umur, hobi, bio, aktif)
    VALUES (@id, @nama, @umur, @hobi, @bio, 1)
    ON CONFLICT(discord_id) DO UPDATE
    SET nama = @nama, umur = @umur, hobi = @hobi, bio = @bio, aktif = 1`),
  getUser: db.prepare('SELECT * FROM users WHERE discord_id = ?'),
  setUserAktif: db.prepare('UPDATE users SET aktif = ? WHERE discord_id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE discord_id = ?'),
  deleteKenalanByUser: db.prepare('DELETE FROM kenalan WHERE dari = ? OR ke = ?'),
  deleteBlocksByUser: db.prepare('DELETE FROM blocks WHERE dari = ? OR ke = ?'),
  deleteReportsByUser: db.prepare('DELETE FROM reports WHERE pelapor = ? OR terlapor = ?'),

  // --- kenalan ---
  insertKenalan: db.prepare('INSERT INTO kenalan (dari, ke) VALUES (?, ?)'),
  getKenalan: db.prepare('SELECT * FROM kenalan WHERE id = ?'),
  setKenalanStatus: db.prepare(
    "UPDATE kenalan SET status = ?, responded_at = datetime('now') WHERE id = ? AND status = 'pending'"),
  // Jatah harian: hitung semua kecuali yang batal (DM gagal), zona WIB (+7)
  countHariIni: db.prepare(`
    SELECT COUNT(*) AS n FROM kenalan
    WHERE dari = ? AND status != 'cancelled'
      AND date(created_at, '+7 hours') = ?`),
  // Kandidat: terdaftar & aktif, bukan diri sendiri,
  // belum pernah jadi pasangan (dua arah), tidak saling block,
  // dan sedang tidak punya sapaan pending masuk
  kandidat: db.prepare(`
    SELECT u.* FROM users u
    WHERE u.aktif = 1
      AND u.discord_id != ?
      AND NOT EXISTS (
        SELECT 1 FROM kenalan k
        WHERE (k.dari = ? AND k.ke = u.discord_id)
           OR (k.dari = u.discord_id AND k.ke = ?))
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.dari = ? AND b.ke = u.discord_id)
           OR (b.dari = u.discord_id AND b.ke = ?))
      AND NOT EXISTS (
        SELECT 1 FROM kenalan p
        WHERE p.ke = u.discord_id AND p.status = 'pending')`),

  // --- reports ---
  insertReport: db.prepare(
    'INSERT INTO reports (pelapor, terlapor, kenalan_id, alasan) VALUES (?, ?, ?, ?)'),

  // --- blocks ---
  insertBlock: db.prepare('INSERT OR IGNORE INTO blocks (dari, ke) VALUES (?, ?)'),

  // --- meta (key-value kecil) ---
  getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
  setMeta: db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`),

  // --- fitur ship (/love) ---
  insertLoveLog: db.prepare('INSERT INTO love_log (dari, tanggal) VALUES (?, ?)'),
  countLoveHariIni: db.prepare(
    'SELECT COUNT(*) AS n FROM love_log WHERE dari = ? AND tanggal = ?'),

  // --- info loker: dedupe lowongan yang sudah pernah dikirim ---
  insertLokerLog: db.prepare('INSERT OR IGNORE INTO loker_log (job_id) VALUES (?)'),
  getLokerTerkirim: db.prepare('SELECT job_id FROM loker_log WHERE job_id = ?'),
  deleteLokerLama: db.prepare(
    "DELETE FROM loker_log WHERE created_at < datetime('now', '-60 days')"),

  // --- info film: dedupe film yang sudah pernah dikirim (kedaluwarsa 14 hari) ---
  insertFilmLog: db.prepare('INSERT OR IGNORE INTO film_log (film_id) VALUES (?)'),
  getFilmTerkirim: db.prepare('SELECT film_id FROM film_log WHERE film_id = ?'),
  deleteFilmLama: db.prepare(
    "DELETE FROM film_log WHERE created_at < datetime('now', '-14 days')"),
  sudahBlock: db.prepare(
    'SELECT COUNT(*) AS n FROM blocks WHERE (dari = ? AND ke = ?) OR (dari = ? AND ke = ?)'),

  // --- kuis vocab harian ---
  insertVocabLog: db.prepare('INSERT OR IGNORE INTO vocab_log (word, tanggal) VALUES (?, ?)'),
  getVocabSejak: db.prepare('SELECT word FROM vocab_log WHERE tanggal >= ?'),
  getVocabJawab: db.prepare(
    'SELECT benar FROM vocab_answer WHERE user_id = ? AND word = ? AND tanggal = ?'),
  insertVocabAnswer: db.prepare(
    'INSERT INTO vocab_answer (user_id, username, word, benar, tanggal) VALUES (?, ?, ?, ?, ?)'),
  getVocabLeaderboard: db.prepare(`
    SELECT v.user_id, v.username, SUM(v.benar) AS b, COUNT(*) AS total,
           COALESCE(s.streak_kini, 0) AS streak,
           COALESCE(s.streak_terpanjang, 0) AS rekor,
           s.tanggal_terakhir AS tgl_terakhir
    FROM vocab_answer v
    LEFT JOIN vocab_streak s ON s.user_id = v.user_id
    WHERE v.tanggal >= ?
    GROUP BY v.user_id ORDER BY b DESC, total ASC LIMIT 10`),
  getVocabStatUser: db.prepare(`
    SELECT SUM(benar) AS b, COUNT(*) AS total
    FROM vocab_answer WHERE user_id = ? AND tanggal >= ?`),
  getVocabStreak: db.prepare('SELECT * FROM vocab_streak WHERE user_id = ?'),
  upsertVocabStreak: db.prepare(`
    INSERT INTO vocab_streak (user_id, streak_kini, streak_terpanjang, tanggal_terakhir)
    VALUES (@id, @kini, @rekor, @tgl)
    ON CONFLICT(user_id) DO UPDATE SET
      streak_kini = excluded.streak_kini,
      streak_terpanjang = excluded.streak_terpanjang,
      tanggal_terakhir = excluded.tanggal_terakhir`),
  getVocabStreakTop: db.prepare(`
    SELECT user_id, streak_kini, streak_terpanjang, tanggal_terakhir
    FROM vocab_streak ORDER BY streak_terpanjang DESC, streak_kini DESC LIMIT 50`),

  // --- vote kostum (Halloween, anonim): jangan pernah tambahkan query
  // yang menampilkan siapa memilih siapa ---
  insertKostumEvent: db.prepare(
    'INSERT INTO kostum_event (guild_id, channel_id, created_by) VALUES (?, ?, ?)'),
  getKostumEvent: db.prepare('SELECT * FROM kostum_event WHERE id = ?'),
  getKostumEventAktif: db.prepare(`
    SELECT * FROM kostum_event WHERE guild_id = ? AND status = 'open'
    ORDER BY id DESC LIMIT 1`),
  getKostumEventTerakhir: db.prepare(`
    SELECT * FROM kostum_event WHERE guild_id = ? ORDER BY id DESC LIMIT 1`),
  setKostumMessage: db.prepare(
    'UPDATE kostum_event SET message_id = ? WHERE id = ?'),
  tutupKostumEvent: db.prepare(`
    UPDATE kostum_event SET status = 'closed', closed_at = datetime('now')
    WHERE id = ? AND status = 'open'`),
  insertKostumKandidat: db.prepare(
    'INSERT INTO kostum_kandidat (event_id, nomor, nama) VALUES (?, ?, ?)'),
  getKostumKandidat: db.prepare(
    'SELECT nomor, nama FROM kostum_kandidat WHERE event_id = ? ORDER BY nomor'),
  getKostumKandidatNomor: db.prepare(
    'SELECT nomor, nama FROM kostum_kandidat WHERE event_id = ? AND nomor = ?'),
  updateKostumKandidatNama: db.prepare(
    'UPDATE kostum_kandidat SET nama = ? WHERE event_id = ? AND nomor = ?'),
  upsertKostumVote: db.prepare(`
    INSERT INTO kostum_vote (event_id, user_id, nomor) VALUES (?, ?, ?)
    ON CONFLICT(event_id, user_id) DO UPDATE
    SET nomor = excluded.nomor, updated_at = datetime('now')`),
  getKostumVoteUser: db.prepare(
    'SELECT nomor FROM kostum_vote WHERE event_id = ? AND user_id = ?'),
  getKostumHasil: db.prepare(`
    SELECT k.nomor, k.nama, COUNT(v.user_id) AS suara
    FROM kostum_kandidat k
    LEFT JOIN kostum_vote v ON v.event_id = k.event_id AND v.nomor = k.nomor
    WHERE k.event_id = ?
    GROUP BY k.nomor ORDER BY k.nomor`),
  getKostumHasilUrut: db.prepare(`
    SELECT k.nomor, k.nama, COUNT(v.user_id) AS suara
    FROM kostum_kandidat k
    LEFT JOIN kostum_vote v ON v.event_id = k.event_id AND v.nomor = k.nomor
    WHERE k.event_id = ?
    GROUP BY k.nomor ORDER BY suara DESC, k.nomor ASC`),
  deleteKostumVoteByEvent: db.prepare('DELETE FROM kostum_vote WHERE event_id = ?'),
  deleteKostumKandidatByEvent: db.prepare('DELETE FROM kostum_kandidat WHERE event_id = ?'),
  deleteKostumEventById: db.prepare('DELETE FROM kostum_event WHERE id = ?'),

  // --- expired: pending lebih dari 24 jam ---
  getExpiredPending: db.prepare(`
    SELECT * FROM kenalan
    WHERE status = 'pending'
      AND datetime(created_at, '+24 hours') <= datetime('now')`),
};

// Hapus seluruh jejak user dalam satu transaksi
const hapusSemua = db.transaction((id) => {
  stmt.deleteKenalanByUser.run(id, id);
  stmt.deleteBlocksByUser.run(id, id);
  stmt.deleteReportsByUser.run(id, id);
  stmt.deleteUser.run(id);
});

// Hapus satu sesi vote kostum beserta kandidat & suaranya (urutan anak dulu)
const hapusKostumEvent = db.transaction((id) => {
  stmt.deleteKostumVoteByEvent.run(id);
  stmt.deleteKostumKandidatByEvent.run(id);
  stmt.deleteKostumEventById.run(id);
});

// Tanggal hari ini dalam zona WIB, format YYYY-MM-DD
function hariIniWIB() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

// Tanggal `offsetHari` sebelum `tanggal` (YYYY-MM-DD, murni kalender)
function tanggalSebelum(tanggal, offsetHari = 1) {
  const [y, m, d] = tanggal.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - offsetHari)).toISOString().slice(0, 10);
}

// Api "nyala" kalau terakhir jawab hari ini atau kemarin (WIB); lewat itu = padam
function streakNyala(tanggalTerakhir, hariIni) {
  return !!tanggalTerakhir && (tanggalTerakhir === hariIni || tanggalTerakhir === tanggalSebelum(hariIni));
}

// Catat satu hari jawaban vocab ke streak user (panggil sekali per jawaban
// PERTAMA di hari itu — jawaban dobel hari sama gak lewat sini, udah diblok
// guard satu-jawaban-per-soal). Aturan Bos (2026-11-20): naik tiap hari jawab,
// benar/salah sama; gak pernah direset per minggu; bolong satu hari penuh -> 1 lagi.
const catatStreakVocab = db.transaction((userId, tanggal) => {
  const r = stmt.getVocabStreak.get(userId);
  let streak;
  let rekor = r ? r.streak_terpanjang : 0;
  if (r && r.tanggal_terakhir === tanggal) {
    streak = r.streak_kini; // udah kehitung hari ini
  } else if (r && r.tanggal_terakhir === tanggalSebelum(tanggal, 1)) {
    streak = r.streak_kini + 1; // nyambung sama kemarin
  } else {
    streak = 1; // jawaban pertama / bolong minimal sehari
  }
  if (streak > rekor) rekor = streak;
  stmt.upsertVocabStreak.run({ id: userId, kini: streak, rekor, tgl: tanggal });
  return { streak, rekor };
});

module.exports = { db, stmt, hapusSemua, hapusKostumEvent, hariIniWIB, tanggalSebelum, streakNyala, catatStreakVocab };
