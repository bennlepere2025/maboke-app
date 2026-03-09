// ═══════════════════════════════════════════════════════════════
// Routes SMS — /api/sms
// Envoi de notifications via Twilio
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const smsService = require('../services/twilio');

// ── POST /api/sms/send ────────────────────────────────────────
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Numéro et message requis.' });
    }

    const result = await smsService.sendSMS(to, message);

    res.json({
      ...result,
      simulated: smsService.isSimulation(),
      message: smsService.isSimulation()
        ? '📱 SMS simulé (configurez les clés Twilio)'
        : '📱 SMS envoyé avec succès !',
    });
  } catch (err) {
    console.error('[SMS] Send exception:', err);
    res.status(500).json({ error: err.message || 'Erreur d\'envoi SMS.' });
  }
});

// ── POST /api/sms/notify-order ─────────────────────────────────
router.post('/notify-order', async (req, res) => {
  try {
    const { client_phone, vendeur_phone, reference, client_name, vendeur_name, total } = req.body;

    const results = {};

    if (client_phone) {
      results.client = await smsService.notifyOrderConfirmed(client_phone, reference, vendeur_name || 'Maboke');
    }

    if (vendeur_phone) {
      results.vendeur = await smsService.notifyVendorNewOrder(vendeur_phone, reference, client_name || 'Client', total || 0);
    }

    res.json({
      results,
      simulated: smsService.isSimulation(),
      message: 'Notifications envoyées.',
    });
  } catch (err) {
    console.error('[SMS] NotifyOrder exception:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
