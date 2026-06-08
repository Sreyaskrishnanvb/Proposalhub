const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email:    { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  course:   { type: DataTypes.STRING, allowNull: false },
  doj:      { type: DataTypes.STRING, allowNull: false },
  role:     { type: DataTypes.STRING, allowNull: false },
});

module.exports = User;