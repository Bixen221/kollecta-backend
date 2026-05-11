const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { notifNouvelleReservation, notifDonSupprime } = require('../services/notifService');
const { genererLienWhatsApp } = require('../utils/helpers');

// GET /api/dons — Liste tous les dons
const listerDons = async (req, res, next) => {
  try {
    const { type, categorie, quartier, urgent, page = 1, limite = 20 } = req.query;
    const offset = (page - 1) * limite;
    const conditions = ["d.statut = 'actif'", "d.quantite_dispo > 0"];
    const params = [];
    let i = 1;

    if (type)      { conditions.push(`d.type = $${i++}`);      params.push(type); }
    if (categorie) { conditions.push(`d.categorie = $${i++}`); params.push(categorie); }
    if (quartier)  { conditions.push(`d.quartier ILIKE $${i++}`); params.push(`%${quartier}%`); }
    if (urgent === 'true') { conditions.push(`d.urgent = TRUE`); }

    const where = conditions.join(' AND ');

    const { rows } = await db.query(`
      SELECT d.*, 
        u.nom, u.prenom, u.note_moyenne, u.nb_dons,
        COUNT(m.id) AS nb_photos,
        ARRAY_AGG(m.url ORDER BY m.ordre) FILTER (WHERE m.url IS NOT NULL) AS photos
      FROM dons d
      JOIN users u ON u.id = d.proprietaire_id
      LEFT JOIN medias m ON m.entite_id = d.id AND m.entite_type = 'don'
      WHERE ${where}
      GROUP BY d.id, u.nom, u.prenom, u.note_moyenne, u.nb_dons
      ORDER BY d.urgent DESC, d.cree_le DESC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limite, offset]);

    res.json({ success: true, dons: rows, page: Number(page), limite: Number(limite) });
  } catch (err) { next(err); }
};

// GET /api/dons/:id — Détail d'un don
const obtenirDon = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*,
        u.nom, u.prenom, u.whatsapp, u.note_moyenne, u.nb_dons, u.avatar_url,
        ARRAY_AGG(m.url ORDER BY m.ordre) FILTER (WHERE m.url IS NOT NULL) AS photos
      FROM dons d
      JOIN users u ON u.id = d.proprietaire_id
      LEFT JOIN medias m ON m.entite_id = d.id AND m.entite_type = 'don'
      WHERE d.id = $1
      GROUP BY d.id, u.nom, u.prenom, u.whatsapp, u.note_moyenne, u.nb_dons, u.avatar_url
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Don introuvable.' });
    }
    res.json({ success: true, don: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/dons — Créer un don
const creerDon = async (req, res, next) => {
  try {
    const { titre, description, type, categorie, quartier, ville, quantite_total, urgent, expire_le } = req.body;
    const { rows } = await db.query(`
      INSERT INTO dons (id, proprietaire_id, titre, description, type, categorie, quartier, ville, quantite_total, quantite_dispo, urgent, expire_le)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11) RETURNING *
    `, [uuidv4(), req.user.id, titre, description, type, categorie, quartier, ville || 'Dakar', quantite_total || 1, urgent || false, expire_le || null]);

    res.status(201).json({ success: true, message: 'Don publié avec succès !', don: rows[0] });
  } catch (err) { next(err); }
};

// PUT /api/dons/:id — Modifier un don
const modifierDon = async (req, res, next) => {
  try {
    const { titre, description, categorie, quartier, urgent, expire_le } = req.body;
    const { rows: existing } = await db.query('SELECT * FROM dons WHERE id = $1', [req.params.id]);

    if (!existing.length) return res.status(404).json({ success: false, message: 'Don introuvable.' });
    if (existing[0].proprietaire_id !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé.' });

    const { rows } = await db.query(`
      UPDATE dons SET
        titre = COALESCE($1, titre),
        description = COALESCE($2, description),
        categorie = COALESCE($3, categorie),
        quartier = COALESCE($4, quartier),
        urgent = COALESCE($5, urgent),
        expire_le = COALESCE($6, expire_le)
      WHERE id = $7 RETURNING *
    `, [titre, description, categorie, quartier, urgent, expire_le, req.params.id]);

    res.json({ success: true, message: 'Don modifié.', don: rows[0] });
  } catch (err) { next(err); }
};

// DELETE /api/dons/:id — Supprimer un don
const supprimerDon = async (req, res, next) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM dons WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Don introuvable.' });
    if (existing[0].proprietaire_id !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé.' });

    // Notifier les réservants
    const { rows: reservants } = await db.query(
      "SELECT demandeur_id FROM reservations WHERE don_id = $1 AND statut NOT IN ('cloture','annule')",
      [req.params.id]
    );
    for (const r of reservants) {
      await notifDonSupprime(r.demandeur_id, existing[0].titre);
    }

    await db.query("UPDATE dons SET statut = 'supprime' WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: 'Don supprimé. Les réservants ont été notifiés.' });
  } catch (err) { next(err); }
};

// POST /api/dons/:id/reserver — Réserver un don
const reserverDon = async (req, res, next) => {
  try {
    const { rows: don } = await db.query("SELECT * FROM dons WHERE id = $1 AND statut = 'actif'", [req.params.id]);
    if (!don.length) return res.status(404).json({ success: false, message: 'Don introuvable ou inactif.' });
    if (don[0].proprietaire_id === req.user.id) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas réserver votre propre don.' });
    if (don[0].quantite_dispo <= 0) return res.status(400).json({ success: false, message: 'Plus de disponibilités.' });

    const { rows: existing } = await db.query(
      "SELECT id FROM reservations WHERE don_id = $1 AND demandeur_id = $2 AND statut NOT IN ('annule')",
      [req.params.id, req.user.id]
    );
    if (existing.length) return res.status(409).json({ success: false, message: 'Vous avez déjà réservé ce don.' });

    const { rows } = await db.query(`
      INSERT INTO reservations (id, don_id, demandeur_id) VALUES ($1,$2,$3) RETURNING *
    `, [uuidv4(), req.params.id, req.user.id]);

    await db.query('UPDATE dons SET quantite_dispo = quantite_dispo - 1 WHERE id = $1', [req.params.id]);

    const demandeurNom = `${req.user.prenom} ${req.user.nom}`;
    await notifNouvelleReservation(don[0].proprietaire_id, demandeurNom, don[0].titre, rows[0].id);

    res.status(201).json({ success: true, message: 'Réservation confirmée ! Le propriétaire vous contactera sous 48h.', reservation: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/dons/reservations/:id/confirmer — Confirmer la réception
const confirmerDon = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { rows: resa } = await db.query(`
      SELECT r.*, d.titre, d.proprietaire_id FROM reservations r
      JOIN dons d ON d.id = r.don_id WHERE r.id = $1
    `, [req.params.id]);

    if (!resa.length) return res.status(404).json({ success: false, message: 'Réservation introuvable.' });

    const r = resa[0];
    let update = {};

    if (role === 'proprio' && r.proprietaire_id === req.user.id) {
      update = { confirme_proprio: true };
      await db.query('UPDATE reservations SET confirme_proprio = TRUE, statut = $1 WHERE id = $2',
        [r.confirme_demandeur ? 'cloture' : 'confirme_proprio', r.id]);
    } else if (role === 'demandeur' && r.demandeur_id === req.user.id) {
      await db.query('UPDATE reservations SET confirme_demandeur = TRUE, statut = $1 WHERE id = $2',
        [r.confirme_proprio ? 'cloture' : 'confirme_demandeur', r.id]);
    } else {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    // Si les deux ont confirmé, clôturer le don
    const { rows: updated } = await db.query('SELECT * FROM reservations WHERE id = $1', [r.id]);
    if (updated[0].confirme_proprio && updated[0].confirme_demandeur) {
      await db.query("UPDATE reservations SET statut = 'cloture' WHERE id = $1", [r.id]);
      await db.query("UPDATE users SET nb_dons = nb_dons + 1 WHERE id = $1", [r.proprietaire_id]);
    }

    res.json({ success: true, message: 'Confirmation enregistrée.' });
  } catch (err) { next(err); }
};

// GET /api/dons/mes-dons — Mes dons publiés
const mesDons = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*,
        COUNT(r.id) FILTER (WHERE r.statut NOT IN ('annule','cloture')) AS nb_reservations,
        ARRAY_AGG(m.url ORDER BY m.ordre) FILTER (WHERE m.url IS NOT NULL) AS photos
      FROM dons d
      LEFT JOIN reservations r ON r.don_id = d.id
      LEFT JOIN medias m ON m.entite_id = d.id AND m.entite_type = 'don'
      WHERE d.proprietaire_id = $1 AND d.statut != 'supprime'
      GROUP BY d.id ORDER BY d.cree_le DESC
    `, [req.user.id]);
    res.json({ success: true, dons: rows });
  } catch (err) { next(err); }
};

// GET /api/dons/reservations/mes-reservations — Mes réservations
const mesReservations = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, d.titre, d.type, d.quartier, d.ville,
        u.nom, u.prenom, u.whatsapp,
        CASE WHEN u.whatsapp IS NOT NULL 
          THEN 'https://wa.me/' || REPLACE(u.whatsapp, '+', '') 
          ELSE NULL END AS lien_whatsapp
      FROM reservations r
      JOIN dons d ON d.id = r.don_id
      JOIN users u ON u.id = d.proprietaire_id
      WHERE r.demandeur_id = $1
      ORDER BY r.cree_le DESC
    `, [req.user.id]);
    res.json({ success: true, reservations: rows });
  } catch (err) { next(err); }
};

module.exports = { listerDons, obtenirDon, creerDon, modifierDon, supprimerDon, reserverDon, confirmerDon, mesDons, mesReservations };
