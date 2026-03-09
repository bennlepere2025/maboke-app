// ═══════════════════════════════════════════════════════════════
// MTN MoMo Service
// API de collection (requestToPay) et de transfert (payout)
// Mode simulation si les clés ne sont pas configurées
// ═══════════════════════════════════════════════════════════════
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class MoMoService {
  constructor() {
    this.baseUrl      = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
    this.subKey       = process.env.MOMO_SUBSCRIPTION_KEY;
    this.apiUser      = process.env.MOMO_API_USER;
    this.apiKey        = process.env.MOMO_API_KEY;
    this.currency     = process.env.MOMO_CURRENCY || 'XAF';
    this.targetEnv    = process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox';
    this.simulationMode = !this.subKey || !this.apiUser || !this.apiKey;
    this.token        = null;
    this.tokenExpiry  = 0;
  }

  isSimulation() {
    return this.simulationMode;
  }

  // ── OAuth2 Token ─────────────────────────────────────────
  async getToken() {
    if (this.simulationMode) return 'simulated-token';

    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
      const res = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Ocp-Apim-Subscription-Key': this.subKey,
          }
        }
      );
      this.token = res.data.access_token;
      this.tokenExpiry = Date.now() + (res.data.expires_in * 1000) - 60000;
      return this.token;
    } catch (err) {
      console.error('[MoMo] Token error:', err.response?.data || err.message);
      throw new Error('Impossible d\'obtenir le token MoMo');
    }
  }

  // ── Request to Pay (collecte depuis le client) ──────────
  async requestToPay({ amount, phone, externalId, payerMessage, payeeNote }) {
    const referenceId = uuidv4();

    if (this.simulationMode) {
      console.log(`[MoMo SIMULATION] requestToPay: ${amount} ${this.currency} from ${phone} (ref: ${referenceId})`);
      return {
        referenceId,
        status: 'PENDING',
        simulated: true,
      };
    }

    try {
      const token = await this.getToken();
      await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        {
          amount: String(amount),
          currency: this.currency,
          externalId: externalId || referenceId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: phone.replace(/\s/g, '').replace('+', ''),
          },
          payerMessage: payerMessage || 'Paiement Maboke',
          payeeNote: payeeNote || 'Commande Maboke',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': this.targetEnv,
            'Ocp-Apim-Subscription-Key': this.subKey,
            'Content-Type': 'application/json',
          }
        }
      );

      return { referenceId, status: 'PENDING', simulated: false };
    } catch (err) {
      console.error('[MoMo] requestToPay error:', err.response?.data || err.message);
      throw new Error('Erreur lors du paiement MoMo');
    }
  }

  // ── Vérifier le statut du paiement ──────────────────────
  async checkPaymentStatus(referenceId) {
    if (this.simulationMode) {
      return {
        referenceId,
        status: 'SUCCESSFUL',
        simulated: true,
        financialTransactionId: 'SIM-' + Date.now(),
      };
    }

    try {
      const token = await this.getToken();
      const res = await axios.get(
        `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Target-Environment': this.targetEnv,
            'Ocp-Apim-Subscription-Key': this.subKey,
          }
        }
      );
      return res.data;
    } catch (err) {
      console.error('[MoMo] checkStatus error:', err.response?.data || err.message);
      throw new Error('Impossible de vérifier le statut du paiement');
    }
  }

  // ── Transfer / Payout (vers la vendeuse) ────────────────
  async transfer({ amount, phone, externalId, payerMessage, payeeNote }) {
    const referenceId = uuidv4();

    if (this.simulationMode) {
      console.log(`[MoMo SIMULATION] transfer: ${amount} ${this.currency} to ${phone} (ref: ${referenceId})`);
      return {
        referenceId,
        status: 'PENDING',
        simulated: true,
      };
    }

    try {
      const token = await this.getToken();
      await axios.post(
        `${this.baseUrl}/disbursement/v1_0/transfer`,
        {
          amount: String(amount),
          currency: this.currency,
          externalId: externalId || referenceId,
          payee: {
            partyIdType: 'MSISDN',
            partyId: phone.replace(/\s/g, '').replace('+', ''),
          },
          payerMessage: payerMessage || 'Virement Maboke',
          payeeNote: payeeNote || 'Gain vendeuse Maboke',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': this.targetEnv,
            'Ocp-Apim-Subscription-Key': this.subKey,
            'Content-Type': 'application/json',
          }
        }
      );

      return { referenceId, status: 'PENDING', simulated: false };
    } catch (err) {
      console.error('[MoMo] transfer error:', err.response?.data || err.message);
      throw new Error('Erreur lors du virement MoMo');
    }
  }
}

module.exports = new MoMoService();
