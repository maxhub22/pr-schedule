const { clearSession } = require('../lib/auth');
const { route } = require('../lib/http');

module.exports = route(['POST'], false, async (req, res) => {
  clearSession(res);
  res.status(200).json({ ok: true });
});
