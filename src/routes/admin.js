const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { adminAuth }       = require('../middleware/adminAuth');

router.use(authMiddleware, adminAuth);

// GET /api/admin/stats — Statistiques globales
router.get('/stats', async (req, res, next) => {
  try {
    const [users, dons, encheres, reservations] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM dons'),
      db.query('SELECT COUNT(*) FROM encheres'),
      db.query('SELECT COUNT(*) FROM reservations'),
    ]);
    const [donsActifs, encheresEnCours] = await Promise.all([
      db.query("SELECT COUNT(*) FROM dons WHERE statut = 'actif'"),
      db.query("SELECT COUNT(*) FROM encheres WHERE statut = 'en_cours'"),
    ]);

    res.json({
      success: true,
      stats: {
        total_users:        parseInt(users.rows[0].count),
        total_dons:         parseInt(dons.rows[0].count),
        total_encheres:     parseInt(encheres.rows[0].count),
        total_reservations: parseInt(reservations.rows[0].count),
        dons_actifs:        parseInt(donsActifs.rows[0].count),
        encheres_en_cours:  parseInt(encheresEnCours.rows[0].count),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/admin/users — Liste des utilisateurs
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, nom, prenom, whatsapp, quartier, ville, avatar_url,
             note_moyenne, nb_dons, verifie, est_admin, cree_le
      FROM users ORDER BY cree_le DESC
    `);
    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
});

// PUT /api/admin/users/:id/verifier — Vérifier/dévérifier un utilisateur
router.put('/users/:id/verifier', async (req, res, next) => {
  try {
    const { verifie } = req.body;
    await db.query('UPDATE users SET verifie = $1 WHERE id = $2', [verifie, req.params.id]);
    res.json({ success: true, message: 'Statut mis à jour.' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/users/:id — Supprimer un utilisateur
router.delete('/users/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Utilisateur supprimé.' });
  } catch (err) { next(err); }
});

// GET /api/admin/dons — Liste de tous les dons
router.get('/dons', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, u.nom, u.prenom
      FROM dons d JOIN users u ON u.id = d.proprietaire_id
      ORDER BY d.cree_le DESC
    `);
    res.json({ success: true, dons: rows });
  } catch (err) { next(err); }
});

// DELETE /api/admin/dons/:id — Supprimer un don
router.delete('/dons/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM dons WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Don supprimé.' });
  } catch (err) { next(err); }
});

// GET /api/admin/encheres — Liste de toutes les enchères
router.get('/encheres', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, u.nom, u.prenom
      FROM encheres e JOIN users u ON u.id = e.vendeur_id
      ORDER BY e.cree_le DESC
    `);
    res.json({ success: true, encheres: rows });
  } catch (err) { next(err); }
});

// DELETE /api/admin/encheres/:id — Supprimer une enchère
router.delete('/encheres/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM encheres WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Enchère supprimée.' });
  } catch (err) { next(err); }
});

module.exports = router;
