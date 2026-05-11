// Firebase sera configuré en Phase 2
// Pour l'instant on exporte un objet vide
const admin = {
  messaging: () => ({
    sendEach: async () => ({ responses: [] }),
  }),
  apps: [true],
  initializeApp: () => {},
};

module.exports = admin;
