// ส่งงานเข้า Google Calendar ของทีม (ผ่าน service account) ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
// ตั้งค่าผ่าน Environment Variables:
//   GOOGLE_SERVICE_ACCOUNT  = เนื้อไฟล์คีย์ JSON ของ service account (วางทั้งก้อน หรือเข้ารหัส base64 ก็ได้)
//   GOOGLE_CALENDAR_ID      = รหัสปฏิทินที่แชร์ให้ service account แล้ว (สิทธิ์ "ทำการเปลี่ยนแปลงกิจกรรม")
//   SITE_URL (ไม่บังคับ)    = ที่อยู่เว็บ ใช้ใส่ลิงก์กลับมาที่งานในรายละเอียดกิจกรรม
const crypto = require('crypto');

const API = () => process.env.GOOGLE_API_BASE || 'https://www.googleapis.com';
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const calId = () => String(process.env.GOOGLE_CALENDAR_ID || '').trim();

// อ่านคีย์ service account ให้ทนต่อการวางผิดรูปแบบ: JSON ทั้งก้อน / base64 / มีเครื่องหมายคำพูดครอบ / private_key ขึ้นบรรทัดใหม่จริง
function parseAccount(raw) {
  raw = String(raw || '').trim();
  if (!raw) return { why: 'ไม่พบ GOOGLE_SERVICE_ACCOUNT (ยังไม่ได้ใส่ หรือใส่แล้วแต่ยังไม่ได้ Redeploy)' };
  if ((raw[0] === '"' && raw.endsWith('"')) || (raw[0] === "'" && raw.endsWith("'"))) raw = raw.slice(1, -1).trim();
  if (raw[0] !== '{') { try { raw = Buffer.from(raw, 'base64').toString('utf8').trim(); } catch (e) { /* ปล่อยให้ตรวจต่อ */ } }
  let email = '', key = '';
  try { const j = JSON.parse(raw); email = j.client_email; key = j.private_key; } catch (e) {
    const m1 = raw.match(/"client_email"\s*:\s*"([^"]+)"/);
    const m2 = raw.match(/"private_key"\s*:\s*"([\s\S]*?-----END [A-Z ]*PRIVATE KEY-----(?:\\n|\r?\n)?)"/);
    if (m1) email = m1[1];
    if (m2) key = m2[1];
  }
  if (!email || !key) return { why: 'อ่าน GOOGLE_SERVICE_ACCOUNT ไม่ได้ ต้องวางเนื้อหาทั้งไฟล์ JSON ตั้งแต่ { ถึง } (ต้องมี client_email และ private_key)' };
  key = String(key).replace(/\\n/g, '\n');
  try { crypto.createPrivateKey(key); } catch (e) { return { why: 'private_key ในคีย์อ่านไม่ได้ (วางไม่ครบ) ลองสร้างคีย์ JSON ใหม่แล้ววางใหม่' }; }
  return { email, key };
}
function creds() { const a = parseAccount(process.env.GOOGLE_SERVICE_ACCOUNT); return a.email ? a : null; }
const enabled = () => !!(creds() && calId());
// สถานะสำหรับหน้าเว็บ: ถ้าเชื่อมไม่ได้ จะบอกสาเหตุ (ไม่เปิดเผยค่าลับ)
function status() {
  const a = parseAccount(process.env.GOOGLE_SERVICE_ACCOUNT);
  if (!a.email) return { enabled: false, why: a.why };
  if (!calId()) return { enabled: false, why: 'ไม่พบ GOOGLE_CALENDAR_ID (ยังไม่ได้ใส่ หรือใส่แล้วแต่ยังไม่ได้ Redeploy)' };
  return { enabled: true };
}

const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

