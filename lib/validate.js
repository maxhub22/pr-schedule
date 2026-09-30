// ตรวจและล้างข้อมูลจากฝั่งเบราว์เซอร์ก่อนบันทึกทุกครั้ง (ไม่เชื่อข้อมูลที่ส่งมาตรงๆ)
const ST = ['รอเริ่ม', 'กำลังทำ', 'รอตรวจ/แก้ไข', 'เสร็จแล้ว', 'เลื่อน/ยกเลิก'];
const PRI = ['ปกติ', 'ด่วน'];
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
const list = (v) => (Array.isArray(v) ? v : []).slice(0, 30).map((x) => str(x, 60).trim()).filter(Boolean);
const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : '#888888');

class BadInput extends Error {}

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
  return {
    id, t, who: list(b.who), type: list(b.type), dept: str(b.dept, 60), s, e,
    st: ST.includes(b.st) ? b.st : ST[0], pri: PRI.includes(b.pri) ? b.pri : PRI[0],
    links, note: str(b.note, 2000),
    cre: Number.isFinite(+b.cre) && +b.cre > 0 ? +b.cre : Date.now(),
    upd: Date.now(),
  };
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
  const who = opt(b.who), types = opt(b.types), depts = opt(b.depts);
  if (!who.length || !depts.length) throw new BadInput('ต้องมีผู้รับผิดชอบและฝ่ายอย่างน้อยอย่างละ 1 ตัวเลือก');
  return {
    who, types, depts,
    links: (Array.isArray(b.links) ? b.links : []).slice(0, 40)
      .map((x) => ({ l: str(x && x.l, 80).trim(), u: str(x && x.u, 1000).trim() }))
      .filter((x) => x.l && /^https?:\/\//i.test(x.u)),
    stc: colors(b.stc, ST), pcc: colors(b.pcc, PRI),
  };
}

module.exports = { cleanTask, cleanConfig, BadInput };
