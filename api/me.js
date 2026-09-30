const { getUser } = require('../lib/auth');
const { route } = require('../lib/http');

module.exports = route(['GET'], false, async (req, res) => {
  res.status(200).json({ user: getUser(req) });
});
