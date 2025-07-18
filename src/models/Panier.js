const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Product = require("./Produit");
const User = require("./User");

const Panier = sequelize.define(
  "Panier",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    produit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantite: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
  },
  {
    tableName: "panier",
    timestamps: true,
  }
);

// Associations
Panier.belongsTo(Product, {
  foreignKey: "produit_id",
  as: "Produit",
});

Panier.belongsTo(User, {
  foreignKey: "client_id",
  as: "Client",
});

module.exports = Panier;
