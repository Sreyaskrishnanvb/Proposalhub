const sequelize = require('../db');

// These use the old style (already initialized, just import directly)
const User     = require('./User');
const Proposal = require('./Proposal');

// These use the new function style (must be called with sequelize + DataTypes)
const { DataTypes } = require('sequelize');
const CourseStructure = require('./CourseStructure')(sequelize, DataTypes);
const Timeline        = require('./Timeline')(sequelize, DataTypes);
const Budget          = require('./Budget')(sequelize, DataTypes);

// Relationships
User.hasMany(Proposal,              { foreignKey: 'userId' });
Proposal.belongsTo(User,            { foreignKey: 'userId' });

Proposal.hasMany(CourseStructure,   { foreignKey: 'proposalId', onDelete: 'CASCADE' });
CourseStructure.belongsTo(Proposal, { foreignKey: 'proposalId' });

Proposal.hasMany(Timeline,          { foreignKey: 'proposalId', onDelete: 'CASCADE' });
Timeline.belongsTo(Proposal,        { foreignKey: 'proposalId' });

Proposal.hasMany(Budget,            { foreignKey: 'proposalId', onDelete: 'CASCADE' });
Budget.belongsTo(Proposal,          { foreignKey: 'proposalId' });

module.exports = { sequelize, User, Proposal, CourseStructure, Timeline, Budget };