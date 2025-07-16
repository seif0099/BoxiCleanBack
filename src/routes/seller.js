const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/auth");
const Product = require("../models/Produit");
const Commande = require("../models/Commande");
const CommandeItem = require("../models/CommandeItem");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure file storage
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// ✅ GET - Liste des produits du vendeur connecté
router.get("/products", authenticate, async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { vendeur_id: req.user.id },
      order: [["createdAt", "DESC"]],
    });
    res.json(products);
  } catch (err) {
    console.error("Erreur chargement produits vendeur:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Helper to save base64 image
const saveBase64Image = (base64, filename) => {
  const buffer = Buffer.from(base64, "base64");
  const filePath = path.join(__dirname, "..", "uploads", filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`; // path to store in DB
};

// ✅ POST - Ajouter un produit avec image base64
router.post("/products", authenticate, async (req, res) => {
  try {
    const {
      nom,
      description,
      prix,
      stock,
      categorie,
      code_barres,
      image_base64,
    } = req.body;

    let image_url = null;

    if (image_base64) {
      const timestamp = Date.now();
      const filename = `${timestamp}-product.jpg`; // you can also use .png or .jpeg
      image_url = saveBase64Image(image_base64, filename);
    }

    const newProduct = await Product.create({
      vendeur_id: req.user.id,
      nom,
      description,
      prix,
      stock,
      categorie,
      code_barres,
      image_url,
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error("Erreur ajout produit base64:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ PUT - Modifier un produit
router.put("/products/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({
      where: { id, vendeur_id: req.user.id },
    });

    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

    await product.update(req.body);
    res.json(product);
  } catch (err) {
    console.error("Erreur modification produit:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ DELETE - Supprimer un produit
router.delete("/products/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.destroy({
      where: { id, vendeur_id: req.user.id },
    });

    if (!deleted)
      return res.status(404).json({ message: "Produit introuvable" });
    res.json({ message: "Produit supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression produit:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ GET - Commandes reçues par le vendeur
router.get("/orders", authenticate, async (req, res) => {
  try {
    const commandes = await Commande.findAll({
      where: { vendeur_id: req.user.id },
      include: [
        { model: User, as: "client", attributes: ["id", "fullName", "email"] },
        {
          model: CommandeItem,
          as: "items",
          include: [{ model: Product, as: "produit" }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(commandes);
  } catch (err) {
    console.error("Erreur chargement commandes vendeur:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
