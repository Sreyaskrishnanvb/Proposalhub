const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Budget = sequelize.define('Budget', {
  proposalId: { type: DataTypes.INTEGER, allowNull: false },
  head:       { type: DataTypes.STRING },
  amount:     { type: DataTypes.STRING },
});

module.exports = Budget;