const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      userId: user.user_id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'You must create a user ID and login first.',
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

module.exports = {
  generateToken,
  requireAuth,
};
