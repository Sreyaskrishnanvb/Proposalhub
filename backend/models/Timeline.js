module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Timeline', {
    proposalId: DataTypes.INTEGER,
    tableKey:   DataTypes.STRING,
    rowIndex:   DataTypes.INTEGER,
    colIndex:   DataTypes.INTEGER,
    value:      DataTypes.TEXT,
  });
};