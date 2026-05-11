const db = require('../config/db');
const { cloudinary } = require('../config/cloudinary');
const { v4: uuidv4 } = require('uuid');

// POST /api/medias/upload — Upload une photo
const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie.' });
    }

    const { entite_type, entite_id, ordre = 0 } = req.body;

    if (!['don', 'enchere'].includes(entite_type)) {
      return res.status(400).json({ success: false, message: 'Type invalide. Utilisez don ou enchere.' });
    }

    // Vérifier que l'entité appartient à l'utilisateur
    const table = entite_type === 'don' ? 'dons' : 'encheres';
    const col   = entite_type === 'don' ? 'proprietaire_id' : 'vendeur_id';
    const { rows } = await db.query(`SELECT id FROM ${table} WHERE id = $1 AND ${col} = $2`, [entite_id, req.user.id]);

    if (!rows.length) {
      return res.status(403).json({ success: false, message: 'Non autorisé ou annonce introuvable.' });
    }

    // Compter les photos existantes (max 5)
    const { rows: count } = await db.query(
      'SELECT COUNT(*) FROM medias WHERE entite_id = $1 AND entite_type = $2',
      [entite_id, entite_type]
    );
    if (parseInt(count[0].count) >= 5) {
      return res.status(400).json({ success: false, message: 'Maximum 5 photos par annonce.' });
    }

    // Sauvegarder en BDD
    const { rows: media } = await db.query(
      'INSERT INTO medias (id, entite_type, entite_id, url, public_id, ordre) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [uuidv4(), entite_type, entite_id, req.file.path, req.file.filename, ordre]
    );

    res.status(201).json({ success: true, message: 'Photo uploadée avec succès !', media: media[0] });
  } catch (err) { next(err); }
};

// DELETE /api/medias/:id — Supprimer une photo
const supprimerPhoto = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT m.*, 
        CASE WHEN m.entite_type = 'don' THEN d.proprietaire_id ELSE e.vendeur_id END AS owner_id
      FROM medias m
      LEFT JOIN dons d ON d.id = m.entite_id AND m.entite_type = 'don'
      LEFT JOIN encheres e ON e.id = m.entite_id AND m.entite_type = 'enchere'
      WHERE m.id = $1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Photo introuvable.' });
    if (rows[0].owner_id !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé.' });

    // Supprimer de Cloudinary
    if (rows[0].public_id) {
      await cloudinary.uploader.destroy(rows[0].public_id);
    }

    await db.query('DELETE FROM medias WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Photo supprimée.' });
  } catch (err) { next(err); }
};

// GET /api/medias/:entite_type/:entite_id — Photos d'une annonce
const obtenirPhotos = async (req, res, next) => {
  try {
    const { entite_type, entite_id } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM medias WHERE entite_type = $1 AND entite_id = $2 ORDER BY ordre ASC',
      [entite_type, entite_id]
    );
    res.json({ success: true, photos: rows });
  } catch (err) { next(err); }
};

module.exports = { uploadPhoto, supprimerPhoto, obtenirPhotos };
