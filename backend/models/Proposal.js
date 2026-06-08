const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Proposal = sequelize.define('Proposal', {
  userId:             { type: DataTypes.INTEGER },
  category:           { type: DataTypes.STRING },
  proposalTitle:      { type: DataTypes.STRING },
  studentName:        { type: DataTypes.STRING },
  studentId:          { type: DataTypes.STRING },
  department:         { type: DataTypes.STRING },
  academicYear:       { type: DataTypes.STRING },
  projectType:        { type: DataTypes.STRING },
  duration:           { type: DataTypes.STRING },
  introduction:       { type: DataTypes.TEXT },
  problemStatement:   { type: DataTypes.TEXT },
  objectives:         { type: DataTypes.TEXT },
  scopeOfWork:        { type: DataTypes.TEXT },
  methodologies:      { type: DataTypes.TEXT },
  tools:              { type: DataTypes.TEXT },
  teamComposition:    { type: DataTypes.STRING },
  expectedOutcome:    { type: DataTypes.TEXT },
  futureEnhancements: { type: DataTypes.TEXT },
  references:         { type: DataTypes.TEXT },
  status:             { type: DataTypes.STRING, defaultValue: 'pending' },
  submittedAt:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Proposal;