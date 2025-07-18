const Commande = require("../models/Commande");
const CommandeItem = require("../models/CommandeItem");
const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/auth");
router.post("/", authenticate, async (req, res) => {
  try {
    const { mode_paiement } = req.body;

    const cartItems = await Panier.findAll({
      where: { client_id: req.user.id },
      include: [{ model: Product }],
    });

    if (!cartItems.length)
      return res.status(400).json({ message: "Panier vide" });

    // Group by vendeur_id
    const grouped = {};
    cartItems.forEach((item) => {
      const vendeurId = item.Product.vendeur_id;
      if (!grouped[vendeurId]) grouped[vendeurId] = [];
      grouped[vendeurId].push(item);
    });

    const commandes = [];

    for (const vendeur_id of Object.keys(grouped)) {
      const items = grouped[vendeur_id];
      const total = items.reduce(
        (sum, item) => sum + item.Product.prix * item.quantite,
        0
      );

      const commande = await Commande.create({
        client_id: req.user.id,
        vendeur_id,
        total,
        statut: "en attente",
        mode_paiement,
      });

      for (const item of items) {
        await CommandeItem.create({
          commande_id: commande.id,
          produit_id: item.produit_id,
          quantite: item.quantite,
        });
      }

      commandes.push(commande);
    }

    // Vider le panier
    await Panier.destroy({ where: { client_id: req.user.id } });

    res.status(201).json({ message: "Commande créée", commandes });
  } catch (err) {
    console.error("Erreur checkout:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
module.exports = router;
