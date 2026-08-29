const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// POST /api/messages/demarrer — Démarre (ou récupère) une conversation liée à un don/enchère
const demarrerConversation = async (req, res, next) => {
  try {
    const { entite_type, entite_id, demandeur_id } = req.body;
    if (!['don', 'enchere'].includes(entite_type)) {
      return res.status(400).json({ success: false, message: 'entite_type invalide.' });
    }

    const table = entite_type === 'don' ? 'dons' : 'encheres';
    const colonneProprio = entite_type === 'don' ? 'proprietaire_id' : 'vendeur_id';
    const { rows: entite } = await db.query(
      `SELECT id, ${colonneProprio} AS proprietaire_id, titre FROM ${table} WHERE id = $1`,
      [entite_id]
    );
    if (!entite.length) {
      return res.status(404).json({ success: false, message: 'Don ou enchère introuvable.' });
    }

    const proprietaireId = entite[0].proprietaire_id;

    // Si l'appelant est le propriétaire, il doit préciser avec qui démarrer la conversation
    // (ex: un candidat depuis la liste des réservations). Sinon, l'appelant est le demandeur.
    let demandeurFinal;
    if (req.user.id === proprietaireId) {
      if (!demandeur_id) {
        return res.status(400).json({ success: false, message: 'demandeur_id requis pour le propriétaire.' });
      }
      demandeurFinal = demandeur_id;
    } else {
      demandeurFinal = req.user.id;
    }

    if (proprietaireId === demandeurFinal) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas démarrer une conversation avec vous-même.' });
    }

    const { rows: existing } = await db.query(
      `SELECT * FROM conversations WHERE entite_type = $1 AND entite_id = $2 AND demandeur_id = $3`,
      [entite_type, entite_id, demandeurFinal]
    );
    if (existing.length) {
      return res.json({ success: true, conversation: existing[0] });
    }

    const { rows } = await db.query(`
      INSERT INTO conversations (id, entite_type, entite_id, proprietaire_id, demandeur_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [uuidv4(), entite_type, entite_id, proprietaireId, demandeurFinal]);

    res.status(201).json({ success: true, conversation: rows[0] });
  } catch (err) { next(err); }
};

// GET /api/messages/conversations — Liste des conversations de l'utilisateur
const listerConversations = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*,
        CASE WHEN c.proprietaire_id = $1 THEN autre.nom ELSE proprio.nom END AS autre_nom,
        CASE WHEN c.proprietaire_id = $1 THEN autre.prenom ELSE proprio.prenom END AS autre_prenom,
        (SELECT contenu FROM messages WHERE conversation_id = c.id ORDER BY cree_le DESC LIMIT 1) AS dernier_message,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND expediteur_id != $1 AND lu = FALSE) AS non_lus
      FROM conversations c
      JOIN users proprio ON proprio.id = c.proprietaire_id
      JOIN users autre ON autre.id = c.demandeur_id
      WHERE c.proprietaire_id = $1 OR c.demandeur_id = $1
      ORDER BY c.dernier_message_le DESC
    `, [req.user.id]);
    res.json({ success: true, conversations: rows });
  } catch (err) { next(err); }
};

// GET /api/messages/conversations/:id — Messages d'une conversation
const obtenirMessages = async (req, res, next) => {
  try {
    const { rows: conv } = await db.query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (!conv.length) return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    if (conv[0].proprietaire_id !== req.user.id && conv[0].demandeur_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    const { rows: messages } = await db.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY cree_le ASC',
      [req.params.id]
    );

    // Marquer comme lus les messages reçus (pas envoyés par moi)
    await db.query(
      'UPDATE messages SET lu = TRUE WHERE conversation_id = $1 AND expediteur_id != $2 AND lu = FALSE',
      [req.params.id, req.user.id]
    );

    res.json({ success: true, conversation: conv[0], messages });
  } catch (err) { next(err); }
};

// POST /api/messages/conversations/:id — Envoyer un message
const envoyerMessage = async (req, res, next) => {
  try {
    const { contenu } = req.body;
    if (!contenu || !contenu.trim()) {
      return res.status(400).json({ success: false, message: 'Le message ne peut pas être vide.' });
    }

    const { rows: conv } = await db.query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (!conv.length) return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    if (conv[0].proprietaire_id !== req.user.id && conv[0].demandeur_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    const { rows } = await db.query(`
      INSERT INTO messages (id, conversation_id, expediteur_id, contenu)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [uuidv4(), req.params.id, req.user.id, contenu.trim()]);

    await db.query('UPDATE conversations SET dernier_message_le = NOW() WHERE id = $1', [req.params.id]);

    res.status(201).json({ success: true, message: rows[0] });
  } catch (err) { next(err); }
};

module.exports = { demarrerConversation, listerConversations, obtenirMessages, envoyerMessage };
