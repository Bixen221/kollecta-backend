const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  demarrerConversation,
  listerConversations,
  obtenirMessages,
  envoyerMessage,
} = require('../controllers/messagesController');

const { authMiddleware } = require('../middleware/auth');
const { validate }       = require('../middleware/errorHandler');

router.post('/demarrer', authMiddleware, [
  body('entite_type').isIn(['don', 'enchere']).withMessage('Type invalide'),
  body('entite_id').notEmpty().withMessage('entite_id requis'),
], validate, demarrerConversation);

router.get('/conversations', authMiddleware, listerConversations);
router.get('/conversations/:id', authMiddleware, obtenirMessages);
router.post('/conversations/:id', authMiddleware, [
  body('contenu').trim().notEmpty().withMessage('Le message ne peut pas être vide'),
], validate, envoyerMessage);

module.exports = router;
