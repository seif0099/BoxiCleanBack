const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
const authenticate = require("../middlewares/auth");
const Service = require("../models/Service");
const { Op } = require("sequelize");
const User = require("../models/User");

// Réserver un service
// Réserver un service
router.post("/", authenticate, async (req, res) => {
  if (req.user.role !== "client") {
    return res.status(403).json({ message: "Non autorisé" });
  }

  const { service_id, date, heure, mode_paiement } = req.body;

  try {
    // 🔧 Fetch the service from DB to get its prestataire_id
    const service = await Service.findByPk(service_id);
    if (!service) {
      return res.status(404).json({ message: "Service introuvable" });
    }

    const reservation = await Reservation.create({
      client_id: req.user.id,
      service_id,
      date,
      heure,
      mode_paiement,
      prestataire_id: service.prestataire_id, // ✅ Now it's valid
    });

    res.status(201).json(reservation);
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Non autorisé" });
    }
    const reservations = await Reservation.findAll({
      where: { client_id: req.user.id },
      include: [
        {
          model: Service,
          attributes: ["nom_service", "description", "prix_base"],
        },
      ],
      order: [["date", "DESC"]],
    });

    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/prestataire", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "prestataire") {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const services = await Service.findAll({
      where: { prestataire_id: req.user.id },
    });
    const serviceIds = services.map((s) => s.id);

    const reservations = await Reservation.findAll({
      where: {
        service_id: {
          [Op.in]: serviceIds,
        },
      },
      include: [
        {
          model: Service, // ✅ Add this to get service details
          attributes: ["nom_service", "description", "prix_base","ville"],
        },
        {
          model: User,
          as: "Client",
          attributes: ["fullName", "email"], // ✅ include adresse if you want to display it
        },
      ],
      order: [
        ["date", "ASC"],
        ["heure", "ASC"],
      ],
    });

    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /reservations/:id/statut
router.patch("/:id/statut", authenticate, async (req, res) => {
  if (req.user.role !== "prestataire") {
    return res.status(403).json({ message: "Non autorisé" });
  }

  const { id } = req.params;
  const { statut } = req.body;

  // Statuts autorisés
  const statutsValides = ["en_attente", "confirmee", "annulee", "terminee"];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ message: "Statut invalide" });
  }

  try {
    // Vérifier que la réservation appartient bien à un service du prestataire
    const reservation = await Reservation.findByPk(id, {
      include: {
        model: Service,
        where: { prestataire_id: req.user.id },
      },
    });

    if (!reservation) {
      return res
        .status(404)
        .json({ message: "Réservation non trouvée ou non autorisée" });
    }

    // Mise à jour
    reservation.statut = statut;
    await reservation.save();

    res.json({ message: "Statut mis à jour", reservation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
