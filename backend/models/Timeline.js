const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Timeline = sequelize.define('Timeline', {
  proposalId:    { type: DataTypes.INTEGER, allowNull: false },
  no:            { type: DataTypes.INTEGER },
  milestone:     { type: DataTypes.STRING },
  tentativeDate: { type: DataTypes.STRING },
});

module.exports = Timeline;