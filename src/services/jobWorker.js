const cron = require('node-cron');
const db   = require('../config/db');
const {
  notifConfirmationProprio,
  notifConfirmationDemandeur,
  notifDonCloture,
} = require('./notifService');

// ── Démarrer tous les jobs cron ───────────────────────────
const demarrerJobs = () => {
  console.log('⏰ Jobs cron Kollecta démarrés');

  // Toutes les heures : vérifier les réservations en attente de confirmation
  cron.schedule('0 * * * *', verifierDelais48h);

  // Tous les jours à minuit : clôturer les enchères expirées
  cron.schedule('0 0 * * *', cloturerEncheresExpirees);

  // Toutes les 6h : clôturer les dons expirés
  cron.schedule('0 */6 * * *', cloturerDonsExpires);
};

// ── Job 1: Vérifier délais 48h ────────────────────────────
const verifierDelais48h = async () => {
  try {
    const now = new Date();
    console.log(`[${now.toISOString()}] ⏳ Vérification délais 48h...`);

    // Trouver les réservations contactées dont le délai est dépassé
    // et qui n'ont pas encore les deux confirmations
    const { rows: reservations } = await db.query(`
      SELECT
        r.id,
        r.don_id,
        r.demandeur_id,
        r.confirme_proprio,
        r.confirme_demandeur,
        r.deadline_confirm,
        d.titre        AS titre_don,
        d.proprietaire_id,
        u_prop.nom     AS nom_proprio,
        u_prop.prenom  AS prenom_proprio,
        u_dem.nom      AS nom_demandeur,
        u_dem.prenom   AS prenom_demandeur
      FROM reservations r
      JOIN dons  d      ON d.id = r.don_id
      JOIN users u_prop ON u_prop.id = d.proprietaire_id
      JOIN users u_dem  ON u_dem.id  = r.demandeur_id
      WHERE r.statut = 'contacte'
        AND r.deadline_confirm <= $1
        AND (r.confirme_proprio = FALSE OR r.confirme_demandeur = FALSE)
    `, [now]);

    for (const resa of reservations) {
      // Envoyer notifs de confirmation aux deux parties
      if (!resa.confirme_proprio) {
        await notifConfirmationProprio(
          resa.proprietaire_id,
          resa.titre_don,
          resa.id
        );
      }
      if (!resa.confirme_demandeur) {
        await notifConfirmationDemandeur(
          resa.demandeur_id,
          resa.titre_don,
          resa.id
        );
      }

      // Changer statut vers "en attente de confirmation"
      await db.query(
        `UPDATE reservations SET statut = 'confirme_proprio'
         WHERE id = $1 AND statut = 'contacte'`,
        [resa.id]
      );
    }

    if (reservations.length > 0) {
      console.log(`✅ ${reservations.length} réservation(s) en attente de confirmation notifiées`);
    }
  } catch (err) {
    console.error('❌ Erreur job 48h:', err.message);
  }
};

// ── Job 2: Clôturer enchères expirées ─────────────────────
const cloturerEncheresExpirees = async () => {
  try {
    const { rows } = await db.query(`
      UPDATE encheres
      SET statut = 'termine'
      WHERE statut = 'en_cours'
        AND fin_le <= NOW()
      RETURNING id, titre, vendeur_id, meilleur_offrant_id, offre_actuelle
    `);

    console.log(`✅ ${rows.length} enchère(s) clôturée(s) automatiquement`);
  } catch (err) {
    console.error('❌ Erreur job enchères:', err.message);
  }
};

// ── Job 3: Clôturer dons expirés ──────────────────────────
const cloturerDonsExpires = async () => {
  try {
    const { rows } = await db.query(`
      UPDATE dons
      SET statut = 'cloture'
      WHERE statut = 'actif'
        AND expire_le IS NOT NULL
        AND expire_le <= NOW()
      RETURNING id, titre
    `);

    console.log(`✅ ${rows.length} don(s) expiré(s) clôturé(s)`);
  } catch (err) {
    console.error('❌ Erreur job dons expirés:', err.message);
  }
};

module.exports = { demarrerJobs };
