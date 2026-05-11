const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db         = require('../config/db');
const { genererToken, formatUser } = require('../utils/helpers');

const inscription = async (req, res, next) => {
  try {
    const { nom, prenom, whatsapp, email, password, quartier, ville } = req.body;
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE whatsapp = $1 OR email = $2',
      [whatsapp || null, email || null]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Ce numéro WhatsApp ou email est déjà utilisé.' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (id, nom, prenom, whatsapp, email, password_hash, quartier, ville)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [uuidv4(), nom.trim(), prenom.trim(), whatsapp || null, email || null, password_hash, quartier || null, ville || 'Dakar']
    );
    const token = genererToken(rows[0].id);
    res.status(201).json({ success: true, message: 'Compte créé avec succès. Bienvenue sur Kollecta !', token, user: formatUser(rows[0]) });
  } catch (err) { next(err); }
};

const connexion = async (req, res, next) => {
  try {
    const { whatsapp, email, password } = req.body;
    const { rows } = await db.query(
      'SELECT * FROM users WHERE (whatsapp = $1 OR email = $2) AND actif = TRUE',
      [whatsapp || null, email || null]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
    }
    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
    }
    const token = genererToken(user.id);
    res.json({ success: true, message: 'Connexion réussie.', token, user: formatUser(user) });
  } catch (err) { next(err); }
};

const googleAuth = async (req, res, next) => {
  try {
    const { google_id, email, nom, prenom, avatar_url } = req.body;
    let { rows } = await db.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [google_id, email]
    );
    let user;
    if (rows.length) {
      const { rows: updated } = await db.query(
        `UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3 RETURNING *`,
        [google_id, avatar_url, rows[0].id]
      );
      user = updated[0];
    } else {
      const { rows: created } = await db.query(
        `INSERT INTO users (id, nom, prenom, email, google_id, avatar_url, verifie) VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING *`,
        [uuidv4(), nom, prenom, email, google_id, avatar_url]
      );
      user = created[0];
    }
    const token = genererToken(user.id);
    res.json({ success: true, token, user: formatUser(user) });
  } catch (err) { next(err); }
};

const moi = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json({ success: true, user: formatUser(rows[0]) });
  } catch (err) { next(err); }
};

const mettreAJourProfil = async (req, res, next) => {
  try {
    const { nom, prenom, whatsapp, quartier, ville } = req.body;
    const { rows } = await db.query(
      `UPDATE users SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom),
       whatsapp = COALESCE($3, whatsapp), quartier = COALESCE($4, quartier),
       ville = COALESCE($5, ville) WHERE id = $6 RETURNING *`,
      [nom, prenom, whatsapp, quartier, ville, req.user.id]
    );
    res.json({ success: true, message: 'Profil mis à jour.', user: formatUser(rows[0]) });
  } catch (err) { next(err); }
};

const enregistrerFcmToken = async (req, res, next) => {
  try {
    const { token, plateforme } = req.body;
    await db.query(
      `INSERT INTO fcm_tokens (user_id, token, plateforme) VALUES ($1, $2, $3) ON CONFLICT (token) DO UPDATE SET user_id = $1`,
      [req.user.id, token, plateforme]
    );
    res.json({ success: true, message: 'Token FCM enregistré.' });
  } catch (err) { next(err); }
};

module.exports = { inscription, connexion, googleAuth, moi, mettreAJourProfil, enregistrerFcmToken };
