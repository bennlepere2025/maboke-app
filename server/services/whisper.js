// ═══════════════════════════════════════════════════════════════
// OpenAI Whisper Service
// Transcription audio → texte
// Mode simulation si la clé OpenAI n'est pas configurée
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

class WhisperService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.simulationMode = !this.apiKey;
    this.client = null;

    if (!this.simulationMode) {
      try {
        const OpenAI = require('openai');
        this.client = new OpenAI({ apiKey: this.apiKey });
      } catch (e) {
        console.warn('[Whisper] OpenAI module not loaded, running in simulation mode');
        this.simulationMode = true;
      }
    }
  }

  isSimulation() {
    return this.simulationMode;
  }

  // ── Transcrire un fichier audio ──────────────────────────
  async transcribe(audioFilePath) {
    if (this.simulationMode) {
      console.log(`[Whisper SIMULATION] Transcribing: ${audioFilePath}`);
      // Retourner un texte simulé réaliste
      const demoTexts = [
        'Maboke de poisson fumé, 3500 francs, j\'ai préparé 10 portions aujourd\'hui',
        'Saka-saka au poulet, 2500 francs CFA, il y a 8 portions disponibles',
        'Poulet braisé avec plantain frit, 4000 francs, 5 portions',
        'Riz au gras avec poisson grillé, 3000 francs, 12 portions prêtes',
        'Beignets de banane, 1000 francs, 20 pièces disponibles',
      ];
      const randomText = demoTexts[Math.floor(Math.random() * demoTexts.length)];
      return {
        text: randomText,
        simulated: true,
      };
    }

    try {
      const audioStream = fs.createReadStream(audioFilePath);
      const response = await this.client.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioStream,
        language: 'fr',
        response_format: 'json',
      });

      return {
        text: response.text,
        simulated: false,
      };
    } catch (err) {
      console.error('[Whisper] Transcription error:', err.message);
      throw new Error('Impossible de transcrire l\'audio');
    }
  }

  // ── Extraire nom du plat, prix et stock depuis le texte ──
  parseMenuText(text) {
    // Essayer d'extraire les informations du texte transcrit
    let name = '';
    let price = 0;
    let stock = 0;
    let description = '';

    // Extraire le prix (chercher patterns comme "3500 francs", "3 500 FCFA", etc.)
    const priceMatch = text.match(/(\d[\d\s]*\d?)\s*(francs?|fcfa|cfa|f)/i);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
    }

    // Extraire le stock (chercher "10 portions", "5 plats", etc.)
    const stockMatch = text.match(/(\d+)\s*(portions?|plats?|pièces?|assiettes?|prêtes?|disponibles?)/i);
    if (stockMatch) {
      stock = parseInt(stockMatch[1], 10);
    }

    // Le nom du plat est généralement au début du texte, avant le prix
    if (priceMatch) {
      name = text.substring(0, text.indexOf(priceMatch[0])).trim();
      // Nettoyer la virgule finale
      name = name.replace(/,\s*$/, '').trim();
    } else {
      // Prendre la première phrase comme nom
      const firstSentence = text.split(/[.,!?]/)[0];
      name = firstSentence.trim();
    }

    // La description peut être ce qui reste après le nom et avant le prix
    // ou le texte complet si on ne peut pas bien parser
    description = text;

    return {
      name: name || text.substring(0, 50),
      price: price || 0,
      stock: stock || 0,
      description: description,
      raw: text,
    };
  }
}

module.exports = new WhisperService();
