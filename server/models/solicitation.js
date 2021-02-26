
module.exports = (sequelize, DataTypes) => {
    const Solicitation = sequelize.define('Solicitation',
        {
            id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement:true },
            solNum: { type: DataTypes.STRING, allowNull: false },
            inactive: { type: DataTypes.BOOLEAN }
        }, {} );

    Solicitation.associate = function(models) {
        // associations can be defined here
    }

    return Solicitation
};
