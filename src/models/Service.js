const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Service = sequelize.define("Service", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nom_service: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  prix_base: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  durée_estimée: {
    type: DataTypes.INTEGER,
  },
  disponibilité: {
    type: DataTypes.STRING,
  },
  ville: {
    type: DataTypes.STRING,
  },
  region: {
    type: DataTypes.STRING,
  },
});

module.exports = Service;
