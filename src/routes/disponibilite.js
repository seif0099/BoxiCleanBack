const express = require("express");
const router = express.Router();
const Disponibilite = require("../models/Disponibilite");
const authenticate = require("../middlewares/auth");
const User = require("../models/User");

// Ajouter une disponibilité (uniquement pour prestataires)
// Ajouter une disponibilité (avec association au service)
router.post("/", authenticate, async (req, res) => {
  const { jour, heure_debut, heure_fin, service_id } = req.body;

  try {
    const user = await User.findByPk(req.user.id);

    if (!user || user.role !== "prestataire") {
      return res.status(403).json({ message: "Non autorisé" });
    }

    if (!service_id) {
      return res.status(400).json({ message: "Le service_id est requis" });
    }

    const dispo = await Disponibilite.create({
      jour,
      heure_debut,
      heure_fin,
      prestataire_id: user.id,
      service_id, // ✅ association ici
    });

    res.status(201).json({ message: "Disponibilité ajoutée", dispo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Voir les disponibilités du prestataire connecté
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user || user.role !== "prestataire") {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const disponibilites = await Disponibilite.findAll({
      where: { prestataire_id: user.id },
    });

    res.json(disponibilites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
