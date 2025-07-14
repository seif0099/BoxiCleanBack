// routes/planning.js
const express = require("express");
const router = express.Router();
const Disponibilite = require("../models/Disponibilite");
const Reservation = require("../models/Reservation");
const Service = require("../models/Service");
const User = require("../models/User");
const { Op } = require("sequelize");

// Function to convert date to French day name
function getJourFromDate(dateString) {
  const date = new Date(dateString);
  const days = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  return days[date.getDay()];
}

// GET /planning/:prestataireId
router.get("/:prestataireId", async (req, res) => {
  const { prestataireId } = req.params;
  const { date, statut } = req.query;

  console.log("🔍 Planning request:", { prestataireId, date, statut });

  try {
    // Convert date to day name if date is provided
    let jourFilter = {};
    if (date) {
      const jour = getJourFromDate(date);
      jourFilter = { jour };
      console.log(`📅 Date ${date} converted to jour: ${jour}`);
    }

    // Récupère les disponibilités
    console.log("📅 Fetching disponibilités...");
    const disponibilites = await Disponibilite.findAll({
      where: {
        prestataire_id: prestataireId,
        ...jourFilter,
      },
    });
    console.log("✅ Disponibilités found:", disponibilites.length);

    // Récupère les réservations pour ce prestataire
    console.log("📝 Fetching reservations...");
    const reservations = await Reservation.findAll({
      where: {
        ...(statut && { statut }),
        ...(date && { date }), // Reservation table uses actual dates
      },
      include: [
        {
          model: Service,
          where: { prestataire_id: prestataireId },
          required: true,
        },
        {
          model: User,
          as: "Client",
          attributes: ["id", "fullName", "email"],
        },
      ],
    });
    console.log("✅ Reservations found:", reservations.length);

    res.json({
      disponibilites,
      reservations,
      // Include the converted day for debugging
      ...(date && { convertedJour: getJourFromDate(date) }),
    });
  } catch (error) {
    console.error("❌ Erreur planning détaillée:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      message: "Erreur serveur",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
