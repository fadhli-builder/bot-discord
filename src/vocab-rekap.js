const { log } = require('./log');
const { stmt, hariIniWIB, streakNyala } = require('./db');

// Rekap mingguan kuis kosa kata: papan skor sejak Senin dikirim ke channel
// quiz tiap MINGGU jam 19:00 WIB (malam sebelum leaderboard reset Senin).
// Penanda anti-kirim dobel disimpan di tabel meta (key: vocab_rekap_terakhir).

const WIB = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 (tanpa DST)
const JAM_KIRIM = 19; // 19:00 WIB, hari Minggu
const WARNA = 0x2e7d32; // hijau emerald, sama dengan kuis harian
const META_KEY = 'vocab_rekap_terakhir';

// Senin pekan ini dalam tanggal WIB (mulai pekan leaderboard — sama dengan /vocab)
function seninWIB() {
  const now = new Date(Date.now() + WIB);
  const dow = now.getUTCDay(); // 0=Minggu .. 6=Sabtu
  const delta = dow === 0 ? 6 : dow - 1;
  return new Date(now.getTime() - delta * 864e5).toISOString().slice(0, 10);
}

// Delay ms sampai Minggu 19:00 WIB terdekat
function msSampaiMinggu19() {
  const now = new Date(Date.now() + WIB);
  const target = new Date(now);
  target.setUTCHours(JAM_KIRIM, 0, 0, 0);
  const delta = (7 - now.getUTCDay()) % 7; // 0 = hari ini
  target.setUTCDate(target.getUTCDate() + delta);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 7);
  return target.getTime() - now.getTime();
}

// Kirim rekap ke channel. Return { status, pesan } — dipakai juga script tes.
// Env VOCAB_RECAP_FORCE=1 memaksa kirim di luar Minggu (hanya untuk tes;
// tanpa day-check dan tanpa penanda meta supaya rekap asli Minggu tetap jalan).
async function kirimRekapMingguan(client) {
  const paksa = process.env.VOCAB_RECAP_FORCE === '1';
  try {
    const nowWIB = new Date(Date.now() + WIB);
    if (!paksa && nowWIB.getUTCDay() !== 0) {
      return { status: 'dilewati', pesan: 'bukan Minggu — rekap hanya Minggu 19:00 WIB' };
    }

    const senin = seninWIB();
    if (!paksa) {
      const terakhir = stmt.getMeta.get(META_KEY);
      if (terakhir && terakhir.value === senin) {
        return { status: 'dilewati', pesan: `rekap pekan ${senin} sudah pernah dikirim` };
      }
    }

    const lb = stmt.getVocabLeaderboard.all(senin);
    if (!lb.length) {
      return { status: 'dilewati', pesan: 'papan skor kosong pekan ini — tidak ada yang dikirim' };
    }

    const kanalId = process.env.VOCAB_CHANNEL_ID;
    if (!kanalId) throw new Error('VOCAB_CHANNEL_ID belum diisi di .env');
    const ch = await client.channels.fetch(kanalId);

    const peringkat = lb
      .map((r, i) => {
        const no = i < 3 ? `${i + 1}.` : `**${i + 1}.**`;
        return `${no} <@${r.user_id}> — ${r.b} benar / ${r.total} jawab`;
      })
      .join('\n');

    // Seksi streak (2026-11-26): GAK ikut reset mingguan — rekor sepanjang masa.
    const hari = hariIniWIB();
    const topStreak = stmt
      .getVocabStreakTop.all()
      .filter((s) => s.streak_kini > 0)
      .slice(0, 5);
    const fields = [{ name: `Papan skor (pekan ${senin})`, value: peringkat }];
    if (topStreak.length) {
      fields.push({
        name: 'Streak terpanjang (gak ikut reset mingguan)',
        value: topStreak
          .map((s, i) => {
            const api = streakNyala(s.tanggal_terakhir, hari) ? ' 🔥' : ' 💤';
            return `${i + 1}. <@${s.user_id}> — ${s.streak_kini} hari (rekor ${s.streak_terpanjang})${api}`;
          })
          .join('\n'),
      });
    }

    await ch.send({
      embeds: [
        {
          title: 'Rekap Kuis Kosa Kata — Papan Skor Pekan Ini',
          description:
            'Peringkat sejak Senin, sebelum papan di-reset besok pagi. Terima kasih sudah ikutan!',
          color: WARNA,
          fields,
          footer: { text: 'Kuis harian jam 07:00 WIB • cek skormu kapan saja: /vocab' },
        },
      ],
    });

    if (!paksa) stmt.setMeta.run(META_KEY, senin);
    log(`Vocab rekap: papan skor pekan ${senin} terkirim (${lb.length} peserta)`);
    return { status: 'terkirim', pesan: `papan skor pekan ${senin} terkirim, ${lb.length} peserta` };
  } catch (e) {
    log(`Vocab rekap error: ${e && e.stack ? e.stack : e}`);
    return { status: 'gagal', pesan: e && e.message ? e.message : String(e) };
  }
}

module.exports = function startVocabRekapCron(client) {
  function jadwalkan() {
    const delay = msSampaiMinggu19();
    const jam = Math.round(delay / 3600000);
    log(`Vocab rekap cron aktif: kirim berikutnya ~${jam} jam lagi (Minggu 19:00 WIB)`);
    setTimeout(async () => {
      await kirimRekapMingguan(client);
      jadwalkan(); // pasang ulang timer biar selalu pas jam kirim
    }, delay);
  }
  jadwalkan();
};

module.exports.kirimRekapMingguan = kirimRekapMingguan;
module.exports.msSampaiMinggu19 = msSampaiMinggu19;
