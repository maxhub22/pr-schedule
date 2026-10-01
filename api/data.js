// อ่านข้อมูลทั้งหมด – เปิดให้ทุกคนดูได้ (ไม่ต้องล็อกอิน)
const store = require('../lib/store');
const { route } = require('../lib/http');
const gcal = require('../lib/gcal');

module.exports = route(['GET'], false, async (req, res) => {
  const [cfg, tasks] = await Promise.all([store.getConfig(), store.getTasks()]);
  res.status(200).json({ cfg, tasks, cal: gcal.status() });
});
