// สร้างค่า EDIT_PASSWORD_HASH และ SESSION_SECRET สำหรับใส่ใน Vercel Environment Variables
// ใช้: node scripts/make-password.js "รหัสผ่านของทีม"
const { hashPassword } = require('../lib/auth');
const crypto = require('crypto');

const pw = process.argv.slice(2).join(' ');
if (pw.length < 8) {
  console.log('วิธีใช้: node scripts/make-password.js "รหัสผ่านของทีม"  (อย่างน้อย 8 ตัวอักษร ตั้งให้เดายาก)');
  process.exit(1);
}
console.log('\n--- EDIT_PASSWORD_HASH (คัดลอกไปวางเป็นค่าของตัวแปรนี้) ---');
console.log(hashPassword(pw));
console.log('\n--- SESSION_SECRET (สุ่มใหม่ ใช้ค่านี้ได้เลย) ---');
console.log(crypto.randomBytes(32).toString('hex'));
console.log('\nรหัสผ่านจริงไม่ได้ถูกเก็บไว้ที่ใด เก็บเฉพาะ hash เท่านั้น');
