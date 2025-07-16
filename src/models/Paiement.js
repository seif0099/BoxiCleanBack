const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); 

const Paiement = sequelize.define("Paiement", {
  montant: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING, // ex: 'en_ligne' or 'espece'
    allowNull: false,
  },
  reservation_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  abonnement_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  client_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  prestataire_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  statut: {
    type: DataTypes.STRING,
    defaultValue: "payé",
  },
});

module.exports = Paiement;
