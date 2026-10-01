// ซิงก์งานที่เปิด "เพิ่มในปฏิทินทีม" เข้า Google Calendar ใหม่ทั้งหมด (ใช้หลังตั้งค่าครั้งแรก หรือถ้าปฏิทินคลาดเคลื่อน)
const store = require('../lib/store');
const { route } = require('../lib/http');
const { BadInput } = require('../lib/validate');
const gcal = require('../lib/gcal');

module.exports = route(['POST'], true, async (req, res) => {
  if (!gcal.enabled()) throw new BadInput('ยังไม่ได้เชื่อมต่อ Google Calendar (ดูคู่มือในไฟล์ README)');
  let calName;
  try { calName = await gcal.check(); } catch (e) { throw new BadInput(String(e.message || e)); }
  const site = gcal.siteUrl(req);
  const todo = (await store.getTasks()).filter((t) => t.cal === true || t.calState).slice(0, 80);
  let ok = 0, fail = 0, removed = 0;
  const errors = [];
  const run = async (t) => {
    try {
      if (t.cal === true && t.s && t.e && t.st !== 'เลื่อน/ยกเลิก') { await gcal.upsert(t, site); t.calState = 'ok'; ok++; }
      else { await gcal.remove(t.id); delete t.calState; removed++; }
    } catch (e) { t.calState = 'error'; fail++; errors.push(String(e.message || e).slice(0, 120)); }
    await store.putTask(t);
  };
  for (let i = 0; i < todo.length; i += 5) await Promise.all(todo.slice(i, i + 5).map(run));
  res.status(200).json({ ok, fail, removed, calendar: calName, errors: errors.slice(0, 3) });
});
