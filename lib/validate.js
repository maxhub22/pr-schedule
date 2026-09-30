// ตรวจและล้างข้อมูลจากฝั่งเบราว์เซอร์ก่อนบันทึกทุกครั้ง (ไม่เชื่อข้อมูลที่ส่งมาตรงๆ)
const ST = ['รอเริ่ม', 'กำลังทำ', 'รอตรวจ/แก้ไข', 'เสร็จแล้ว', 'เลื่อน/ยกเลิก'];
const PRI = ['ปกติ', 'ด่วน'];
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
const list = (v) => (Array.isArray(v) ? v : []).slice(0, 30).map((x) => str(x, 60).trim()).filter(Boolean);
// ฝ่าย/รายการ เลือกได้หลายค่า (ข้อมูลเก่าเป็นข้อความเดียว จึงรับได้ทั้งสองแบบ แล้วเก็บเป็นรายการเสมอ)
const multi = (v) => (Array.isArray(v) ? v : (v ? [v] : [])).slice(0, 20).map((x) => str(x, 60).trim()).filter(Boolean);
const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : '#888888');

class BadInput extends Error {}

// งานย่อย: [{id, t, d, who?, due?}] (เก็บในเอกสารของงานหลัก)
function cleanSubs(a) {
  if (!Array.isArray(a)) return null;
  const seen = new Set();
  const out = [];
  a.slice(0, 30).forEach((x) => {
    if (!x || typeof x !== 'object') return;
    const t = str(x.t, 120).trim();
    if (!t) return;
    let id = /^[a-z0-9]{4,24}$/.test(x.id || '') ? x.id : 's' + Math.random().toString(36).slice(2, 10);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const o = { id, t, d: x.d === true };
    const who = str(x.who, 60).trim();
    if (who) o.who = who;
    const due = date(x.due);
    if (due) o.due = due;
    out.push(o);
  });
  return out;
}
// วันนี้ตามเวลาไทย (UTC+7) ใช้เป็นค่าสำรองของ "วันที่เสร็จจริง"
const bangkokToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function cleanTask(b) {
  b = b || {};
  const id = /^[a-z0-9]{6,24}$/.test(b.id || '') ? b.id : null;
  if (!id) throw new BadInput('รหัสงานไม่ถูกต้อง');
  const t = str(b.t, 200).trim();
  if (!t) throw new BadInput('ต้องมีชื่องาน');
  const s = date(b.s);
  if (!s) throw new BadInput('วันเริ่มไม่ถูกต้อง');
  let e = date(b.e) || s;
  if (e < s) e = s;
  const links = (Array.isArray(b.links) ? b.links : []).slice(0, 20)
    .map((x) => ({ l: str(x && x.l, 60).trim() || 'ลิงก์', u: str(x && x.u, 1000).trim() }))
    .filter((x) => /^https?:\/\//i.test(x.u));
  const subs = cleanSubs(b.subs);
  const task = {
    id, t, who: list(b.who), type: list(b.type), dept: multi(b.dept), s, e,
    st: ST.includes(b.st) ? b.st : ST[0], pri: PRI.includes(b.pri) ? b.pri : PRI[0],
    links, note: str(b.note, 2000),
    cre: Number.isFinite(+b.cre) && +b.cre > 0 ? +b.cre : Date.now(),
    done: b.st === 'เสร็จแล้ว' ? (date(b.done) || bangkokToday()) : '',
    upd: Date.now(),
  };
  // ถ้าหน้าเว็บรุ่นเก่าไม่ได้ส่ง subs มา จะไม่ใส่ฟิลด์นี้ (api/task.js จะคงงานย่อยเดิมไว้ให้)
  if (subs) task.subs = subs;
  // รายการ (ไม่บังคับ): ถ้าหน้าเว็บรุ่นเก่าไม่ส่งฟิลด์นี้มา จะไม่ใส่ (api/task.js คงค่าเดิมไว้ให้)
  if (b.item !== undefined) task.item = multi(b.item);
  return task;
}

function cleanConfig(b) {
  b = b || {};
  const opt = (v) => (Array.isArray(v) ? v : []).slice(0, 50)
    .map((x) => ({ n: str(x && x.n, 60).trim(), c: hex(x && x.c) })).filter((x) => x.n);
  const colors = (v, keys) => {
    const o = {};
    keys.forEach((k) => { if (v && /^#[0-9a-fA-F]{6}$/.test(v[k] || '')) o[k] = v[k]; });
    return o;
  };
  const who = opt(b.who), types = opt(b.types), depts = opt(b.depts), items = opt(b.items);
  if (!who.length || !depts.length) throw new BadInput('ต้องมีผู้รับผิดชอบและฝ่ายอย่างน้อยอย่างละ 1 ตัวเลือก');
  return {
    who, types, depts, items,
    links: (Array.isArray(b.links) ? b.links : []).slice(0, 40)
      .map((x) => ({ l: str(x && x.l, 80).trim(), u: str(x && x.u, 1000).trim() }))
      .filter((x) => x.l && /^https?:\/\//i.test(x.u)),
    stc: colors(b.stc, ST), pcc: colors(b.pcc, PRI),
  };
}

module.exports = { cleanTask, cleanConfig, BadInput };
