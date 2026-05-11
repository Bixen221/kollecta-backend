const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant. Veuillez vous connecter.' });
    }
    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, nom, prenom, whatsapp, email, verifie, actif FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length || !rows[0].actif) {
      return res.status(401).json({ success: false, message: 'Compte introuvable ou désactivé.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expirée. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
};

module.exports = { authMiddleware };
