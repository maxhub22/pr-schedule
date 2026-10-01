// Service worker ของ “ตารางงานทีมสื่อ PR SYSI”
// หน้าที่: ทำให้ติดตั้งเป็นแอปได้ และเปิดหน้าเว็บได้แม้เน็ตหลุดชั่วคราว
// ข้อมูลงาน (/api/*) และการบันทึกทุกอย่าง "ไม่ผ่านแคช" เพื่อไม่ให้เห็นข้อมูลเก่าหรือบันทึกซ้ำ
const V = 'pr-sysi-v1';
const SHELL = ['/', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon.ico', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;

  // เปิดหน้าเว็บ: ลองเอาฉบับล่าสุดจากเน็ตก่อน (ได้เวอร์ชันใหม่เสมอ) ถ้าเน็ตหลุดใช้ฉบับที่เคยเปิด
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
        .catch(() => caches.match(r).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // ไฟล์คงที่ (ไอคอน ฯลฯ): ใช้ที่แคชไว้ทันที แล้วอัปเดตเงียบๆ ครั้งถัดไป
  e.respondWith(
    caches.match(r).then((hit) => {
      const net = fetch(r)
        .then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
