require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const http      = require('http');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { demarrerJobs }           = require('./services/jobWorker');
const { demarrerSocket }         = require('./services/socketService');

const authRoutes     = require('./routes/auth');
const donsRoutes     = require('./routes/dons');
const encheresRoutes = require('./routes/encheres');
const mediasRoutes   = require('./routes/medias');

const app    = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Trop de requêtes.' },
});
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '🚀 Kollecta API opérationnelle', version: '1.0.0' });
});

app.use('/api/auth',     authRoutes);
app.use('/api/dons',     donsRoutes);
app.use('/api/encheres', encheresRoutes);
app.use('/api/medias',   mediasRoutes);
app.use('/api/notifications', require('./routes/notifications'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     🚀 KOLLECTA API — DÉMARRAGE        ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Port   : ${PORT}                           ║`);
  console.log(`║  Health : http://localhost:${PORT}/api/health ║`);
  console.log('╚════════════════════════════════════════╝\n');

  if (process.env.NODE_ENV !== 'test') {
    demarrerJobs();
    demarrerSocket(server);
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = { app, server };
