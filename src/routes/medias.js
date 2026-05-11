const express = require('express');
const router  = express.Router();

const { uploadPhoto, supprimerPhoto, obtenirPhotos } = require('../controllers/mediasController');
const { authMiddleware } = require('../middleware/auth');
const { upload }         = require('../config/cloudinary');

// Upload une photo
router.post('/upload', authMiddleware, upload.single('photo'), uploadPhoto);

// Supprimer une photo
router.delete('/:id', authMiddleware, supprimerPhoto);

// Obtenir les photos d'une annonce
router.get('/:entite_type/:entite_id', obtenirPhotos);

module.exports = router;
