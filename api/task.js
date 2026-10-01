// เพิ่ม/แก้ไข (POST) และลบ (DELETE ?id=) งาน – ต้องล็อกอิน
// ถ้างานเปิด "เพิ่มในปฏิทินทีม" จะซิงก์ไป Google Calendar ด้วย (ถ้าตั้งค่าไว้)
const store = require('../lib/store');
const { route } = require('../lib/http');
const { cleanTask, BadInput } = require('../lib/validate');
const gcal = require('../lib/gcal');

module.exports = route(['POST', 'DELETE'], true, async (req, res) => {
  if (req.method === 'DELETE') {
    const id = String((req.query && req.query.id) || '');
    if (!/^[a-z0-9]{6,24}$/.test(id)) throw new BadInput('รหัสงานไม่ถูกต้อง');
    let calError;
    if (gcal.enabled()) {
      const old = await store.getTask(id);
      if (old && (old.calState === 'ok' || old.calState === 'error')) {
        try { await gcal.remove(id); } catch (e) { console.error('gcal remove', e); calError = String(e.message || e).slice(0, 200); }
      }
    }
    await store.delTask(id);
    return res.status(200).json({ ok: true, calError });
  }

  const task = cleanTask(req.body);
  const old = await store.getTask(task.id);
  // หน้าเว็บรุ่นเก่า (ยังไม่มีงานย่อย/รายการ/ปฏิทิน) ต้องไม่ลบข้อมูลส่วนนี้ที่มีอยู่ทิ้งตอนบันทึก
  if (old) {
    if (!('subs' in task) && Array.isArray(old.subs)) task.subs = old.subs;
    if (!('item' in task) && old.item !== undefined) task.item = old.item;
    if (!('cal' in task) && old.cal !== undefined) task.cal = old.cal;
    if (!('ts' in task) && old.ts) task.ts = old.ts;
    if (!('te' in task) && old.te) task.te = old.te;
    if (old.calState) task.calState = old.calState;
  }
  if (!task.s) { task.cal = false; task.ts = ''; task.te = ''; } // ยังไม่กำหนดวัน = ลงปฏิทินไม่ได้

  let calError;
  if (gcal.enabled()) {
    const want = task.cal === true && !!task.s && task.st !== 'เลื่อน/ยกเลิก';
    try {
      if (want) { await gcal.upsert(task, gcal.siteUrl(req)); task.calState = 'ok'; }
      else if (task.calState) { await gcal.remove(task.id); delete task.calState; }
    } catch (e) {
      console.error('gcal sync', e);
      calError = String(e.message || e).slice(0, 200);
      task.calState = 'error';
    }
  }
  await store.putTask(task);
  res.status(200).json({ task, calError });
});
