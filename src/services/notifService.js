const db    = require('../config/db');
const admin = require('../config/firebase');

// ── Envoyer une notification push ─────────────────────────
const envoyerNotification = async (userId, { type, titre, message, entiteId = null }) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Sauvegarder en BDD
    await client.query(
      `INSERT INTO notifications (user_id, type, titre, message, entite_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, titre, message, entiteId]
    );

    // 2. Récupérer les tokens FCM de l'utilisateur
    const { rows: tokens } = await client.query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    // 3. Envoyer les push notifications Firebase
    if (tokens.length > 0) {
      const messages = tokens.map(({ token }) => ({
        token,
        notification: { title: titre, body: message },
        data: {
          type,
          entite_id: entiteId || '',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        android: { priority: 'high' },
        apns:    { payload: { aps: { badge: 1, sound: 'default' } } },
      }));

      // Envoyer en batch
      const results = await admin.messaging().sendEach(messages);

      // Nettoyer les tokens invalides
      const tokensInvalides = tokens
        .filter((_, i) => results.responses[i]?.error?.code === 'messaging/registration-token-not-registered')
        .map(t => t.token);

      if (tokensInvalides.length > 0) {
        await db.query(
          'DELETE FROM fcm_tokens WHERE token = ANY($1)',
          [tokensInvalides]
        );
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur notification:', err.message);
  } finally {
    client.release();
  }
};

// ── Notifications spécifiques au flux don ─────────────────

// Notif proprio : nouvelle réservation
const notifNouvelleReservation = async (proprietaireId, demandeurNom, titreDon, reservationId) => {
  await envoyerNotification(proprietaireId, {
    type:     'reservation',
    titre:    '🎁 Nouvelle réservation',
    message:  `${demandeurNom} a réservé votre don "${titreDon}". Contactez-le via WhatsApp.`,
    entiteId: reservationId,
  });
};

// Notif demandeur : proprio a initié le contact
const notifContactInitie = async (demandeurId, proprietaireNom, titreDon, reservationId) => {
  await envoyerNotification(demandeurId, {
    type:     'contact',
    titre:    '📱 Contact WhatsApp',
    message:  `${proprietaireNom} vous a contacté pour le don "${titreDon}". Répondez-lui !`,
    entiteId: reservationId,
  });
};

// Notif confirmation 48h — proprio
const notifConfirmationProprio = async (proprietaireId, titreDon, reservationId) => {
  await envoyerNotification(proprietaireId, {
    type:     'confirmation_requise',
    titre:    '✅ Confirmez le don',
    message:  `48h se sont écoulées. Avez-vous remis le don "${titreDon}" ?`,
    entiteId: reservationId,
  });
};

// Notif confirmation 48h — demandeur
const notifConfirmationDemandeur = async (demandeurId, titreDon, reservationId) => {
  await envoyerNotification(demandeurId, {
    type:     'confirmation_requise',
    titre:    '✅ Confirmez la réception',
    message:  `48h se sont écoulées. Avez-vous reçu le don "${titreDon}" ?`,
    entiteId: reservationId,
  });
};

// Notif don clôturé avec succès
const notifDonCloture = async (userId, titreDon) => {
  await envoyerNotification(userId, {
    type:     'don_cloture',
    titre:    '🎉 Don confirmé !',
    message:  `Le don "${titreDon}" a été confirmé des deux côtés. Merci pour votre générosité !`,
  });
};

// Notif don supprimé — réservants
const notifDonSupprime = async (demandeurId, titreDon) => {
  await envoyerNotification(demandeurId, {
    type:     'don_supprime',
    titre:    '❌ Réservation annulée',
    message:  `Le don "${titreDon}" a été supprimé par le propriétaire.`,
  });
};

module.exports = {
  envoyerNotification,
  notifNouvelleReservation,
  notifContactInitie,
  notifConfirmationProprio,
  notifConfirmationDemandeur,
  notifDonCloture,
  notifDonSupprime,
};
