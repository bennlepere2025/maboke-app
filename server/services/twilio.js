// ═══════════════════════════════════════════════════════════════
// Twilio SMS Service
// Mode simulation si les clés ne sont pas configurées
// ═══════════════════════════════════════════════════════════════

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken  = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.simulationMode = !this.accountSid || !this.authToken || !this.fromNumber;
    this.client = null;

    if (!this.simulationMode) {
      try {
        const twilio = require('twilio');
        this.client = twilio(this.accountSid, this.authToken);
      } catch (e) {
        console.warn('[Twilio] Module not loaded, running in simulation mode');
        this.simulationMode = true;
      }
    }
  }

  isSimulation() {
    return this.simulationMode;
  }

  // ── Envoyer un SMS ───────────────────────────────────────
  async sendSMS(to, message) {
    // Normalize phone number for Congo (+242)
    let phone = to.replace(/\s/g, '');
    if (!phone.startsWith('+')) {
      phone = '+242' + phone;
    }

    if (this.simulationMode) {
      console.log(`[SMS SIMULATION] → ${phone}: ${message}`);
      return { sid: 'SIM-' + Date.now(), status: 'simulated', to: phone };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phone,
      });
      console.log(`[SMS] Envoyé à ${phone}: ${result.sid}`);
      return { sid: result.sid, status: result.status, to: phone };
    } catch (err) {
      console.error('[Twilio] SMS error:', err.message);
      throw new Error('Impossible d\'envoyer le SMS');
    }
  }

  // ── Templates de messages ────────────────────────────────

  async notifyOrderConfirmed(clientPhone, reference, vendeurName) {
    const msg = `🍲 Maboke — Commande confirmée !\nRéf: ${reference}\nVotre commande chez ${vendeurName} est en préparation.\nMerci de votre confiance !`;
    return this.sendSMS(clientPhone, msg);
  }

  async notifyVendorNewOrder(vendeurPhone, reference, clientName, total) {
    const msg = `🔔 Maboke — Nouvelle commande !\nRéf: ${reference}\nClient: ${clientName}\nMontant: ${total.toLocaleString('fr-FR')} FCFA\nConnectez-vous pour voir les détails.`;
    return this.sendSMS(vendeurPhone, msg);
  }

  async notifyPaymentReceived(vendeurPhone, amount) {
    const msg = `💸 Maboke — Paiement reçu !\nVous avez reçu ${amount.toLocaleString('fr-FR')} FCFA sur votre compte Mobile Money.\nMerci de cuisiner avec Maboke !`;
    return this.sendSMS(vendeurPhone, msg);
  }

  async notifyOrderReady(clientPhone, reference) {
    const msg = `✅ Maboke — Plat prêt !\nRéf: ${reference}\nVotre commande est prête et en route pour la livraison.\nBon appétit !`;
    return this.sendSMS(clientPhone, msg);
  }
}

module.exports = new TwilioService();
