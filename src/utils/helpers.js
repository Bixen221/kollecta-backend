const jwt = require('jsonwebtoken');

const genererToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const formatUser = (user) => ({
  id:           user.id,
  nom:          user.nom,
  prenom:       user.prenom,
  whatsapp:     user.whatsapp,
  email:        user.email,
  quartier:     user.quartier,
  ville:        user.ville,
  avatar_url:   user.avatar_url,
  note_moyenne: user.note_moyenne,
  nb_dons:      user.nb_dons,
  verifie:      user.verifie,
  cree_le:      user.cree_le,
});

const genererLienWhatsApp = (numeroWhatsapp, nomDon) => {
  const numero  = numeroWhatsapp.replace(/\D/g, '');
  const message = encodeURIComponent(
    `Bonjour ! Je vous contacte via Kollecta concernant votre annonce : "${nomDon}".`
  );
  return `https://wa.me/${numero}?text=${message}`;
};

module.exports = { genererToken, formatUser, genererLienWhatsApp };
