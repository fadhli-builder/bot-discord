ATUR Bot (tembak-bot)

Bot Discord serbaguna untuk server komunitas: cari teman random, ship /love, musik/karaoke, plus rekap harian (crypto, saham, film, loker, game Roblox), kuis kosa kata, dan hadis harian.

⚠️ Catatan transparansi

Proyek ini dibuat dengan bantuan AI Agent (dijalankan lewat OpenClaw di VPS pribadi) di bawah arahan pemilik repo. Kode belum diaudit manual secara menyeluruh. Pakai dengan bijak, baca kodenya dulu sebelum dijalankan di servermu, dan jangan ragu kirim issue / pull request.

Fitur
Command
Command	Fungsi
/daftar	Daftar / update profil (nama, umur opsional, hobi, bio)
/profil	Lihat profil sendiri
/kenalan	Kirim sapaan anonim ke satu teman random (3x/hari, reset tengah malam WIB)
/block @user	Blokir dua arah dari fitur kenalan
/love [@user]	Ship dengan member random atau target tertentu, persen kecocokan absurd 0.1%-100% (2x/hari)
/pause / /aktifkan	Keluar / kembali ke pool kenalan
/hapus-profil	Hapus semua data pengguna (dengan konfirmasi)
/karaoke	Bot putar lagu di voice channel (katalog Deezer, audio SoundCloud)
/vocab	Skor pribadi + leaderboard mingguan kuis kosa kata
/kostum	Sesi vote kostum anonim (khusus operator)
Otomatis (cron, jam WIB)
Jam	Fitur	Sumber data
07:00	Kuis kosa kata harian (2 soal); rekap mingguan tiap Minggu 19:00	bank kata lokal
07:30	Rekap saham (AS & IDX) dan crypto	Nasdaq, Yahoo Finance, CoinGecko
09:00	Info lowongan kerja Indonesia	Kalibrr
18:00	Game Roblox trending	API publik Roblox
19:00	Film yang lagi ramai di Indonesia	JustWatch
Pagi	One Day One Hadith	bank konten terkurasi lokal

Sapaan /kenalan yang tidak dijawab 24 jam akan expired otomatis.

Setup

Butuh Node.js 18+ dan toolchain build untuk better-sqlite3.

Buat aplikasi di Discord Developer Portal, lalu tab Bot > Reset Token.
Salin .env.example jadi .env dan isi semua nilainya.
Install dan jalankan:
bash
npm install
npm run deploy        # daftarkan slash command ke server
npm start             # atau: pm2 start src/index.js --name tembak-bot
Developer Portal
Intent yang dibutuhkan: Guilds saja (Server Members dan Message Content tidak perlu).
Scope invite: bot + applications.commands.
Permission: Send Messages, Embed Links; untuk /karaoke tambah Connect dan Speak.
Keamanan
Jangan pernah commit .env atau database di data/ (sudah ada di .gitignore).
Kalau token pernah bocor, langsung Reset Token di Developer Portal.
Beberapa ID (server/channel/operator) untuk fitur /kostum masih tertulis langsung di src/kostum-isi-nama.js dan src/commands/kostum.js. Ganti dengan ID servermu sendiri sebelum dipakai.
Lisensi

MIT