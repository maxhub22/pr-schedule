// นำเข้าข้อมูลเริ่มต้นจาก data/seed.json ไปยังฐานข้อมูลจริง (รันครั้งเดียว)
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');
const { cleanTask, cleanConfig } = require('../lib/validate');

(async () => {
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) {
    console.error('ยังไม่ได้ตั้ง env ของฐานข้อมูล (ดู README.md หัวข้อ นำข้อมูลเดิมเข้า)'); process.exit(1);
  }
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));
  const existing = await store.getTasks();
  if (existing.length && process.argv[2] !== '--force') {
    console.error(`ในฐานข้อมูลมี ${existing.length} งานอยู่แล้ว หยุดเพื่อไม่ให้เขียนทับ (ถ้าต้องการจริงๆ ใส่ --force)`); process.exit(1);
  }
  await store.setConfig(cleanConfig(seed.cfg));
  for (const t of seed.tasks) {
    const c = cleanTask(t); c.upd = t.upd || c.upd; await store.putTask(c);
  }
  console.log(`นำเข้าแล้ว: ${seed.tasks.length} งาน + ตัวเลือก/สี/ลิงก์สำคัญ`);
})().catch((e) => { console.error(e.message); process.exit(1); });
