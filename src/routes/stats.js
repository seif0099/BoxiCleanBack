const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
const Service = require("../models/Service");
const { Op } = require("sequelize");

// GET /stats/prestataire/:prestataireId
router.get("/prestataire/:prestataireId", async (req, res) => {
  const { prestataireId } = req.params;

  console.log("📊 Stats request for prestataire:", prestataireId);

  try {
    // Récupérer tous les services du prestataire
    console.log("🔍 Fetching services...");
    const services = await Service.findAll({
      where: { prestataire_id: prestataireId },
      attributes: ["id", "prix_base"], // 🔧 Changed from "prix" to "prix_base"
    });

    console.log("✅ Services found:", services.length);
    console.log(
      "Services data:",
      services.map((s) => ({ id: s.id, prix_base: s.prix_base }))
    );

    const serviceIds = services.map((s) => s.id);
    const servicePrices = Object.fromEntries(
      services.map((s) => [s.id, s.prix_base]) // 🔧 Changed from "prix" to "prix_base"
    );

    console.log("Service IDs:", serviceIds);
    console.log("Service prices:", servicePrices);

    // Récupérer les réservations
    console.log("🔍 Fetching reservations...");
    const reservations = await Reservation.findAll({
      where: {
        service_id: {
          [Op.in]: serviceIds,
        },
      },
    });

    console.log("✅ Reservations found:", reservations.length);
    console.log(
      "Reservations:",
      reservations.map((r) => ({
        id: r.id,
        service_id: r.service_id,
        statut: r.statut,
      }))
    );

    const total = reservations.length;
    const terminees = reservations.filter((r) => r.statut === "terminee");
    const annulees = reservations.filter((r) => r.statut === "annulee");
    const chiffreAffaires = terminees.reduce(
      (total, r) => total + (servicePrices[r.service_id] || 0),
      0
    );

    console.log("📊 Stats calculated:", {
      totalPrestations: total,
      terminees: terminees.length,
      annulees: annulees.length,
      chiffreAffaires,
    });

    res.json({
      totalPrestations: total,
      terminees: terminees.length,
      annulees: annulees.length,
      chiffreAffaires,
      historique: reservations,
    });
  } catch (error) {
    console.error("❌ Erreur statistiques détaillée:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      message: "Erreur serveur",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
