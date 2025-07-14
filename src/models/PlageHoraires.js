module.exports = (sequelize, DataTypes) => {
  const PlageHoraire = sequelize.define("PlageHoraire", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    jour: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]],
      },
    },
    heure_debut: {
      type: DataTypes.STRING, // or TIME depending on your setup
      allowNull: false,
    },
    heure_fin: {
      type: DataTypes.STRING, // or TIME
      allowNull: false,
    },
  });

  PlageHoraire.associate = (models) => {
    PlageHoraire.belongsTo(models.Service, {
      foreignKey: "service_id",
      onDelete: "CASCADE",
    });
  };

  return PlageHoraire;
};
