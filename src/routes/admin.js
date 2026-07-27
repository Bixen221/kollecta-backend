const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { adminAuth }       = require('../middleware/adminAuth');

router.use(authMiddleware, adminAuth);

// GET /api/admin/stats — Statistiques globales et KPIs
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

    // Nouveaux sur les 7 derniers jours
    const [nouveauxUsers, nouveauxDons, nouvellesEncheres] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users WHERE cree_le >= NOW() - INTERVAL '7 days'"),
      db.query("SELECT COUNT(*) FROM dons WHERE cree_le >= NOW() - INTERVAL '7 days'"),
      db.query("SELECT COUNT(*) FROM encheres WHERE cree_le >= NOW() - INTERVAL '7 days'"),
    ]);

    // Taux de dons completes
    const [donsClotures] = await Promise.all([
      db.query("SELECT COUNT(*) FROM dons WHERE statut = 'cloture'"),
    ]);
    const totalDonsNum = parseInt(dons.rows[0].count);
    const tauxCompletion = totalDonsNum > 0
      ? Math.round((parseInt(donsClotures.rows[0].count) / totalDonsNum) * 100)
      : 0;

    // Reservations : confirmees vs annulees
    const [resaConfirmees, resaAnnulees] = await Promise.all([
      db.query("SELECT COUNT(*) FROM reservations WHERE statut = 'cloture'"),
      db.query("SELECT COUNT(*) FROM reservations WHERE statut = 'annule'"),
    ]);

    // Note moyenne globale
    const noteMoyenne = await db.query('SELECT AVG(note_moyenne) as moyenne FROM users WHERE note_moyenne > 0');

    // Volume total enchères en cours
    const volumeEncheres = await db.query("SELECT COALESCE(SUM(offre_actuelle), 0) as total FROM encheres WHERE statut = 'en_cours'");

    // Utilisateurs non verifies
    const nonVerifies = await db.query('SELECT COUNT(*) FROM users WHERE verifie = false');

    res.json({
      success: true,
      stats: {
        total_users:        parseInt(users.rows[0].count),
        total_dons:         totalDonsNum,
        total_encheres:     parseInt(encheres.rows[0].count),
        total_reservations: parseInt(reservations.rows[0].count),
        dons_actifs:        parseInt(donsActifs.rows[0].count),
        encheres_en_cours:  parseInt(encheresEnCours.rows[0].count),
        nouveaux_users_7j:      parseInt(nouveauxUsers.rows[0].count),
        nouveaux_dons_7j:       parseInt(nouveauxDons.rows[0].count),
        nouvelles_encheres_7j:  parseInt(nouvellesEncheres.rows[0].count),
        taux_completion_dons:   tauxCompletion,
        resa_confirmees:        parseInt(resaConfirmees.rows[0].count),
        resa_annulees:          parseInt(resaAnnulees.rows[0].count),
        note_moyenne_globale:   parseFloat(noteMoyenne.rows[0].moyenne || 0).toFixed(1),
        volume_encheres_cours:  parseInt(volumeEncheres.rows[0].total),
        users_non_verifies:     parseInt(nonVerifies.rows[0].count),
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

// GET /api/admin/annonces-sans-photo — Dons et encheres sans image
router.get('/annonces-sans-photo', async (req, res, next) => {
  try {
    const donsSansPhoto = await db.query(`
      SELECT d.id, d.titre, d.type, d.cree_le, u.nom, u.prenom, 'don' as categorie_annonce
      FROM dons d
      JOIN users u ON u.id = d.proprietaire_id
      LEFT JOIN medias m ON m.entite_id = d.id AND m.entite_type = 'don'
      WHERE m.id IS NULL
      ORDER BY d.cree_le DESC
    `);

    const encheresSansPhoto = await db.query(`
      SELECT e.id, e.titre, e.cree_le, u.nom, u.prenom, 'enchere' as categorie_annonce
      FROM encheres e
      JOIN users u ON u.id = e.vendeur_id
      LEFT JOIN medias m ON m.entite_id = e.id AND m.entite_type = 'enchere'
      WHERE m.id IS NULL
      ORDER BY e.cree_le DESC
    `);

    res.json({
      success: true,
      annonces: [...donsSansPhoto.rows, ...encheresSansPhoto.rows],
    });
  } catch (err) { next(err); }
});

module.exports = router;
