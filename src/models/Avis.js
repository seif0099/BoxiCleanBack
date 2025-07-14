const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Avis = sequelize.define(
  "Avis",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Users", // Assuming your user table is named 'Users'
        key: "id",
      },
    },
    prestataire_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Users", // Assuming prestataire is also in Users table
        key: "id",
      },
    },
    reservation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true, // One avis per reservation
      references: {
        model: "Reservations",
        key: "id",
      },
    },
    commentaire: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: {
          args: [10, 1000],
          msg: "Le commentaire doit contenir entre 10 et 1000 caractères",
        },
        notEmpty: {
          msg: "Le commentaire ne peut pas être vide",
        },
      },
    },
    note: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: [1],
          msg: "La note minimale est 1",
        },
        max: {
          args: [5],
          msg: "La note maximale est 5",
        },
        isInt: {
          msg: "La note doit être un nombre entier",
        },
      },
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["reservation_id"], // Ensure one avis per reservation
      },
      {
        fields: ["prestataire_id"], // For faster queries on prestataire reviews
      },
      {
        fields: ["client_id"], // For faster queries on client reviews
      },
    ],
  }
);

// Define associations (add this to your associations file or main app file)
Avis.associate = (models) => {
  // Avis belongs to a client (User)
  Avis.belongsTo(models.User, {
    foreignKey: "client_id",
    as: "client",
  });

  // Avis belongs to a prestataire (User)
  Avis.belongsTo(models.User, {
    foreignKey: "prestataire_id",
    as: "prestataire",
  });

  // Avis belongs to a reservation
  Avis.belongsTo(models.Reservation, {
    foreignKey: "reservation_id",
    as: "reservation",
  });
};

module.exports = Avis;
