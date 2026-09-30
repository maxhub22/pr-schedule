const { getUser } = require('./auth');
const { BadInput } = require('./validate');

// ห่อ handler: จัดการ error, no-store, และตรวจสิทธิ์เมื่อ needAuth = true
function route(methods, needAuth, fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!methods.includes(req.method)) return res.status(405).json({ error: 'method not allowed' });
      let user = null;
      if (needAuth) {
        user = getUser(req);
        if (!user) return res.status(401).json({ error: 'ต้องล็อกอินก่อน' });
        const ct = String(req.headers['content-type'] || '');
        if (req.method === 'POST' && !ct.includes('application/json')) return res.status(415).json({ error: 'ต้องเป็น JSON' });
      }
      return await fn(req, res, user);
    } catch (e) {
      if (e instanceof BadInput) return res.status(400).json({ error: e.message });
      console.error(e);
      return res.status(500).json({ error: e.message || 'server error' });
    }
  };
}
module.exports = { route };
