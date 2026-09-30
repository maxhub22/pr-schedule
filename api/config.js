// บันทึกตัวเลือก/สี/ลิงก์สำคัญ – ต้องล็อกอิน
const store = require('../lib/store');
const { route } = require('../lib/http');
const { cleanConfig } = require('../lib/validate');

module.exports = route(['POST'], true, async (req, res) => {
  const cfg = cleanConfig(req.body);
  await store.setConfig(cfg);
  res.status(200).json({ cfg });
});
