// ซิงก์ "งานย่อย" ที่เปิดลงปฏิทินแยกจากงานหลัก
// - ลงเฉพาะงานย่อยที่เปิดปุ่มปฏิทิน + มีวันกำหนดส่ง และงานหลักไม่ได้ถูกเลื่อน/ยกเลิก
// - ส่งไป Google เฉพาะงานย่อยที่เปลี่ยน (ชื่อ/คน/วัน/ลิงก์/สถานะ หรือชื่องานหลัก) เพื่อไม่ให้ช้า
// - งานย่อยที่ถูกลบ หรือปิดปุ่มปฏิทิน จะเอากิจกรรมออกให้
const gcal = require('./gcal');

const CANCEL = 'เลื่อน/ยกเลิก';
// ถ้าข้อมูลที่แสดงในกิจกรรมเปลี่ยน (ทั้งของงานย่อยและงานหลัก) จึงส่งไป Google ใหม่
const sig = (t, x) => JSON.stringify([t.t, t.pri, t.who || [], t.type || [], t.dept || [], t.item || [], t.links || [], t.note || '', x.t, !!x.d, x.who || [], x.due || '', x.links || [], x.note || '']);
const subsOf = (t) => (t && Array.isArray(t.subs) ? t.subs : []);

// คงสถานะปฏิทินเดิมของงานย่อยไว้ (หน้าเว็บไม่ส่ง calState มา)
function carry(task, old) {
  const om = new Map(subsOf(old).map((x) => [x.id, x]));
  subsOf(task).forEach((x) => { const o = om.get(x.id); if (o && o.calState && !x.calState) x.calState = o.calState; });
}

async function runAll(jobs) { for (let i = 0; i < jobs.length; i += 5) await Promise.all(jobs.slice(i, i + 5).map((f) => f())); }

// คืนข้อความผิดพลาดแรก (ถ้ามี) · แก้ calState ของงานย่อยใน task ให้ตรงกับผลจริง
async function syncSubs(task, old, site, force) {
  carry(task, old);
  const subs = subsOf(task);
  const om = new Map(subsOf(old).map((x) => [x.id, x]));
  const cancelled = task.st === CANCEL;
  const jobs = [];
  let err;
  const fail = (e) => { console.error('gcal sub', e); if (!err) err = String(e.message || e).slice(0, 200); };
  subs.forEach((x) => {
    const want = x.cal === true && !!x.due && !cancelled;
    const o = om.get(x.id);
    if (want) {
      if (force || x.calState !== 'ok' || !o || sig(task, x) !== sig(old, o)) {
        jobs.push(async () => { try { await gcal.upsertSub(task, x, site); x.calState = 'ok'; } catch (e) { x.calState = 'error'; fail(e); } });
      }
    } else if (x.calState) {
      jobs.push(async () => { try { await gcal.removeSub(task.id, x.id); delete x.calState; } catch (e) { x.calState = 'error'; fail(e); } });
    }
  });
  const ids = new Set(subs.map((x) => x.id));
  om.forEach((o) => {
    if (!ids.has(o.id) && o.calState) jobs.push(async () => { try { await gcal.removeSub(task.id, o.id); } catch (e) { fail(e); } });
  });
  await runAll(jobs);
  return err;
}

// ลบงานหลัก: เอากิจกรรมของงานย่อยออกทั้งหมด
async function dropSubs(task) {
  let err;
  await runAll(subsOf(task).filter((x) => x.calState).map((x) => async () => {
    try { await gcal.removeSub(task.id, x.id); } catch (e) { console.error('gcal sub remove', e); if (!err) err = String(e.message || e).slice(0, 200); }
  }));
  return err;
}

module.exports = { syncSubs, dropSubs, carry };