let cached = null; // { v, exp }
async function token() {
  if (cached && cached.exp > Date.now() + 60000) return cached.v;
  const c = creds();
  if (!c) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT');
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: 'RS256', typ: 'JWT' });
  const claim = b64u({ iss: c.email, scope: 'https://www.googleapis.com/auth/calendar', aud: TOKEN_URL(), iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(c.key).toString('base64url');
  const r = await fetch(TOKEN_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig,
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('ขอสิทธิ์จาก Google ไม่ได้: ' + (j.error_description || j.error || r.status));
  cached = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.v;
}

async function g(method, path, body) {
  const r = await fetch(API() + path, {
    method,
    headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}
const errMsg = (r) => (r.json && r.json.error && (r.json.error.message || r.json.error)) || r.status;

// รหัสกิจกรรมต้องเป็นตัวอักษร a-v และเลข 0-9 ยาว 5-1024 ตัว -> ใช้ sha1 (hex) ของรหัสงาน ได้ค่าเดิมทุกครั้ง
const eventId = (taskId) => crypto.createHash('sha1').update(String(taskId)).digest('hex');

function addDay(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }
const ml = (v) => (Array.isArray(v) ? v : (v ? [String(v)] : [])).filter(Boolean);
const arr = (v) => (Array.isArray(v) ? v : (v ? String(v).split(',') : [])).filter(Boolean);

// กำหนดช่วงเวลาของกิจกรรม: ไม่มีเวลา = กิจกรรมทั้งวัน (เริ่ม→กำหนดส่ง)
//  มีทั้งเริ่ม+สิ้นสุด  -> เริ่ม วันเริ่ม ถึง สิ้นสุด วันกำหนดส่ง
//  มีแต่เวลาเริ่ม      -> วันเดียว: ยาว 1 ชม. / หลายวัน: ต่อเนื่องถึงสิ้นวันกำหนดส่ง
//  มีแต่เวลาสิ้นสุด    -> ในวันกำหนดส่ง ยาว 1 ชม. จบตามเวลานั้น
const TZ = 'Asia/Bangkok'; // ไทยไม่มีเวลาออมแสง ใช้ +07:00 คงที่
const toMs = (d, tm) => Date.parse(`${d}T${tm}:00+07:00`);
const fmtDT = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 19) + '+07:00';
function when(t) {
  if (!t.ts && !t.te) return { start: { date: t.s }, end: { date: addDay(t.e) } };
  let a, b;
  if (t.ts) { a = toMs(t.s, t.ts); b = t.te ? toMs(t.e, t.te) : (t.s === t.e ? a + 3600e3 : toMs(addDay(t.e), '00:00')); }
  else { b = toMs(t.e, t.te); a = Math.max(b - 3600e3, toMs(t.e, '00:00')); }
  if (!(b > a)) b = a + 3600e3;
  return { start: { dateTime: fmtDT(a), timeZone: TZ }, end: { dateTime: fmtDT(b), timeZone: TZ } };
}

function siteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/+$/, '');
  const h = req && req.headers ? req.headers : {};
  const host = h['x-forwarded-host'] || h.host;
  return host ? (h['x-forwarded-proto'] || 'https') + '://' + host : '';
}

function eventBody(t, site) {
  const L = [];
  const who = arr(t.who), dept = ml(t.dept), type = arr(t.type), item = ml(t.item);
  if (who.length) L.push('ผู้รับผิดชอบ: ' + who.join(', ') + (who.length > 1 ? ' (ทำด้วยกัน)' : ''));
  if (dept.length) L.push('ฝ่าย: ' + dept.join(', '));
  if (item.length) L.push('รายการ: ' + item.join(', '));
  if (type.length) L.push('ประเภท: ' + type.join(', '));
  L.push('สถานะ: ' + t.st + (t.pri === 'ด่วน' ? ' · ด่วน' : ''));
  L.push('เริ่ม ' + t.s + (t.ts ? ' ' + t.ts : '') + ' · กำหนดส่ง ' + t.e + (t.te ? ' ' + t.te : '') + (t.st === 'เสร็จแล้ว' && t.done ? ' · เสร็จจริง ' + t.done : ''));
  if (Array.isArray(t.subs) && t.subs.length) {
    L.push('', 'งานย่อย:');
    t.subs.forEach((x) => L.push((x.d ? '☑ ' : '☐ ') + x.t + (x.who ? ' (' + x.who + ')' : '') + (x.due ? ' · ' + x.due : '')));
  }
  if (Array.isArray(t.links) && t.links.length) { L.push('', 'ลิงก์:'); t.links.forEach((x) => L.push(x.l + ': ' + x.u)); }
  if (t.note) L.push('', t.note);
  if (site) L.push('', 'เปิดในเว็บ: ' + site);
  return {
    status: 'confirmed',
    summary: (t.st === 'เสร็จแล้ว' ? '✓ ' : '') + (t.pri === 'ด่วน' ? '🔥 ' : '') + t.t,
    description: L.join('\n'),
    ...when(t), // ไม่กำหนดเวลา = กิจกรรมทั้งวัน (วันสิ้นสุดนับแบบไม่รวมวันนั้น)
    transparency: 'transparent', // แสดงเป็น "ว่าง" ไม่บังเวลานัดอื่น
    extendedProperties: { private: { prTaskId: t.id } },
  };
}

// สร้างหรืออัปเดตกิจกรรมของงานนี้ (กู้คืนให้ด้วยถ้าเคยถูกลบ)
async function upsert(t, site) {
  const cal = encodeURIComponent(calId()), id = eventId(t.id), body = { ...eventBody(t, site), id };
  let r = await g('PUT', `/calendar/v3/calendars/${cal}/events/${id}`, body);
  if (r.status === 404) {
    r = await g('POST', `/calendar/v3/calendars/${cal}/events`, body);
    if (r.status === 409) r = await g('PUT', `/calendar/v3/calendars/${cal}/events/${id}`, body);
  }
  if (r.status >= 300) throw new Error('Google Calendar: ' + errMsg(r));
}

async function remove(taskId) {
  const r = await g('DELETE', `/calendar/v3/calendars/${encodeURIComponent(calId())}/events/${eventId(taskId)}`);
  if (![200, 204, 404, 410].includes(r.status)) throw new Error('Google Calendar: ' + errMsg(r));
}

// ตรวจว่าเข้าถึงปฏิทินได้จริง (แชร์ให้ service account แล้ว)
async function check() {
  const r = await g('GET', `/calendar/v3/calendars/${encodeURIComponent(calId())}`);
  if (r.status !== 200) throw new Error(r.status === 404 ? 'ไม่พบปฏิทิน หรือยังไม่ได้แชร์ให้ service account (ต้องให้สิทธิ์ "ทำการเปลี่ยนแปลงกิจกรรม")' : 'Google Calendar: ' + errMsg(r));
  return (r.json && r.json.summary) || '';
}

module.exports = { enabled, status, upsert, remove, check, siteUrl, eventId, eventBody };
