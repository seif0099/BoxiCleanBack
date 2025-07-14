const express = require("express");
const Service = require("../models/Service");
const authenticate = require("../middlewares/auth"); // Si tu as un middleware d'auth

const router = express.Router();

// Lister tous les services
router.get("/", async (req, res) => {
  try {
    const services = await Service.findAll();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user || user.role !== "prestataire") {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const disponibilites = await Disponibilite.findAll({
      where: { prestataire_id: user.id },
      include: {
        model: Service,
        as: "service",
        attributes: ["nom_service", "ville"],
      },
    });

    res.json(disponibilites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Récupérer un service par ID
router.get("/:id", async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Créer un nouveau service (exemple simple, tu peux ajouter auth et validation)
router.post("/", authenticate, async (req, res) => {
  try {
    const {
      nom_service,
      description,
      prix_base,
      durée_estimée,
      disponibilité,
      ville,
      region,
    } = req.body;

    // On récupère l'id du prestataire depuis le token (req.user.id)
    const prestataire_id = req.user.id;

    const newService = await Service.create({
      nom_service,
      description,
      prix_base,
      durée_estimée,
      disponibilité,
      prestataire_id,
      ville,
      region,
    });

    res.status(201).json(newService);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mettre à jour un service
router.put("/:id", authenticate, async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // Vérifier que l'utilisateur est bien le prestataire du service
    if (service.prestataire_id !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const {
      nom_service,
      description,
      prix_base,
      durée_estimée,
      disponibilité,
      ville,
      region,
    } = req.body;

    await service.update({
      nom_service,
      description,
      prix_base,
      durée_estimée,
      disponibilité,
      ville,
      region,
    });

    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Supprimer un service
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // Vérifier que l'utilisateur est bien le prestataire du service
    if (service.prestataire_id !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await service.destroy();
    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
