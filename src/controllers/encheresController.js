const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// GET /api/encheres — Lister les enchères
const listerEncheres = async (req, res, next) => {
  try {
    const { statut, categorie, page = 1, limite = 20 } = req.query;
    const offset = (page - 1) * limite;
    const conditions = ["e.statut != 'annule'"];
    const params = [];
    let i = 1;

    if (statut)    { conditions.push(`e.statut = $${i++}`);    params.push(statut); }
    if (categorie) { conditions.push(`e.categorie = $${i++}`); params.push(categorie); }

    const where = conditions.join(' AND ');

    const { rows } = await db.query(`
      SELECT e.*,
        u.nom, u.prenom, u.note_moyenne,
        COUNT(o.id) AS nb_offres,
        ARRAY_AGG(m.url ORDER BY m.ordre) FILTER (WHERE m.url IS NOT NULL) AS photos
      FROM encheres e
      JOIN users u ON u.id = e.vendeur_id
      LEFT JOIN offres o ON o.enchere_id = e.id
      LEFT JOIN medias m ON m.entite_id = e.id AND m.entite_type = 'enchere'
      WHERE ${where}
      GROUP BY e.id, u.nom, u.prenom, u.note_moyenne
      ORDER BY e.statut = 'en_cours' DESC, e.debut_le ASC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limite, offset]);

    res.json({ success: true, encheres: rows, page: Number(page), limite: Number(limite) });
  } catch (err) { next(err); }
};

// GET /api/encheres/:id — Détail d'une enchère
const obtenirEnchere = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*,
        u.nom, u.prenom, u.whatsapp, u.note_moyenne, u.avatar_url,
        ARRAY_AGG(DISTINCT m.url ORDER BY m.url) FILTER (WHERE m.url IS NOT NULL) AS photos
      FROM encheres e
      JOIN users u ON u.id = e.vendeur_id
      LEFT JOIN medias m ON m.entite_id = e.id AND m.entite_type = 'enchere'
      WHERE e.id = $1
      GROUP BY e.id, u.nom, u.prenom, u.whatsapp, u.note_moyenne, u.avatar_url
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Enchère introuvable.' });

    // Récupérer les dernières offres
    const { rows: offres } = await db.query(`
      SELECT o.*, u.nom, u.prenom
      FROM offres o
      JOIN users u ON u.id = o.offreur_id
      WHERE o.enchere_id = $1
      ORDER BY o.montant DESC LIMIT 10
    `, [req.params.id]);

    res.json({ success: true, enchere: rows[0], offres });
  } catch (err) { next(err); }
};

// POST /api/encheres — Créer une enchère
const creerEnchere = async (req, res, next) => {
  try {
    const { titre, description, categorie, quartier, ville, prix_depart, debut_le, fin_le } = req.body;

    if (new Date(fin_le) <= new Date(debut_le)) {
      return res.status(400).json({ success: false, message: 'La date de fin doit être après la date de début.' });
    }

    const statut = new Date(debut_le) <= new Date() ? 'en_cours' : 'a_venir';

    const { rows } = await db.query(`
      INSERT INTO encheres (id, vendeur_id, titre, description, categorie, quartier, ville, prix_depart, offre_actuelle, statut, debut_le, fin_le)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11) RETURNING *
    `, [uuidv4(), req.user.id, titre, description, categorie, quartier, ville || 'Dakar', prix_depart, statut, debut_le, fin_le]);

    res.status(201).json({ success: true, message: 'Enchère créée avec succès !', enchere: rows[0] });
  } catch (err) { next(err); }
};

// PUT /api/encheres/:id — Modifier une enchère
const modifierEnchere = async (req, res, next) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM encheres WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Enchère introuvable.' });
    if (existing[0].vendeur_id !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé.' });
    if (existing[0].statut === 'en_cours') return res.status(400).json({ success: false, message: 'Impossible de modifier une enchère en cours.' });

    const { titre, description, categorie, quartier, prix_depart, debut_le, fin_le } = req.body;
    const { rows } = await db.query(`
      UPDATE encheres SET
        titre = COALESCE($1, titre),
        description = COALESCE($2, description),
        categorie = COALESCE($3, categorie),
        quartier = COALESCE($4, quartier),
        prix_depart = COALESCE($5, prix_depart),
        debut_le = COALESCE($6, debut_le),
        fin_le = COALESCE($7, fin_le)
      WHERE id = $8 RETURNING *
    `, [titre, description, categorie, quartier, prix_depart, debut_le, fin_le, req.params.id]);

    res.json({ success: true, message: 'Enchère modifiée.', enchere: rows[0] });
  } catch (err) { next(err); }
};

// DELETE /api/encheres/:id — Annuler une enchère
const annulerEnchere = async (req, res, next) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM encheres WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Enchère introuvable.' });
    if (existing[0].vendeur_id !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé.' });
    if (existing[0].statut === 'termine') return res.status(400).json({ success: false, message: 'Enchère déjà terminée.' });

    await db.query("UPDATE encheres SET statut = 'annule' WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: 'Enchère annulée.' });
  } catch (err) { next(err); }
};

// POST /api/encheres/:id/offrir — Placer une offre
const placerOffre = async (req, res, next) => {
  try {
    const { montant } = req.body;
    const { rows: enchere } = await db.query("SELECT * FROM encheres WHERE id = $1 AND statut = 'en_cours'", [req.params.id]);

    if (!enchere.length) return res.status(404).json({ success: false, message: 'Enchère introuvable ou non active.' });
    if (enchere[0].vendeur_id === req.user.id) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas enchérir sur votre propre article.' });
    if (new Date() > new Date(enchere[0].fin_le)) return res.status(400).json({ success: false, message: 'Cette enchère est terminée.' });
    if (montant <= enchere[0].offre_actuelle) return res.status(400).json({ success: false, message: `L'offre doit être supérieure à ${enchere[0].offre_actuelle} FCFA.` });

    // Enregistrer l'offre
    const { rows: offre } = await db.query(
      'INSERT INTO offres (id, enchere_id, offreur_id, montant) VALUES ($1,$2,$3,$4) RETURNING *',
      [uuidv4(), req.params.id, req.user.id, montant]
    );

    // Mettre à jour l'enchère
    await db.query(
      'UPDATE encheres SET offre_actuelle = $1, meilleur_offrant_id = $2, nb_offres = nb_offres + 1 WHERE id = $3',
      [montant, req.user.id, req.params.id]
    );

    res.status(201).json({ success: true, message: 'Offre placée avec succès !', offre: offre[0] });
  } catch (err) { next(err); }
};

// GET /api/encheres/mes-encheres — Mes enchères
const mesEncheres = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, COUNT(o.id) AS nb_offres
      FROM encheres e
      LEFT JOIN offres o ON o.enchere_id = e.id
      WHERE e.vendeur_id = $1 AND e.statut != 'annule'
      GROUP BY e.id ORDER BY e.cree_le DESC
    `, [req.user.id]);
    res.json({ success: true, encheres: rows });
  } catch (err) { next(err); }
};

module.exports = { listerEncheres, obtenirEnchere, creerEnchere, modifierEnchere, annulerEnchere, placerOffre, mesEncheres };
