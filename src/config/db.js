const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME, // 'boxiclean'
  process.env.DB_USER, // 'postgres'
  process.env.DB_PASSWORD, // 97560524
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    logging: false, // ou true pour voir les requêtes SQL
  }
);

module.exports = sequelize;
