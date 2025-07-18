const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Panier = require("../models/Panier");
const Produit = require("../models/Produit");
const authenticate = require("../middlewares/auth");
const Commande = require("../models/Commande");
const CommandeItem = require("../models/CommandeItem");

router.post("/stripe-checkout", authenticate, async (req, res) => {
  try {
    const { method } = req.body; // Extract payment method from request body

    const cartItems = await Panier.findAll({
      where: { client_id: req.user.id },
      include: [{ model: Produit, as: "Produit" }],
    });

    if (!cartItems.length)
      return res.status(400).json({ message: "Panier vide" });

    // Handle cash on delivery
    if (method === "a_la_livraison") {
      // Group by vendeur_id
      const grouped = {};
      cartItems.forEach((item) => {
        const vendeurId = item.Produit.vendeur_id;
        if (!grouped[vendeurId]) grouped[vendeurId] = [];
        grouped[vendeurId].push(item);
      });

      const commandes = [];

      for (const vendeur_id of Object.keys(grouped)) {
        const items = grouped[vendeur_id];
        const total = items.reduce(
          (sum, item) => sum + item.Produit.prix * item.quantite,
          0
        );

        const commande = await Commande.create({
          client_id: req.user.id,
          vendeur_id,
          total,
          statut: "en attente",
          mode_paiement: "a_la_livraison",
          adresse_livraison: "A définir", // You might want to get this from user input
        });

        for (const item of items) {
          await CommandeItem.create({
            commande_id: commande.id,
            product_id: item.produit_id, // Use product_id as defined in the model
            quantite: item.quantite,
            prix_unitaire: item.Produit.prix,
          });
        }

        commandes.push(commande);
      }

      // Clear cart
      await Panier.destroy({ where: { client_id: req.user.id } });

      return res.status(201).json({
        message: "Commande créée avec succès",
        commandes,
        success: true,
      });
    }

    // Handle online payment with Stripe
    const line_items = cartItems.map((item) => ({
      price_data: {
        currency: "usd", // Consider making this configurable
        product_data: {
          name: item.Produit.nom,
          description: item.Produit.description || "",
        },
        unit_amount: Math.round(item.Produit.prix * 100), // Convert to cents
      },
      quantity: item.quantite,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `http://localhost:5173/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/checkout-cancel`,
      metadata: {
        client_id: req.user.id.toString(),
        context: "marketplace",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur session Stripe marketplace:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

router.post("/verify-payment", authenticate, async (req, res) => {
  const { session_id } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Paiement non complété" });
    }

    const client_id = session.metadata?.client_id;

    // Check if this session has already been processed
    const existingCommandes = await Commande.findAll({
      where: {
        client_id,
        mode_paiement: "en_ligne",
        createdAt: {
          [require("sequelize").Op.gte]: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    if (existingCommandes.length > 0) {
      return res.status(200).json({
        message: "Commandes déjà créées",
        commandes: existingCommandes,
        success: true,
      });
    }

    // Fetch the cart
    const cartItems = await Panier.findAll({
      where: { client_id },
      include: [{ model: Produit, as: "Produit" }],
    });

    if (!cartItems.length) {
      // Cart is empty, but payment was successful - check if orders were already created
      const recentCommandes = await Commande.findAll({
        where: {
          client_id,
          mode_paiement: "en_ligne",
          createdAt: {
            [require("sequelize").Op.gte]: new Date(
              Date.now() - 10 * 60 * 1000
            ), // Last 10 minutes
          },
        },
      });

      if (recentCommandes.length > 0) {
        return res.status(200).json({
          message: "Commandes déjà créées",
          commandes: recentCommandes,
          success: true,
        });
      }

      return res
        .status(400)
        .json({ message: "Panier vide et aucune commande récente trouvée" });
    }

    // Group by vendeur_id
    const grouped = {};
    cartItems.forEach((item) => {
      const vendeurId = item.Produit.vendeur_id;
      if (!grouped[vendeurId]) grouped[vendeurId] = [];
      grouped[vendeurId].push(item);
    });

    const commandes = [];

    for (const vendeur_id of Object.keys(grouped)) {
      const items = grouped[vendeur_id];
      const total = items.reduce(
        (sum, item) => sum + item.Produit.prix * item.quantite,
        0
      );

      const commande = await Commande.create({
        client_id,
        vendeur_id,
        total,
        statut: "en attente",
        mode_paiement: "en_ligne",
        adresse_livraison: "en ligne",
      });

      for (const item of items) {
        await CommandeItem.create({
          commande_id: commande.id,
          product_id: item.produit_id,
          quantite: item.quantite,
          prix_unitaire: item.Produit.prix,
        });
      }

      commandes.push(commande);
    }

    // Clear cart
    await Panier.destroy({ where: { client_id } });

    res.status(201).json({
      message: "Commandes créées après paiement",
      commandes,
      success: true,
    });
  } catch (err) {
    console.error("Erreur vérification paiement:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
