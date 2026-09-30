const store = require('../lib/store');
const { route } = require('../lib/http');
const { passwordHash, verifyPassword, setSession, TEAM } = require('../lib/auth');

const MAX_FAILS = 8;          // ผิดได้กี่ครั้ง
const WINDOW_SEC = 15 * 60;   // ภายในกี่วินาที (15 นาที)
const DUMMY = '00000000000000000000000000000000:' + '0'.repeat(64);

module.exports = route(['POST'], false, async (req, res) => {
  const hash = passwordHash();
  if (!hash) return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่ารหัสผ่าน (EDIT_PASSWORD_HASH)' });
  const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local').slice(0, 64);
  const key = 'pr:fail:' + ip;
  const fails = +(await store.cmd(['GET', key])) || 0;
  if (fails >= MAX_FAILS) return res.status(429).json({ error: 'ลองผิดหลายครั้งเกินไป' });

  const p = String((req.body && req.body.p) || '');
  if (!verifyPassword(p, hash || DUMMY)) {
    const n = await store.cmd(['INCR', key]);
    if (n === 1) await store.cmd(['EXPIRE', key, WINDOW_SEC]);
    return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  await store.cmd(['DEL', key]);
  setSession(res);
  res.status(200).json({ user: { ...TEAM } });
});
