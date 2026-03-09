// ═══════════════════════════════════════════════════════════════
// Maboke Backend Server
// Sert le frontend + les API (auth, vendors, whisper, orders, payments, sms)
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Servir le frontend (fichiers statiques) ────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/vendors',  require('./routes/vendors'));
app.use('/api/whisper',  require('./routes/whisper'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/sms',      require('./routes/sms'));

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const momoService = require('./services/momo');
  const smsService  = require('./services/twilio');
  const whisperSvc  = require('./services/whisper');

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase:  '✅ Configuré',
      whisper:   whisperSvc.isSimulation() ? '⚠️ Simulation' : '✅ Configuré',
      mtn_momo:  momoService.isSimulation() ? '⚠️ Simulation' : '✅ Configuré',
      twilio:    smsService.isSimulation()  ? '⚠️ Simulation' : '✅ Configuré',
    },
    commission_rate: process.env.COMMISSION_RATE || '0.05',
  });
});

// ── Fallback : servir index.html ───────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  } else {
    res.status(404).json({ error: 'Route API non trouvée.' });
  }
});

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║          🍲  MABOKE SERVER  🍲                  ║
  ║──────────────────────────────────────────────────║
  ║  URL:    http://localhost:${PORT}                  ║
  ║  API:    http://localhost:${PORT}/api/health        ║
  ║──────────────────────────────────────────────────║
  ║  Frontend pages:                                 ║
  ║  • /index.html      → Connexion / Inscription   ║
  ║  • /vendeuse.html    → Espace vendeuse           ║
  ║  • /dashboard.html   → Dashboard vendeuse        ║
  ║  • /commandes.html   → Commander (client)        ║
  ╚══════════════════════════════════════════════════╝
  `);
});
