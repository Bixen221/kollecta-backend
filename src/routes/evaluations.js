const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

// POST /api/evaluations — Évaluer un utilisateur après un don clôturé
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { evalue_id, don_id, note, commentaire } = req.body;

    if (!note || note < 1 || note > 5) {
      return res.status(400).json({ success: false, message: 'La note doit être entre 1 et 5.' });
    }
    if (evalue_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous évaluer vous-même.' });
    }

    // Vérifier que le don existe, est clôturé, et que l'évaluateur y a participé
    const { rows: resas } = await db.query(`
      SELECT r.*, d.proprietaire_id FROM reservations r
      JOIN dons d ON d.id = r.don_id
      WHERE r.don_id = $1 AND r.statut = 'cloture'
        AND (r.demandeur_id = $2 OR d.proprietaire_id = $2)
    `, [don_id, req.user.id]);

    if (!resas.length) {
      return res.status(403).json({ success: false, message: 'Vous ne pouvez évaluer que les dons complétés auxquels vous avez participé.' });
    }

    // Vérifier que l'évalué a bien participé au même don
    const resa = resas[0];
    const participants = [resa.demandeur_id, resa.proprietaire_id];
    if (!participants.includes(evalue_id)) {
      return res.status(400).json({ success: false, message: 'Cet utilisateur n\'a pas participé à ce don.' });
    }

    // Vérifier qu'on n'a pas déjà évalué ce don
    const { rows: existing } = await db.query(
      'SELECT id FROM evaluations WHERE evaluateur_id = $1 AND don_id = $2',
      [req.user.id, don_id]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà évalué ce don.' });
    }

    // Créer l'évaluation
    const { rows } = await db.query(`
      INSERT INTO evaluations (id, evaluateur_id, evalue_id, don_id, note, commentaire)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [uuidv4(), req.user.id, evalue_id, don_id, note, commentaire || null]);

    // Mettre à jour la note moyenne de l'évalué
    await db.query(`
      UPDATE users SET
        note_moyenne = (SELECT ROUND(AVG(note)::numeric, 1) FROM evaluations WHERE evalue_id = $1),
        nb_evaluations = (SELECT COUNT(*) FROM evaluations WHERE evalue_id = $1)
      WHERE id = $1
    `, [evalue_id]);

    res.status(201).json({ success: true, message: 'Évaluation enregistrée. Merci !', evaluation: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/evaluations/utilisateur/:userId — Évaluations reçues par un utilisateur
router.get('/utilisateur/:userId', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, u.nom, u.prenom, d.titre AS titre_don
      FROM evaluations e
      JOIN users u ON u.id = e.evaluateur_id
      LEFT JOIN dons d ON d.id = e.don_id
      WHERE e.evalue_id = $1
      ORDER BY e.cree_le DESC LIMIT 50
    `, [req.params.userId]);
    res.json({ success: true, evaluations: rows });
  } catch (err) { next(err); }
});

// GET /api/evaluations/don/:donId — Vérifier si j'ai déjà évalué ce don
router.get('/don/:donId', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM evaluations WHERE evaluateur_id = $1 AND don_id = $2',
      [req.user.id, req.params.donId]
    );
    res.json({ success: true, dejaEvalue: rows.length > 0 });
  } catch (err) { next(err); }
});

module.exports = router;
