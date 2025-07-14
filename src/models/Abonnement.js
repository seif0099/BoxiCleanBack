const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Abonnement = sequelize.define("Abonnement", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  utilisateur_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type_abonnement: {
    type: DataTypes.ENUM("mensuel", "annuel", "premium"),
    allowNull: false,
  },
  date_debut: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  date_fin: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  statut: {
    type: DataTypes.ENUM("actif", "inactif", "en_attente","annulé"),
    defaultValue: "actif",
  },
  montant: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  stripe_session_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Abonnement;
