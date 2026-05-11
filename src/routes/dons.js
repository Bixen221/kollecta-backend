const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  listerDons,
  obtenirDon,
  creerDon,
  modifierDon,
  supprimerDon,
  reserverDon,
  confirmerDon,
  mesDons,
  mesReservations,
} = require('../controllers/donsController');

const { authMiddleware } = require('../middleware/auth');
const { validate }       = require('../middleware/errorHandler');

// Routes publiques
router.get('/',    listerDons);
router.get('/mes-dons', authMiddleware, mesDons);
router.get('/reservations/mes-reservations', authMiddleware, mesReservations);
router.get('/:id', obtenirDon);

// Routes protégées
router.post('/', authMiddleware, [
  body('titre').trim().notEmpty().withMessage('Le titre est obligatoire'),
  body('type').isIn(['nourriture', 'materiel']).withMessage('Type invalide'),
], validate, creerDon);

router.put('/:id',    authMiddleware, modifierDon);
router.delete('/:id', authMiddleware, supprimerDon);
router.post('/:id/reserver', authMiddleware, reserverDon);
router.post('/reservations/:id/confirmer', authMiddleware, confirmerDon);

module.exports = router;
