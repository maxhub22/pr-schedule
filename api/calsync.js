// ซิงก์งานที่เปิด "เพิ่มในปฏิทินทีม" เข้า Google Calendar ใหม่ทั้งหมด (ใช้หลังตั้งค่าครั้งแรก หรือถ้าปฏิทินคลาดเคลื่อน)
const store = require('../lib/store');
const { route } = require('../lib/http');
const { BadInput } = require('../lib/validate');
const gcal = require('../lib/gcal');
const { syncSubs } = require('../lib/subcal');

module.exports = route(['POST'], true, async (req, res) => {
  if (!gcal.enabled()) throw new BadInput('ยังไม่ได้เชื่อมต่อ Google Calendar (ดูคู่มือในไฟล์ README)');
  let calName;
  try { calName = await gcal.check(); } catch (e) { throw new BadInput(String(e.message || e)); }
  const site = gcal.siteUrl(req);
  const hasSubCal = (t) => Array.isArray(t.subs) && t.subs.some((x) => x.cal === true || x.calState);
  const todo = (await store.getTasks()).filter((t) => t.cal === true || t.calState || hasSubCal(t)).slice(0, 80);
  let ok = 0, fail = 0, removed = 0, subs = 0;
  const errors = [];
  const run = async (t) => {
    try {
      if (t.cal === true && t.s && t.e && t.st !== 'เลื่อน/ยกเลิก') { await gcal.upsert(t, site); t.calState = 'ok'; ok++; }
      else if (t.calState) { await gcal.remove(t.id); delete t.calState; removed++; }
    } catch (e) { t.calState = 'error'; fail++; errors.push(String(e.message || e).slice(0, 120)); }
    const se = await syncSubs(t, t, site, true);
    if (se) { fail++; errors.push(se.slice(0, 120)); }
    subs += (t.subs || []).filter((x) => x.calState === 'ok').length;
    await store.putTask(t);
  };
  for (let i = 0; i < todo.length; i += 5) await Promise.all(todo.slice(i, i + 5).map(run));
  res.status(200).json({ ok, fail, removed, subs, calendar: calName, errors: errors.slice(0, 3) });
});
