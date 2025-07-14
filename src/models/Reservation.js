const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("../models/User");

const Reservation = sequelize.define("Reservation", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  client_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  service_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  heure: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  statut: {
    type: DataTypes.ENUM("en_attente", "confirmee", "annulee", "terminee"),
    defaultValue: "en_attente",
  },
  mode_paiement: {
    type: DataTypes.STRING, // ou ENUM("en ligne", "à la livraison") si tu veux restreindre
    allowNull: true,
  },
  prestataire_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
});
Reservation.belongsTo(User, {
  foreignKey: "prestataire_id",
  as: "Prestataire",
});

module.exports = Reservation;
