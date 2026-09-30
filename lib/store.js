// ชั้นเก็บข้อมูล: Upstash Redis (REST) ผ่าน fetch ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
// ตอนรันในเครื่อง (ไม่มี env ของฐานข้อมูลและไม่ได้อยู่บน Vercel) จะใช้หน่วยความจำชั่วคราวแทน
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const mem = { kv: new Map(), h: new Map() };
function memCmd(a) {
  const [c, k, ...r] = a;
  switch (String(c).toUpperCase()) {
    case 'GET': return mem.kv.has(k) ? mem.kv.get(k) : null;
    case 'SET': mem.kv.set(k, r[0]); return 'OK';
    case 'DEL': mem.kv.delete(k); mem.h.delete(k); return 1;
    case 'HGETALL': { const m = mem.h.get(k); return m ? [...m].flat() : []; }
    case 'HGET': { const m = mem.h.get(k); return m && m.has(r[0]) ? m.get(r[0]) : null; }
    case 'HSET': { const m = mem.h.get(k) || new Map(); m.set(r[0], r[1]); mem.h.set(k, m); return 1; }
    case 'HDEL': { const m = mem.h.get(k); return m && m.delete(r[0]) ? 1 : 0; }
    case 'INCR': { const v = (+mem.kv.get(k) || 0) + 1; mem.kv.set(k, String(v)); return v; }
    case 'EXPIRE': return 1;
    default: throw new Error('unsupported command ' + c);
  }
}

async function cmd(args) {
  if (!URL_ || !TOK) {
    if (process.env.VERCEL) throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูล (ต้องมี UPSTASH_REDIS_REST_URL และ UPSTASH_REDIS_REST_TOKEN)');
    return memCmd(args);
  }
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'store error ' + r.status);
  return j.result;
}

const K_TASKS = 'pr:tasks';
const K_CFG = 'pr:config';

async function getTasks() {
  const r = await cmd(['HGETALL', K_TASKS]);
  const pairs = Array.isArray(r) ? r : Object.entries(r || {}).flat();
  const out = [];
  for (let i = 0; i < pairs.length; i += 2) {
    try { out.push({ ...JSON.parse(pairs[i + 1]), id: pairs[i] }); } catch (e) { /* ข้ามรายการที่เสียหาย */ }
  }
  return out;
}
async function getTask(id) {
  const r = await cmd(['HGET', K_TASKS, id]);
  try { return r ? { ...JSON.parse(r), id } : null; } catch (e) { return null; }
}
async function putTask(t) { const { id, ...d } = t; await cmd(['HSET', K_TASKS, id, JSON.stringify(d)]); }
async function delTask(id) { await cmd(['HDEL', K_TASKS, id]); }
async function getConfig() {
  const r = await cmd(['GET', K_CFG]);
  try { return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
async function setConfig(c) { await cmd(['SET', K_CFG, JSON.stringify(c)]); }

module.exports = { cmd, getTasks, getTask, putTask, delTask, getConfig, setConfig };
