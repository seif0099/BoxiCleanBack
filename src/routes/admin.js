// routes/admin.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Reservation = require("../models/Reservation");
const Service = require("../models/Service");
const Abonnement = require("../models/Abonnement");
const Paiement = require("../models/Paiement");

// GET /admin/users - list all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "fullName", "email", "role", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json(users);
  } catch (err) {
    console.error("Erreur chargement users:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// DELETE /admin/users/:id - delete a user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.destroy({ where: { id } });

    if (!deleted) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression user:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
router.get("/reservations", async (req, res) => {
  try {
    const reservations = await Reservation.findAll({
      include: [
        {
          model: User,
          as: "Client",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: User,
          as: "PrestataireUser",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: Service,
          attributes: ["id", "nom_service", "prix_base"], // include price here ✅
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(reservations);
  } catch (err) {
    console.error("❌ Error fetching admin reservations:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/abonnements", async (req, res) => {
  try {
    const abonnements = await Abonnement.findAll({
      include: [
        {
          model: User,
          as: "utilisateur",
          attributes: ["id", "fullName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(abonnements);
  } catch (err) {
    console.error("❌ Error fetching abonnements:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalReservations = await Reservation.count();

    // total payments (example: sum of montant column)
    const paymentsResult = await Paiement.sum("montant");
    const totalPayments = paymentsResult || 0;

    // active abonnements (example: where statut === "actif")
    const abonnementsActifs = await Abonnement.count({
      where: { statut: "actif" },
    });

    res.json({
      users: totalUsers,
      reservations: totalReservations,
      payments: totalPayments,
      abonnements: abonnementsActifs,
    });
  } catch (err) {
    console.error("❌ Erreur lors de la récupération des stats admin:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/monthly-stats", async (req, res) => {
  try {
    const sequelize = require("sequelize");

    // Group revenue by month
    const paiements = await Paiement.findAll({
      attributes: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
          "month",
        ],
        [sequelize.fn("SUM", sequelize.col("montant")), "total"],
      ],
      group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt"))],
      order: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
          "ASC",
        ],
      ],
    });

    // Group reservations by month
    const reservations = await Reservation.findAll({
      attributes: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
          "month",
        ],
        [sequelize.fn("COUNT", "*"), "count"],
      ],
      group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt"))],
      order: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
          "ASC",
        ],
      ],
    });

    // Group abonnements by month
    const abonnements = await Abonnement.findAll({
      attributes: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
          "month",
        ],
        [sequelize.fn("COUNT", "*"), "count"],
      ],
      where: { statut: "actif" },
      group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt"))],
      order: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
          "ASC",
        ],
      ],
    });

    res.json({ paiements, reservations, abonnements });
  } catch (err) {
    console.error("❌ Error getting monthly stats:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
// PUT /admin/users/:id/validate - validate a prestataire user
router.put("/users/:id/validate", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    if (user.role !== "prestataire") {
      return res
        .status(400)
        .json({ message: "Seuls les prestataires peuvent être validés." });
    }
    if (user.validated) {
      return res.status(400).json({ message: "Prestataire déjà validé." });
    }
    user.validated = true;
    await user.save();
    res.json({ message: "Prestataire validé avec succès." });
  } catch (err) {
    console.error("Erreur validation prestataire:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /admin/prestataires/unvalidated - list all unvalidated prestataires
router.get("/prestataires/unvalidated", async (req, res) => {
  try {
    const prestataires = await User.findAll({
      where: { role: "prestataire", validated: false },
      attributes: ["id", "fullName", "email", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json(prestataires);
  } catch (err) {
    console.error("Erreur chargement prestataires non validés:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
