// ═══════════════════════════════════════════════════════════════
// Routes paiements — /api/payments
// MTN MoMo : collecte, vérification, virement
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const momoService = require('../services/momo');
const smsService = require('../services/twilio');

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.05');

// ── POST /api/payments/collect ── (payer une commande) ────────
router.post('/collect', async (req, res) => {
  try {
    const { amount, phone, reference, payerMessage } = req.body;

    if (!amount || !phone) {
      return res.status(400).json({ error: 'Montant et numéro de téléphone requis.' });
    }

    const result = await momoService.requestToPay({
      amount,
      phone,
      externalId: reference || `MBK-${Date.now()}`,
      payerMessage: payerMessage || `Paiement Maboke - ${amount} FCFA`,
      payeeNote: `Commande Maboke ${reference || ''}`,
    });

    res.json({
      ...result,
      amount,
      commission: Math.round(amount * COMMISSION_RATE),
      net: Math.round(amount * (1 - COMMISSION_RATE)),
      message: result.simulated
        ? '💳 Paiement simulé (configurez les clés MTN MoMo pour le vrai paiement)'
        : '💳 Demande de paiement envoyée ! Confirmez sur votre téléphone.',
    });
  } catch (err) {
    console.error('[Payments] Collect exception:', err);
    res.status(500).json({ error: err.message || 'Erreur de paiement.' });
  }
});

// ── GET /api/payments/status/:referenceId ──────────────────────
router.get('/status/:referenceId', async (req, res) => {
  try {
    const result = await momoService.checkPaymentStatus(req.params.referenceId);

    res.json({
      ...result,
      message: result.status === 'SUCCESSFUL'
        ? '✅ Paiement confirmé !'
        : result.status === 'PENDING'
          ? '⏳ Paiement en attente de confirmation'
          : '❌ Paiement échoué',
    });
  } catch (err) {
    console.error('[Payments] Status exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payments/payout ── (virement vers vendeuse) ─────
router.post('/payout', async (req, res) => {
  try {
    const { amount, phone, vendeur_name } = req.body;

    if (!amount || !phone) {
      return res.status(400).json({ error: 'Montant et numéro de téléphone requis.' });
    }

    const result = await momoService.transfer({
      amount,
      phone,
      payerMessage: `Virement Maboke — Gains du jour`,
      payeeNote: `Paiement vendeuse ${vendeur_name || ''}`,
    });

    // Notifier la vendeuse par SMS
    smsService.notifyPaymentReceived(phone, amount)
      .catch(e => console.warn('[SMS] Payout notification error:', e.message));

    res.json({
      ...result,
      amount,
      message: result.simulated
        ? '💸 Virement simulé (configurez les clés MTN MoMo)'
        : '💸 Virement initié ! Vous recevrez les fonds sous 5 à 15 minutes.',
    });
  } catch (err) {
    console.error('[Payments] Payout exception:', err);
    res.status(500).json({ error: err.message || 'Erreur de virement.' });
  }
});

module.exports = router;
