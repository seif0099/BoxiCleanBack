const express = require("express");
const router = express.Router();
const Abonnement = require("../models/Abonnement");
const authenticate = require("../middlewares/auth");
const Paiement = require("../models/Paiement");

// 🔽 Créer un abonnement
router.post("/", authenticate, async (req, res) => {
  const { type_abonnement, date_fin, montant } = req.body;

  try {
    const abonnement = await Abonnement.create({
      utilisateur_id: req.user.id,
      type_abonnement,
      date_fin,
      montant,
      statut: "en_attente", // Default status
    });

    res.status(201).json(abonnement);
  } catch (err) {
    console.error("Error creating abonnement:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 🔍 Voir l'abonnement actif d'un utilisateur
router.get("/me", authenticate, async (req, res) => {
  try {
    const abonnement = await Abonnement.findOne({
      where: { utilisateur_id: req.user.id, statut: "actif" },
      order: [["createdAt", "DESC"]], // Get the latest active subscription
    });

    // Return null if no active subscription found
    res.json(abonnement);
  } catch (err) {
    console.error("Error fetching abonnement:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 🔍 Get all subscriptions for a user (for admin purposes)
router.get("/all", authenticate, async (req, res) => {
  try {
    const abonnements = await Abonnement.findAll({
      where: { utilisateur_id: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    res.json(abonnements);
  } catch (err) {
    console.error("Error fetching all abonnements:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✏️ Mettre à jour l'abonnement (ex. changement de statut)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const abonnement = await Abonnement.findByPk(req.params.id);

    if (!abonnement) {
      return res.status(404).json({ message: "Abonnement non trouvé" });
    }

    if (abonnement.utilisateur_id !== req.user.id) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    await abonnement.update(req.body);
    res.json(abonnement);
  } catch (err) {
    console.error("Error updating abonnement:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ Activer l'abonnement après le paiement
router.post("/activate-latest", authenticate, async (req, res) => {
  try {
    // First, deactivate any existing active subscriptions
    await Abonnement.update(
      { statut: "inactif" },
      {
        where: {
          utilisateur_id: req.user.id,
          statut: "actif",
        },
      }
    );

    // Get the latest pending subscription for this user
    const abonnement = await Abonnement.findOne({
      where: {
        utilisateur_id: req.user.id,
        statut: "en_attente",
      },
      order: [["createdAt", "DESC"]],
    });

    if (!abonnement) {
      return res.status(404).json({ message: "Aucun abonnement à activer" });
    }

    // Update status to active
    abonnement.statut = "actif";
    await abonnement.save();

    res.json({ message: "Abonnement activé avec succès", abonnement });
  } catch (err) {
    console.error("Erreur activation abonnement:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ❌ Cancel subscription
router.post("/cancel", authenticate, async (req, res) => {
  try {
    const abonnement = await Abonnement.findOne({
      where: {
        utilisateur_id: req.user.id,
        statut: "actif",
      },
    });

    if (!abonnement) {
      return res.status(404).json({ message: "Aucun abonnement actif trouvé" });
    }

    abonnement.statut = "annulé";
    await abonnement.save();

    res.json({ message: "Abonnement annulé avec succès", abonnement });
  } catch (err) {
    console.error("Error cancelling abonnement:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
