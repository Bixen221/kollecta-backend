const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const {
  listerEncheres,
  obtenirEnchere,
  creerEnchere,
  modifierEnchere,
  annulerEnchere,
  placerOffre,
  mesEncheres,
} = require('../controllers/encheresController');

const { authMiddleware } = require('../middleware/auth');
const { validate }       = require('../middleware/errorHandler');

// Routes publiques
router.get('/',             listerEncheres);
router.get('/mes-encheres', authMiddleware, mesEncheres);
router.get('/:id',          obtenirEnchere);

// Routes protégées
router.post('/', authMiddleware, [
  body('titre').trim().notEmpty().withMessage('Le titre est obligatoire'),
  body('prix_depart').isInt({ min: 1 }).withMessage('Le prix de départ doit être supérieur à 0'),
  body('debut_le').isISO8601().withMessage('Date de début invalide'),
  body('fin_le').isISO8601().withMessage('Date de fin invalide'),
], validate, creerEnchere);

router.put('/:id',          authMiddleware, modifierEnchere);
router.delete('/:id',       authMiddleware, annulerEnchere);
router.post('/:id/offrir',  authMiddleware, [
  body('montant').isInt({ min: 1 }).withMessage('Le montant doit être supérieur à 0'),
], validate, placerOffre);

module.exports = router;
