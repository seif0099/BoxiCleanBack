const express = require("express");
const router = express.Router();
const Avis = require("../models/Avis");
const Reservation = require("../models/Reservation");
const Service = require("../models/Service"); // ADD THIS IMPORT
const authenticate = require("../middlewares/auth");

// POST - Create a new avis
router.post("/", authenticate, async (req, res) => {
  try {
    const { prestataire_id, reservation_id, commentaire, note } = req.body;

    // Get client_id from authenticated user
    const client_id = req.user.id;

    console.log("Received review data:", {
      prestataire_id,
      reservation_id,
      commentaire,
      note,
      client_id,
    });

    // Validation
    if (!prestataire_id || !reservation_id || !commentaire || !note) {
      return res.status(400).json({
        message:
          "Tous les champs sont requis (prestataire_id, reservation_id, commentaire, note)",
      });
    }

    // Validate note range (assuming 1-5 scale)
    if (note < 1 || note > 5) {
      return res.status(400).json({
        message: "La note doit être entre 1 et 5",
      });
    }

    // Check if reservation exists and belongs to the client
    const reservation = await Reservation.findOne({
      where: {
        id: reservation_id,
        client_id: client_id,
        statut: "terminée", // Only allow reviews for completed reservations
      },
      include: [
        {
          model: Service,
          as: "Service", // Make sure this matches your association
        },
      ],
    });

    console.log("Found reservation:", reservation);

    if (!reservation) {
      return res.status(404).json({
        message: "Réservation non trouvée ou non terminée",
      });
    }

    // Get prestataire_id from Service if not directly available in Reservation
    let finalPrestataire_id = prestataire_id;
    if (reservation.Service && reservation.Service.prestataire_id) {
      finalPrestataire_id = reservation.Service.prestataire_id;
    }

    console.log("Final prestataire_id:", finalPrestataire_id);

    // Check if avis already exists for this reservation
    const existingAvis = await Avis.findOne({
      where: { reservation_id: reservation_id },
    });

    if (existingAvis) {
      return res.status(400).json({
        message: "Un avis existe déjà pour cette réservation",
      });
    }

    // Create the avis
    const avis = await Avis.create({
      client_id,
      prestataire_id: finalPrestataire_id,
      reservation_id,
      commentaire: commentaire.trim(),
      note: parseInt(note),
    });

    console.log("Created avis:", avis);

    res.status(201).json({
      message: "Avis créé avec succès",
      avis: avis,
    });
  } catch (error) {
    console.error("Erreur création avis:", error);

    // Handle specific Sequelize errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: "Données invalides",
        errors: error.errors.map((err) => err.message),
      });
    }

    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Référence invalide (client, prestataire ou réservation)",
        details: error.message,
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Un avis existe déjà pour cette réservation",
      });
    }

    res.status(500).json({
      message: "Erreur serveur interne",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET - Get all avis for a prestataire
router.get("/prestataire/:id", async (req, res) => {
  try {
    const avis = await Avis.findAll({
      where: { prestataire_id: req.params.id },
      include: [
        {
          model: require("../models/User"),
          as: "clientAvis", // ✅ match your association name
          attributes: ["fullName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(avis);
  } catch (error) {
    console.error("Erreur récupération avis:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET - Get avis for a specific reservation
router.get("/reservation/:id", authenticate, async (req, res) => {
  try {
    const avis = await Avis.findOne({
      where: { reservation_id: req.params.id },
      include: [
        {
          model: require("../models/User"),
          as: "clientAvis",
          attributes: ["fullName"],
        },
      ],
    });

    if (!avis) {
      return res
        .status(404)
        .json({ message: "Aucun avis trouvé pour cette réservation" });
    }

    res.json(avis);
  } catch (error) {
    console.error("Erreur récupération avis:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PUT - Update an avis (optional)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { commentaire, note } = req.body;
    const client_id = req.user.id;

    const avis = await Avis.findOne({
      where: { id: req.params.id, client_id: client_id },
    });

    if (!avis) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }

    // Update validation
    if (note && (note < 1 || note > 5)) {
      return res
        .status(400)
        .json({ message: "La note doit être entre 1 et 5" });
    }

    await avis.update({
      commentaire: commentaire ? commentaire.trim() : avis.commentaire,
      note: note ? parseInt(note) : avis.note,
    });

    res.json({ message: "Avis mis à jour avec succès", avis });
  } catch (error) {
    console.error("Erreur mise à jour avis:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// DELETE - Delete an avis
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const client_id = req.user.id;

    const avis = await Avis.findOne({
      where: { id: req.params.id, client_id: client_id },
    });

    if (!avis) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }

    await avis.destroy();
    res.json({ message: "Avis supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression avis:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
// GET - Get avis for the prestataire connecté
router.get("/prestataire", authenticate, async (req, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== "prestataire") {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const avis = await Avis.findAll({
      where: { prestataire_id: user.id },
      include: [
        {
          model: require("../models/User"),
          as: "clientAvis",
          attributes: ["fullName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(avis);
  } catch (error) {
    console.error("Erreur récupération des avis:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
