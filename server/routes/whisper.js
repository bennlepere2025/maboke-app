// ═══════════════════════════════════════════════════════════════
// Routes Whisper — /api/whisper
// Transcription vocale via OpenAI Whisper
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const whisperService = require('../services/whisper');

// Configurer multer pour les fichiers audio temporaires
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const audioTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/m4a'];
    if (audioTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Format audio non supporté'), false);
    }
  },
});

// ── POST /api/whisper/transcribe ───────────────────────────────
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier audio reçu.' });
    }

    console.log(`[Whisper] Fichier reçu: ${req.file.filename} (${req.file.size} bytes)`);

    // Transcrire l'audio
    const result = await whisperService.transcribe(req.file.path);

    // Parser le texte pour extraire nom, prix, stock
    const parsed = whisperService.parseMenuText(result.text);

    // Nettoyer le fichier temporaire
    try { fs.unlinkSync(req.file.path); } catch(e) {}

    res.json({
      text: result.text,
      parsed,
      simulated: result.simulated,
      message: result.simulated
        ? '🎤 Transcription simulée (configurez OPENAI_API_KEY pour la vraie transcription)'
        : '🎤 Transcription réussie !',
    });
  } catch (err) {
    // Nettoyer le fichier en cas d'erreur
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    console.error('[Whisper] Transcribe exception:', err);
    res.status(500).json({ error: err.message || 'Erreur de transcription.' });
  }
});

// ── POST /api/whisper/parse ── (parser du texte sans audio) ────
router.post('/parse', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Texte manquant.' });
    }
    const parsed = whisperService.parseMenuText(text);
    res.json({ parsed });
  } catch (err) {
    console.error('[Whisper] Parse exception:', err);
    res.status(500).json({ error: 'Erreur de parsing.' });
  }
});

module.exports = router;
