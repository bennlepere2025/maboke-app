// ═══════════════════════════════════════════════════════════════
// Routes vendeuses — /api/vendors
// Profil, plats, gestion du stock
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// ── POST /api/vendors/profile ──────────────────────────────────
router.post('/profile', async (req, res) => {
  try {
    const { name, location } = req.body;

    if (!name || !location) {
      return res.status(400).json({ error: 'Nom et localisation obligatoires.' });
    }

    const { data, error } = await supabase
      .from('vendors')
      .upsert({ name, location }, { onConflict: 'name,location' })
      .select()
      .limit(1);

    if (error) {
      console.error('[Vendors] Profile error:', error);
      return res.status(500).json({ error: 'Impossible d\'enregistrer le profil.' });
    }

    res.json({ vendor: data[0] });
  } catch (err) {
    console.error('[Vendors] Profile exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ── GET /api/vendors/:id/dishes ────────────────────────────────
router.get('/:id/dishes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('vendor_id', req.params.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Vendors] Dishes list error:', error);
      return res.status(500).json({ error: 'Impossible de charger les plats.' });
    }

    res.json({ dishes: data || [] });
  } catch (err) {
    console.error('[Vendors] Dishes list exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ── POST /api/vendors/dishes ── (ajouter un plat) ─────────────
router.post('/dishes', async (req, res) => {
  try {
    const { vendor_id, name, description, price, initial_stock, image_url } = req.body;

    if (!vendor_id || !name || !price || price <= 0) {
      return res.status(400).json({ error: 'vendor_id, nom et prix sont obligatoires.' });
    }

    const stock = initial_stock >= 0 ? initial_stock : 0;
    const status = stock <= 0 ? 'rupture' : 'disponible';

    const { data, error } = await supabase
      .from('dishes')
      .upsert(
        {
          vendor_id,
          name,
          description: description || null,
          price,
          initial_stock: stock,
          current_stock: stock,
          status,
          image_url: image_url || null,
        },
        { onConflict: 'vendor_id,name' }
      )
      .select();

    if (error) {
      console.error('[Vendors] Dish insert error:', error);
      return res.status(500).json({ error: 'Impossible d\'enregistrer le plat.' });
    }

    res.json({ dish: data[0], message: 'Plat enregistré avec succès !' });
  } catch (err) {
    console.error('[Vendors] Dish insert exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ── PATCH /api/vendors/dishes/:id/stock ────────────────────────
router.patch('/dishes/:id/stock', async (req, res) => {
  try {
    const { action } = req.body; // 'sell', 'add', 'out'
    const dishId = req.params.id;

    // Récupérer le plat actuel
    const { data: existing, error: fetchErr } = await supabase
      .from('dishes')
      .select('*')
      .eq('id', dishId)
      .limit(1);

    if (fetchErr || !existing || !existing.length) {
      return res.status(404).json({ error: 'Plat non trouvé.' });
    }

    const dish = existing[0];
    let newStock = dish.current_stock ?? 0;
    let newStatus = dish.status || 'disponible';

    if (action === 'sell') {
      newStock = Math.max(0, newStock - 1);
    } else if (action === 'add') {
      newStock += 1;
    } else if (action === 'out') {
      newStock = 0;
      newStatus = 'rupture';
    }

    // Calcul automatique du statut
    if (newStock <= 0) {
      newStatus = 'rupture';
    } else if (newStock <= 2) {
      newStatus = 'bientot_en_rupture';
    } else {
      newStatus = 'disponible';
    }

    const { error: updateErr } = await supabase
      .from('dishes')
      .update({ current_stock: newStock, status: newStatus })
      .eq('id', dishId);

    if (updateErr) {
      console.error('[Vendors] Stock update error:', updateErr);
      return res.status(500).json({ error: 'Impossible de mettre à jour le stock.' });
    }

    res.json({
      dish_id: dishId,
      current_stock: newStock,
      status: newStatus,
      message: 'Stock mis à jour.',
    });
  } catch (err) {
    console.error('[Vendors] Stock update exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ── GET /api/vendors/catalogue ── (tous les plats disponibles) ─
router.get('/catalogue', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dishes')
      .select('*, vendors(name, location)')
      .gt('current_stock', 0)
      .neq('status', 'rupture')
      .order('name', { ascending: true });

    if (error) {
      console.error('[Vendors] Catalogue error:', error);
      return res.status(500).json({ error: 'Impossible de charger le catalogue.' });
    }

    res.json({ dishes: data || [] });
  } catch (err) {
    console.error('[Vendors] Catalogue exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
