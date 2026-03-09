// ═══════════════════════════════════════════════════════════════
// Routes commandes — /api/orders
// Créer, lister, mettre à jour les commandes
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const smsService = require('../services/twilio');

const COMMISSION_CLIENT_RATE = parseFloat(process.env.COMMISSION_CLIENT_RATE || '0.01');
const VENDOR_FEE_PER_SALE = parseInt(process.env.VENDOR_FEE_PER_SALE || '25', 10);

// ── POST /api/orders ── (créer une commande) ──────────────────
router.post('/', async (req, res) => {
  try {
    const { client_name, client_phone, items, operateur, numero_momo, quartier, adresse_detail } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Aucun article dans la commande.' });
    }

    if (!numero_momo) {
      return res.status(400).json({ error: 'Numéro Mobile Money requis.' });
    }

    // Calculer le total
    const sousTotal = items.reduce((sum, item) => sum + (item.prix * item.qty), 0);
    const commissionClient = Math.round(sousTotal * COMMISSION_CLIENT_RATE);
    const fraisVendeuse = VENDOR_FEE_PER_SALE; // 25 FCFA par vente
    const totalClient = sousTotal + commissionClient; // ce que le client paie
    const netVendeuse = sousTotal - fraisVendeuse; // ce que la vendeuse reçoit

    const reference = 'MBK-' + Date.now().toString(36).toUpperCase();

    const orderData = {
      reference,
      client_name: client_name || 'Client',
      client_phone: client_phone || '',
      items: JSON.stringify(items),
      sous_total: sousTotal,
      commission,
      total,
      operateur: operateur || 'mtn',
      numero_momo,
      quartier: quartier || '',
      adresse_detail: adresse_detail || '',
      statut: 'confirmee',
      created_at: new Date().toISOString(),
    };

    // Essayer d'insérer dans Supabase
    const { data, error } = await supabase
      .from('commandes')
      .insert([orderData])
      .select();

    if (error) {
      console.warn('[Orders] Supabase insert error (using local):', error.message);
    }

    // Mettre à jour le stock pour chaque plat commandé
    for (const item of items) {
      if (item.id && !String(item.id).startsWith('demo-')) {
        for (let i = 0; i < item.qty; i++) {
          await supabase
            .from('dishes')
            .update({
              current_stock: supabase.rpc ? undefined : Math.max(0, (item.current_stock || 1) - 1),
            })
            .eq('id', item.id);

          // Utiliser une requête RPC si disponible, sinon décrémenter
          try {
            await supabase.rpc('decrement_stock', { dish_id: item.id });
          } catch (e) {
            // Fallback: lecture + update manuelle
            const { data: dishData } = await supabase
              .from('dishes')
              .select('current_stock, status')
              .eq('id', item.id)
              .limit(1);

            if (dishData && dishData[0]) {
              const newStock = Math.max(0, (dishData[0].current_stock || 0) - 1);
              const newStatus = newStock <= 0 ? 'rupture' : newStock <= 2 ? 'bientot_en_rupture' : 'disponible';
              await supabase
                .from('dishes')
                .update({ current_stock: newStock, status: newStatus })
                .eq('id', item.id);
            }
          }
        }
      }
    }

    // Envoyer SMS de confirmation (non bloquant)
    if (client_phone) {
      smsService.notifyOrderConfirmed(client_phone, reference, items[0]?.vendeur || 'Maboke')
        .catch(e => console.warn('[SMS] Notification error:', e.message));
    }

    res.json({
      order: data?.[0] || orderData,
      reference,
      sous_total: sousTotal,
      commission_client: commissionClient,
      frais_vendeuse: fraisVendeuse,
      total: totalClient,
      net_vendeuse: netVendeuse,
      commission_client_rate: COMMISSION_CLIENT_RATE,
      vendor_fee: VENDOR_FEE_PER_SALE,
      message: 'Commande confirmée !',
    });
  } catch (err) {
    console.error('[Orders] Create exception:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande.' });
  }
});

// ── GET /api/orders/vendor/:vendorId ───────────────────────────
router.get('/vendor/:vendorId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('commandes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Orders] Vendor orders error:', error);
      return res.status(500).json({ error: 'Impossible de charger les commandes.' });
    }

    res.json({ orders: data || [] });
  } catch (err) {
    console.error('[Orders] Vendor orders exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ── GET /api/orders/client/:phone ──────────────────────────────
router.get('/client/:phone', async (req, res) => {
  try {
    const phone = req.params.phone.replace(/\s/g, '');
    const { data, error } = await supabase
      .from('commandes')
      .select('*')
      .eq('client_phone', phone)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Orders] Client orders error:', error);
      return res.status(500).json({ error: 'Impossible de charger les commandes.' });
    }

    res.json({ orders: data || [] });
  } catch (err) {
    console.error('[Orders] Client orders exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ── PATCH /api/orders/:id/status ───────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { statut } = req.body;
    const validStatuts = ['confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee'];

    if (!validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const { data, error } = await supabase
      .from('commandes')
      .update({ statut })
      .eq('id', req.params.id)
      .select();

    if (error) {
      console.error('[Orders] Status update error:', error);
      return res.status(500).json({ error: 'Impossible de mettre à jour le statut.' });
    }

    // Si livré, notifier le client
    if (statut === 'livree' && data?.[0]?.client_phone) {
      smsService.notifyOrderReady(data[0].client_phone, data[0].reference)
        .catch(e => console.warn('[SMS] Notification error:', e.message));
    }

    res.json({ order: data?.[0], message: 'Statut mis à jour.' });
  } catch (err) {
    console.error('[Orders] Status update exception:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
