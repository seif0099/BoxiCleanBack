// ✅ Load .env first
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const sequelize = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;
const path = require("path");

app.use(
  cors({
    origin: "http://localhost:5173", // adjust if frontend runs elsewhere
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
const uploadPath = path.join(__dirname, "uploads");
console.log("🛠️ Serving static files from:", uploadPath); // debug log

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // 👈 this is what fixes it
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);
const fs = require("fs");
// ✅ Models
const User = require("./models/User");
const Service = require("./models/Service");
const Abonnement = require("./models/Abonnement");
const Disponibilite = require("./models/Disponibilite");
const Reservation = require("./models/Reservation");
const Avis = require("./models/Avis");
const Paiement = require("./models/Paiement");
const Product = require("./models/Produit");
const Livraison = require("./models/Livraison");
const Commande = require("./models/Commande");
const CommandeItem = require("./models/CommandeItem");
const Panier = require("./models/Panier");
// ✅ Associations
User.hasMany(Service, { foreignKey: "prestataire_id" });
Service.belongsTo(User, { foreignKey: "prestataire_id" });

Abonnement.belongsTo(User, { foreignKey: "utilisateur_id", as: "utilisateur" });
User.hasMany(Abonnement, { foreignKey: "utilisateur_id", as: "abonnements" });

User.hasMany(Disponibilite, { foreignKey: "prestataire_id" });
Disponibilite.belongsTo(User, { foreignKey: "prestataire_id" });

Service.hasMany(Disponibilite, {
  foreignKey: "service_id",
  as: "plages_horaires",
});
Disponibilite.belongsTo(Service, {
  foreignKey: "service_id",
  as: "service",
});

User.hasMany(Reservation, {
  foreignKey: "client_id",
  as: "ClientReservations",
});
Reservation.belongsTo(User, { foreignKey: "client_id", as: "Client" });

User.hasMany(Reservation, {
  foreignKey: "prestataire_id",
  as: "PrestataireReservations",
});
Reservation.belongsTo(User, {
  foreignKey: "prestataire_id",
  as: "PrestataireUser",
});

Service.hasMany(Reservation, { foreignKey: "service_id" });
Reservation.belongsTo(Service, { foreignKey: "service_id" });

User.hasMany(Avis, { foreignKey: "client_id", as: "avisClient" });
User.hasMany(Avis, { foreignKey: "prestataire_id", as: "avisPrestataire" });
Avis.belongsTo(User, { foreignKey: "client_id", as: "clientAvis" });
Avis.belongsTo(User, { foreignKey: "prestataire_id", as: "PrestataireUser" }); // or PrestataireInfo
Avis.belongsTo(Reservation, {
  foreignKey: "reservation_id",
  as: "reservation",
});
Reservation.hasOne(Avis, { foreignKey: "reservation_id", as: "avis" });

Paiement.belongsTo(User, { foreignKey: "client_id", as: "Client" });
Paiement.belongsTo(User, { foreignKey: "prestataire_id", as: "Prestataire" });
Paiement.belongsTo(Reservation, { foreignKey: "reservation_id" });
Paiement.belongsTo(Abonnement, { foreignKey: "abonnement_id" });

// 🔗 User ↔ Product
User.hasMany(Product, { foreignKey: "vendeur_id" });
Product.belongsTo(User, { foreignKey: "vendeur_id", as: "vendeur" });

// 🔗 Commande ↔ Livraison
Commande.hasOne(Livraison, { foreignKey: "commande_id", as: "livraison" });
Livraison.belongsTo(Commande, { foreignKey: "commande_id", as: "commande" });

// 🔗 Livreur ↔ Livraison (User with role 'livreur')
User.hasMany(Livraison, { foreignKey: "livreur_id", as: "livraisons" });
Livraison.belongsTo(User, { foreignKey: "livreur_id", as: "livreur" });
Commande.belongsTo(User, { foreignKey: "client_id", as: "client" });
Commande.belongsTo(User, { foreignKey: "vendeur_id", as: "vendeur" });

Commande.hasMany(CommandeItem, { foreignKey: "commande_id", as: "items" });
CommandeItem.belongsTo(Commande, { foreignKey: "commande_id" });

CommandeItem.belongsTo(Product, { foreignKey: "product_id", as: "produit" });
// ✅ Test DB connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Failed to connect DB:", err));

// ✅ Sync models
sequelize.sync({ alter: true }).then(() => {
  console.log("📦 Tables synced");
});

// ✅ Routes
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

const panierRoutes = require("./routes/panier");
app.use("/panier", panierRoutes);
// Ensure uploads directory exists
const checkoutRoutes = require("./routes/checkout");
app.use("/checkout", checkoutRoutes);
const commandeRoutes = require("./routes/commande");
app.use("/commande", commandeRoutes);


const classementRoutes = require("./routes/user"); // or user
app.use("/prestataires", classementRoutes);
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/user"));
app.use("/services", require("./routes/service"));
app.use("/abonnements", require("./routes/abonnement"));
app.use("/disponibilites", require("./routes/disponibilite"));
app.use("/reservations", require("./routes/reservation"));
app.use("/planning", require("./routes/planning"));
app.use("/stats", require("./routes/stats"));
app.use("/payments", require("./routes/paymentClient"));
app.use("/payments-abonnement", require("./routes/paymentAbonnement"));
app.use("/avis", require("./routes/avis"));
const sellerRoutes = require("./routes/seller");
app.use("/seller", sellerRoutes);

// Test route for specific image

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Boxiclean API is running...");
});

// ✅ Launch server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
