const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CommandeItem = sequelize.define("CommandeItem", {
  commande_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantite: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  prix_unitaire: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
});

module.exports = CommandeItem;
