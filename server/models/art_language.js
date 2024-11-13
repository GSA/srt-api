
module.exports = (sequelize, DataTypes) => {
    const ArtLanguage = sequelize.define('ArtLanguage',
        {
            id: { 
                type: DataTypes.INTEGER,
                 allowNull: false, 
                 primaryKey: true, 
                 autoIncrement:true 
                },
            solicitation_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Solicitation', // Name of the referenced table
                    key: 'id', // Key in the referenced table
                }
                },
            
            language: {
                type: DataTypes.JSONB,
                allowNull: false
                },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE },
        },{
            tableName: 'art_language',
            timestamps: true
        }
    )

    ArtLanguage.associate = function(models) {
        // associations can be defined here
        ArtLanguage.belongsTo(models.Solicitation, {
            foreignKey: 'solicitation_id',
            targetKey: 'id',
            as: 'solicitation'
        })

    }

    return ArtLanguage;
};