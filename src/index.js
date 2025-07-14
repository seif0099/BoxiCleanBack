// ✅ Load .env first
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const sequelize = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet());
app.use(express.json());

// ✅ Models
const User = require("./models/User");
const Service = require("./models/Service");
const Abonnement = require("./models/Abonnement");
const Disponibilite = require("./models/Disponibilite");
const Reservation = require("./models/Reservation");
const Avis = require("./models/Avis");

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

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Boxiclean API is running...");
});

// ✅ Launch server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
