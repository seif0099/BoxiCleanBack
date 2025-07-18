const Panier = require("../models/Panier");
const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/auth");
const Produit = require("../models/Produit");

router.post("/cart", authenticate, async (req, res) => {
  try {
    const { produit_id, quantite } = req.body;
    const existing = await Panier.findOne({
      where: { client_id: req.user.id, produit_id },
    });

    if (existing) {
      existing.quantite += quantite;
      await existing.save();
      return res.json(existing);
    }

    const newItem = await Panier.create({
      client_id: req.user.id,
      produit_id,
      quantite,
    });

    res.status(201).json(newItem);
  } catch (err) {
    console.error("Erreur ajout panier:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
router.get("/cart", authenticate, async (req, res) => {
  try {
    const cart = await Panier.findAll({
      where: { client_id: req.user.id },
      include: [{ model: Produit, as: "Produit" }], // ✅ include alias
    });
    res.json(cart);
  } catch (err) {
    console.error("Erreur chargement panier:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
router.delete("/cart/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Panier.findOne({
      where: { id, client_id: req.user.id },
    });
    if (!item) return res.status(404).json({ message: "Item not found" });

    await item.destroy();
    res.json({ message: "Supprimé du panier" });
  } catch (err) {
    console.error("Erreur suppression panier:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
module.exports = router;
