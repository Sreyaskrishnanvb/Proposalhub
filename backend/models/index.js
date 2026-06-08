const sequelize       = require('../db');
const User            = require('./User');
const Proposal        = require('./Proposal');
const CourseStructure = require('./CourseStructure');
const Timeline        = require('./Timeline');
const Budget          = require('./Budget');

// Relationships
User.hasMany(Proposal,            { foreignKey: 'userId' });
Proposal.belongsTo(User,          { foreignKey: 'userId' });

Proposal.hasMany(CourseStructure, { foreignKey: 'proposalId', onDelete: 'CASCADE' });
CourseStructure.belongsTo(Proposal, { foreignKey: 'proposalId' });

Proposal.hasMany(Timeline,        { foreignKey: 'proposalId', onDelete: 'CASCADE' });
Timeline.belongsTo(Proposal,      { foreignKey: 'proposalId' });

Proposal.hasMany(Budget,          { foreignKey: 'proposalId', onDelete: 'CASCADE' });
Budget.belongsTo(Proposal,        { foreignKey: 'proposalId' });

module.exports = { sequelize, User, Proposal, CourseStructure, Timeline, Budget };