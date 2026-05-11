const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const demarrerSocket = (server) => {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  // Authentification WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Token manquant'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await db.query('SELECT id, nom, prenom FROM users WHERE id = $1', [decoded.id]);
      if (!rows.length) return next(new Error('Utilisateur introuvable'));
      socket.user = rows[0];
      next();
    } catch (err) {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 ${socket.user.prenom} ${socket.user.nom} connecté`);

    // Rejoindre la salle d'une enchère
    socket.on('rejoindre_enchere', (enchere_id) => {
      socket.join(`enchere_${enchere_id}`);
      console.log(`👤 ${socket.user.prenom} a rejoint l'enchère ${enchere_id}`);
    });

    // Quitter la salle d'une enchère
    socket.on('quitter_enchere', (enchere_id) => {
      socket.leave(`enchere_${enchere_id}`);
    });

    // Placer une offre en temps réel
    socket.on('placer_offre', async (data) => {
      try {
        const { enchere_id, montant } = data;
        const { rows: enchere } = await db.query(
          "SELECT * FROM encheres WHERE id = $1 AND statut = 'en_cours'",
          [enchere_id]
        );

        if (!enchere.length) {
          return socket.emit('erreur_offre', { message: 'Enchère introuvable ou non active.' });
        }
        if (enchere[0].vendeur_id === socket.user.id) {
          return socket.emit('erreur_offre', { message: 'Vous ne pouvez pas enchérir sur votre propre article.' });
        }
        if (new Date() > new Date(enchere[0].fin_le)) {
          return socket.emit('erreur_offre', { message: 'Cette enchère est terminée.' });
        }
        if (montant <= enchere[0].offre_actuelle) {
          return socket.emit('erreur_offre', {
            message: `L'offre doit être supérieure à ${enchere[0].offre_actuelle} FCFA.`
          });
        }

        // Enregistrer l'offre
        const { v4: uuidv4 } = require('uuid');
        await db.query(
          'INSERT INTO offres (id, enchere_id, offreur_id, montant) VALUES ($1,$2,$3,$4)',
          [uuidv4(), enchere_id, socket.user.id, montant]
        );

        // Mettre à jour l'enchère
        await db.query(
          'UPDATE encheres SET offre_actuelle = $1, meilleur_offrant_id = $2, nb_offres = nb_offres + 1 WHERE id = $3',
          [montant, socket.user.id, enchere_id]
        );

        // Diffuser la nouvelle offre à tous dans la salle
        io.to(`enchere_${enchere_id}`).emit('nouvelle_offre', {
          enchere_id,
          montant,
          offreur: {
            id:     socket.user.id,
            nom:    socket.user.nom,
            prenom: socket.user.prenom,
          },
          cree_le: new Date().toISOString(),
        });

        console.log(`💰 Offre de ${montant} FCFA par ${socket.user.prenom} sur l'enchère ${enchere_id}`);
      } catch (err) {
        console.error('❌ Erreur offre WebSocket:', err.message);
        socket.emit('erreur_offre', { message: 'Erreur serveur.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 ${socket.user.prenom} déconnecté`);
    });
  });

  return io;
};

module.exports = { demarrerSocket };
