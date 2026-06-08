const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CourseStructure = sequelize.define('CourseStructure', {
  proposalId: { type: DataTypes.INTEGER, allowNull: false },
  no:         { type: DataTypes.INTEGER },
  title:      { type: DataTypes.STRING },
  level:      { type: DataTypes.STRING },
  hours:      { type: DataTypes.STRING },
  credits:    { type: DataTypes.INTEGER },
});

module.exports = CourseStructure;
