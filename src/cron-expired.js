const { stmt } = require('./db');
const { log } = require('./log');

// Cron kadaluarsa: sapaan pending > 24 jam → expired + DM netral ke pengirim.
// Cek pertama 1 menit setelah bot online (menangkap yang telanjur kadaluarsa
// saat bot mati), lalu tiap 30 menit.
module.exports = function startExpiredCron(client) {
  const JEDA = 30 * 60 * 1000;

  async function cek() {
    try {
      const rows = stmt.getExpiredPending.all();
      for (const r of rows) {
        stmt.setKenalanStatus.run('expired', r.id);
        try {
          const u = await client.users.fetch(r.dari);
          const dm = await u.createDM();
          await dm.send(
            'Sapaan kenalan kamu kemarin gak sempat dijawab, jadi kadaluarsa. ' +
            'Tenang, jatah harian tetep kepakai — coba lagi kapan aja ya!',
          );
        } catch (_) { /* DM pengirim tertutup → diamkan */ }
      }
      if (rows.length) log(`Expired cron: ${rows.length} sapaan kadaluarsa`);
    } catch (e) {
      log(`Expired cron error: ${e && e.stack ? e.stack : e}`);
    }
  }

  setTimeout(cek, 60 * 1000);
  setInterval(cek, JEDA);
  log('Expired cron aktif (cek tiap 30 menit, kadaluarsa setelah 24 jam)');
};
