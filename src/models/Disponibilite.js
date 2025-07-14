const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Disponibilite = sequelize.define("Disponibilite", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  prestataire_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  service_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  jour: {
    type: DataTypes.ENUM(
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
      "dimanche"
    ),
    allowNull: false,
  },
  heure_debut: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  heure_fin: {
    type: DataTypes.TIME,
    allowNull: false,
  },
});

module.exports = Disponibilite;
