const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Commande = sequelize.define("Commande", {
  client_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  vendeur_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  statut: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "en_attente", // "en_attente", "validée", "expédiée", "livrée", "annulée"
  },
  mode_paiement: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "en_ligne", // or "à_la_livraison"
  },
  adresse_livraison: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = Commande;
