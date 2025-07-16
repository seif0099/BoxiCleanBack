const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Livraison = sequelize.define("Livraison", {
  commande_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  livreur_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  statut: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "en_attente", // other values: "en_livraison", "livrée", etc.
  },
  date_estimee: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  date_livraison_effective: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  coordonnees_client: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = Livraison;
