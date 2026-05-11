const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map(e => ({ champ: e.path, message: e.msg })),
    });
  }
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.message);
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Cette valeur existe déjà.' });
  }
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur.',
  });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} introuvable.` });
};

module.exports = { validate, errorHandler, notFound };
