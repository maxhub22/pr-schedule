const crypto = require('crypto');

// รหัสผ่านเก็บเป็น scrypt hash รูปแบบ "salt:hash" (สร้างด้วย npm run make-users)
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(String(pw), salt, 32);
  const b = Buffer.from(hash, 'hex');
  return b.length === h.length && crypto.timingSafeEqual(h, b);
}

// รหัสผ่านกลางของทีม เก็บเป็น hash ใน EDIT_PASSWORD_HASH (สร้างด้วย npm run make-password)
function passwordHash() { return process.env.EDIT_PASSWORD_HASH || ''; }
// แท็กสั้นๆ ที่ผูกกับรหัสปัจจุบัน: เปลี่ยนรหัส = ทุกเครื่องที่ล็อกอินค้างอยู่ถูกออกจากระบบทันที
function versionTag() { return crypto.createHash('sha256').update(passwordHash()).digest('hex').slice(0, 12); }
const TEAM = { u: 'team', name: 'ทีมสื่อ PR' };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('ยังไม่ได้ตั้งค่า SESSION_SECRET (อย่างน้อย 16 ตัวอักษร)');
  return s;
}
const mac = (b) => crypto.createHmac('sha256', secret()).update(b).digest('base64url');

function sign(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return b + '.' + mac(b);
}
function verify(tok) {
  if (!tok || tok.indexOf('.') < 0) return null;
  const [b, s] = tok.split('.');
  const x = Buffer.from(s || ''), y = Buffer.from(mac(b));
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    return p && p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const MAXAGE = 30 * 24 * 3600; // 30 วัน
function cookieStr(val, maxAge) {
  return `sid=${val}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (process.env.VERCEL ? '; Secure' : '');
}
function setSession(res) {
  const tok = sign({ u: TEAM.u, v: versionTag(), exp: Date.now() + MAXAGE * 1000 });
  res.setHeader('Set-Cookie', cookieStr(tok, MAXAGE));
}
function clearSession(res) { res.setHeader('Set-Cookie', cookieStr('', 0)); }

// คืนข้อมูลถ้าล็อกอินอยู่ (และรหัสยังไม่ถูกเปลี่ยนหลังจากนั้น) หรือ null
function getUser(req) {
  const p = verify(parseCookies(req).sid);
  return p && passwordHash() && p.v === versionTag() ? { ...TEAM } : null;
}

module.exports = { hashPassword, verifyPassword, passwordHash, setSession, clearSession, getUser, TEAM };
