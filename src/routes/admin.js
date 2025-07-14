// routes/admin.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Reservation = require("../models/Reservation");
const Service = require("../models/Service");
const Abonnement = require("../models/Abonnement");

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
module.exports = router;
