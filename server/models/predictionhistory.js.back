var mongoose = require('mongoose');

var PredictionHistory = mongoose.model('PredictionHistory', {
    solNum: {
        type: String
    },

    title: {
        type: String
    },
    
    noticeType: {
        type: String
    },

    eitLikelihood: {
        naiscs: String,
        value: String
    },
    predictionHistory: [{
        value: String,
        date: String        
    }],
});


module.exports = {PredictionHistory};