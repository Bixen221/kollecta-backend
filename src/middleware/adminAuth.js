const db = require('../config/db');

const adminAuth = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT est_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length || !rows[0].est_admin) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
  } catch (err) { next(err); }
};

module.exports = { adminAuth };
