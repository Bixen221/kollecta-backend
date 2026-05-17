const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications — Mes notifications
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY cree_le DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, notifications: rows });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/lire — Marquer comme lu
router.put('/:id/lire', authMiddleware, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET lu = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /api/notifications/lire-tout — Tout marquer comme lu
router.put('/lire-tout', authMiddleware, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET lu = TRUE WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
