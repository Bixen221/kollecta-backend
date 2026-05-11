const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  inscription,
  connexion,
  googleAuth,
  moi,
  mettreAJourProfil,
  enregistrerFcmToken,
} = require('../controllers/authController');

const { authMiddleware } = require('../middleware/auth');
const { validate }       = require('../middleware/errorHandler');

router.post('/inscription', [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire'),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit avoir au moins 8 caractères'),
  body('whatsapp').optional().matches(/^(\+221|221)?[0-9]{9}$/).withMessage('Numéro WhatsApp invalide'),
  body('email').optional().isEmail().withMessage('Email invalide'),
], validate, inscription);

router.post('/connexion', [
  body('password').notEmpty().withMessage('Le mot de passe est obligatoire'),
], validate, connexion);

router.post('/google', [
  body('google_id').notEmpty().withMessage('google_id obligatoire'),
  body('email').isEmail().withMessage('Email invalide'),
  body('nom').notEmpty().withMessage('Nom obligatoire'),
  body('prenom').notEmpty().withMessage('Prénom obligatoire'),
], validate, googleAuth);

router.get('/moi', authMiddleware, moi);
router.put('/profil', authMiddleware, mettreAJourProfil);
router.post('/fcm-token', authMiddleware, [
  body('token').notEmpty().withMessage('Token FCM obligatoire'),
  body('plateforme').isIn(['ios', 'android', 'web']).withMessage('Plateforme invalide'),
], validate, enregistrerFcmToken);

module.exports = router;
