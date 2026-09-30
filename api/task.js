// เพิ่ม/แก้ไข (POST) และลบ (DELETE ?id=) งาน – ต้องล็อกอิน
const store = require('../lib/store');
const { route } = require('../lib/http');
const { cleanTask, BadInput } = require('../lib/validate');

module.exports = route(['POST', 'DELETE'], true, async (req, res) => {
  if (req.method === 'DELETE') {
    const id = String((req.query && req.query.id) || '');
    if (!/^[a-z0-9]{6,24}$/.test(id)) throw new BadInput('รหัสงานไม่ถูกต้อง');
    await store.delTask(id);
    return res.status(200).json({ ok: true });
  }
  const task = cleanTask(req.body);
  // หน้าเว็บรุ่นเก่า (ยังไม่มีงานย่อย/รายการ) ต้องไม่ลบข้อมูลส่วนนี้ที่มีอยู่ทิ้งตอนบันทึก
  if (!('subs' in task) || !('item' in task)) {
    const old = await store.getTask(task.id);
    if (old) {
      if (!('subs' in task) && Array.isArray(old.subs)) task.subs = old.subs;
      if (!('item' in task) && old.item !== undefined) task.item = old.item;
    }
  }
  await store.putTask(task);
  res.status(200).json({ task });
});
