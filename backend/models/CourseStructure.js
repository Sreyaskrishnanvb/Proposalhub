module.exports = (sequelize, DataTypes) => {
  return sequelize.define('CourseStructure', {
    proposalId: DataTypes.INTEGER,
    tableKey:   DataTypes.STRING,
    rowIndex:   DataTypes.INTEGER,
    colIndex:   DataTypes.INTEGER,
    value:      DataTypes.TEXT,
  });
};