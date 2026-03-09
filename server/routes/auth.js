// ═══════════════════════════════════════════════════════════════
// Routes d'authentification — /api/auth
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// ── POST /api/auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { role, name, phone, password, location, momo, address, quartier, photo_url } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ error: 'Nom, téléphone, mot de passe et rôle sont obligatoires.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    // Vérifier si l'utilisateur existe déjà
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone.replace(/\s/g, ''))
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Ce numéro est déjà enregistré.' });
    }

    // Insérer l'utilisateur
    const userData = {
      role,
      name,
      phone: phone.replace(/\s/g, ''),
      password, // En production : hacher avec bcrypt
      location: location || null,
      momo: momo || 'mtn',
      address: address || null,
      quartier: quartier || null,
      photo_url: photo_url || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .limit(1);

    if (error) {
      console.error('[Auth] Register error:', error);
      // Fallback: save in localStorage-compatible format
      return res.json({
        user: userData,
        source: 'local',
        message: 'Compte créé (mode local)',
      });
    }

    res.json({
      user: data[0],
      source: 'supabase',
      message: 'Compte créé avec succès !',
    });
  } catch (err) {
    console.error('[Auth] Register exception:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password, role } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Téléphone et mot de passe sont obligatoires.' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone.replace(/\s/g, ''))
      .eq('password', password)
      .limit(1);

    if (error || !data || data.length === 0) {
      return res.status(401).json({ error: 'Numéro, mot de passe ou rôle incorrect.' });
    }

    const user = data[0];
    if (role && user.role !== role) {
      return res.status(401).json({ error: 'Rôle incorrect pour ce compte.' });
    }

    res.json({
      user,
      message: 'Connexion réussie !',
    });
  } catch (err) {
    console.error('[Auth] Login exception:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
