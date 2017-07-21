require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const date = require('date-and-time');

var {mongoose} = require('./db/mongoose');
var {Prediction} = require('./models/prediction');
var {Agency} = require('./models/agency');
var {Survey} = require('./models/survey');

var userRoutes = require('./routes/user.routes');
var emailRoutes = require('./routes/email.routes');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

// The headers must be sent to allow Cross Origin Resource Sharing
// Requests to connect will be denied without this
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization, x-auth');
    res.setHeader('Access-Control-Expose-Headers', 'x-auth');
    next();
});

app.use('/user', userRoutes);
app.use('/email', emailRoutes);

app.get('/predictions', (req, res) => {  
    Prediction.find().then((preds) => {
        res.send(preds);
    }, (e) => {
        res.status(400).send(e);
    });
});

app.get('/ICT', (req, res) => {  
    Prediction.find({'eitLikelihood.value': 'Yes'}).then((preds) => { 
        res.send(preds);
    }, (e) => {
        res.status(400).send(e);
    });
});


app.post('/Analytics', (req, res) => {
    console.log(req.body)
    var params = {};
    

    var fromPeriod = req.body.fromPeriod;
    var toPeriod = req.body.toPeriod;
    var agency = req.body.agency;    

    var date = fromPeriod.split('/');
    var from = new Date(date[2], date[0]-1, date[1]);
    date = toPeriod.split('/');
    var to = new Date(date[2], date[0]-1, date[1]);


    // getting filter params
    //_.merge(params, {'eitLikelihood.value': 'Yes'});
 
    _.merge(params, {"$and":
            [
                    {"numDocs":{ "$ne":"0"}},
                    {"eitLikelihood.value":"Yes"},
                    {"noticeType":{ "$ne":"Presolicitation"}}
            ]});

    Prediction.find(params).then((predictions) => {

        var totalICT = 0;
        var compliance = 0;
        var uncompliance = 0;
        var undetermined = 0;
        var machineReadable = 0;
        var machineUnreadable = 0;        
        var updatedCompliantICT = 0;
        var updatedNonCompliantICT = 0;
        var email = 0;
        var review = 0;

        // data for scanned solicitations charts
        var scannedToDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 ));
        var scannedFromDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 32 ));     
        var scannedData = {};
        var latestCompliance = 0;
        var latestUncompliance = 0;
        var latestUndetermined = 0;

        // Top Agency section
        var topAgencies = {};
        var map = {};

        for (var i = 0; i < predictions.length; i++) {
            // Filter Section
            if (new Date(predictions[i].date) > from && 
                new Date(predictions[i].date) < to && 
                (agency == predictions[i].agency || agency == "Government-wide"))
            {         
                totalICT++;       
                // only count determined ones
                if (!predictions[i].undetermined) 
                {                    
                    if (predictions[i].predictions.value == "GREEN")  compliance++
                    else uncompliance++
                    
                    // get latest compliance and noncompliance
                    if (new Date(predictions[i].date) > scannedFromDate && new Date(predictions[i].date) < scannedToDate) 
                    {           
                        if (predictions[i].predictions.value == "GREEN")  latestCompliance++
                        else latestUncompliance++
                    }   

                    if (predictions[i].predictions.value == "GREEN" && 
                        predictions[i].history.filter(function(e){return e["action"].indexOf('Solicitation Updated on FBO.gov') > -1 }).length > 0) 
                        updatedCompliantICT++;
                    
                    if (predictions[i].predictions.value == "RED" && 
                        predictions[i].history.filter(function(e){return e["action"].indexOf('Solicitation Updated on FBO.gov') > -1 }).length > 0)
                        updatedNonCompliantICT++;

                    if (predictions[i].history.filter(function(e){return e["action"].indexOf('sent email to POC') > -1}).length > 0)
                        email++;

                    if (predictions[i].history.filter(function(e){return e["action"].indexOf('reviewed solicitation action requested summary') > -1}).length > 0)
                        review++;   
                    

                    /******************************
                     *   Top Agencies bar chart   *
                     ******************************/

                    // if filter is Government-wide, we don't need to worry about prediction date.
                    if (agency == "Government-wide")
                    {
                        // Top Agency section                   
                        if (map[predictions[i].agency] == null)
                        {                        
                            map[predictions[i].agency] = 1;
                            topAgencies[predictions[i].agency] = {};
                            topAgencies[predictions[i].agency]["name"] = predictions[i].agency;   
                            topAgencies[predictions[i].agency]["red"] = 0;          
                            topAgencies[predictions[i].agency]["green"] = 0;      
                            if (predictions[i].predictions.value == "GREEN") topAgencies[predictions[i].agency]["green"]++;  
                            else topAgencies[predictions[i].agency]["red"]++ ; 

                        } 
                        else {
                            if (predictions[i].predictions.value == "GREEN") topAgencies[predictions[i].agency]["green"]++;
                            else topAgencies[predictions[i].agency]["red"]++ ; 
                        }
                    }
                    else
                    {
                        if (predictions[i].agency == agency)
                        {   
                            if (topAgencies[agency] == null) topAgencies[agency] = [predictions[i]];
                            else topAgencies[agency].push(predictions[i]);                            
                        }
                    }                    
                }
                else
                {
                    // get latest undetermined
                    if (new Date(predictions[i].date) > scannedFromDate && new Date(predictions[i].date) < scannedToDate) latestUndetermined++;
                    undetermined++
                }
            }



            // ignore undermined section AND filter                
            var document = predictions[i].parseStatus.length;
            for (var j = 0; j < document; j ++)
            {
                if (predictions[i].parseStatus[j].status == "successfully parsed") machineReadable++;
                else machineUnreadable++;
            }
             
            
            if (new Date(predictions[i].date) > scannedFromDate && new Date(predictions[i].date) < scannedToDate) 
            {                    
                var day = +(predictions[i].date.split('/')[0] + predictions[i].date.split('/')[1]);
                if (scannedData[day] == null) scannedData[day] = 1;
                else scannedData[day] = scannedData[day] + 1;  
            }   
        }
        console.log(latestUndetermined);
        var analytics = {
            ScannedSolicitationChart:
            {
                scannedData: scannedData,
            },
            MachineReadableChart:
            {
                machineReadable: machineReadable,
                machineUnreadable: machineUnreadable
            },
            ComplianceRateChart: 
            {                
                compliance: compliance,
                determinedICT: totalICT - undetermined,
            },
            ConversionRateChart: 
            {
                updatedCompliantICT: updatedCompliantICT,
                uncompliance: uncompliance,
            },
            TopSRTActionChart:
            {
                determinedICT: totalICT - undetermined,
                uncompliance: uncompliance,
                review: review,
                email: email,
                updatedICT: updatedNonCompliantICT + updatedCompliantICT,
                updatedCompliantICT: updatedCompliantICT,
                updatedNonCompliantICT: updatedNonCompliantICT
            },
            TopAgenciesChart: 
            {
                topAgencies: topAgencies
            },
            PredictResultChart:
            {
                compliance: latestCompliance,
                uncompliance: latestUncompliance
            }
        }

        res.send(analytics);
    }, (e) => {
        res.status(400).send(e);
    });

});

// Route to get the selected solicitation for detailed display
app.get('/solicitation/:id', (req, res) => {
    Prediction.findById(req.params.id).then((solicitation) => {
        res.send(solicitation);
    }, (e) => {
        res.status(400).send(e);
    });
});

// Route to update the history when email is sent to PoC
app.post('/solicitation', (req, res) => {

    var status =  req.body.history.filter(function(e){
        return e["status"] != '';
    })

    Prediction.findById(req.body._id).then((solicitation) => {
        // update history 
        solicitation.history = req.body.history;   
        solicitation.feedback = req.body.feedback;
        if (status.length > 1) 
        {
            solicitation.actionStatus = status[status.length-1]["status"];
            solicitation.actionDate = status[status.length-1]["date"];
        }
        solicitation.save().then((doc) => {
            res.send(doc);
        }, (e) => {
            res.status(400).send(e);
        })
    })
});

// This post is used to get the data from Mongo
// Filter is used to ensure a user is only able to see their agency data
app.post('/predictions/filter', (req, res) => {
    var filterParams = {};
    var agency = req.body.agency;
    var office = req.body.office;
    var contactInfo = req.body.contactInfo;
    var solNum = req.body.solNum;
    var reviewRec = req.body.reviewRec;
    var eitLikelihood = req.body.eitLikelihood;
    var reviewStatus = req.body.reviewStatus;
    var numDocs = req.body.numDocs;
    var parseStatus = req.body.parsing_report;
   
    if (agency) {
      _.merge(filterParams, {agency: agency});
    }
    if (contactInfo) {
      _.merge(filterParams, {contactInfo: contactInfo});
    }
    if (office) {
      _.merge(filterParams, {office: office});
    }
    if (solNum) {
      _.merge(filterParams, {solNum: solNum});
    }
    if (reviewRec) {
      _.merge(filterParams, {reviewRec: reviewRec});
    }
    if (eitLikelihood) {
      _.merge(filterParams, {eitLikelihood: eitLikelihood});
    }
    if (reviewStatus) {
      _.merge(filterParams, {reviewStatus: reviewStatus});
    }
    if (numDocs) {
      _.merge(filterParams, {numDocs: numDocs});
    }
    if (parseStatus) {
      _.merge(filterParams, {parseStatus: parseStatus});
    }

    
    Prediction.find({'eitLikelihood.value': 'Yes'}).then((predictions) => {
      res.send(predictions);
    }, (e) => {
      res.status(400).send(e);
    });

});

app.post('/predictions', (req, res) => {
    var pred = new Prediction({
        solNum: req.body.solNum,
        title: req.body.title,
        url: req.body.url,
        predictions: req.body.predictions,
        reviewRec: req.body.reviewRec,
        date: req.body.date,
        numDocs: req.body.numDocs,
        eitLikelihood: req.body.eitLikelihood,
        agency: req.body.agency,
        office: req.body.office,
        contactInfo: req.body.contactInfo,
        position: req.body.position,
        reviewStatus: "Incomplete",
        noticeType: req.body.noticeType,
        actionStatus: req.body.actionStatus,
        parseStatus: req.body.parsing_report,
        history: req.body.history,
        feedback: req.body.feedback,
        undetermined: req.body.undetermined
    });

    pred.save().then((doc) => {
        res.send(doc);
    }, (e) => {
        res.status(400).send(e);
    });
});


app.put('/predictions', (req, res) => {

    var now = new Date().toLocaleDateString();

    Prediction.findOne({solNum:req.body.solNum}, function (err, solicitation) {
        

        if (err)
        {
            console.log("error on put prediction");
            res.send(err);    
        }
                  
        
        if (solicitation) 
        {   
            // console.log("find one " + req.body.solNum);
            // console.log("updated: " + req.body.title);
            // Update the solicitation fields with new FBO data  
            var r = solicitation.history.push({'date': req.body.date, 'action': 'Solicitation Updated on FBO.gov', 'user': '', 'status' : 'Solicitation Updated on FBO.gov'});
            req.body.history = solicitation.history;
            req.body.actionStatus = 'Solicitation Updated on FBO.gov';
            req.body.actionDate = req.body.date
            // if(solicitation.solNum == '08012016') console.log('Find it')
            Prediction.update({solNum: req.body.solNum}, req.body).then((doc) => {
                res.send(doc);
            }, (e) => {
                res.status(400).send(e);
            })
        } 
        else 
        {
          
            // console.log("Added: " + req.body.title);
            var history= [];
            var r = history.push({'date': req.body.date, 'action': 'Pending Section 508 Coordinator review', 'user': '', 'status' : 'Pending Section 508 Coordinator Review'});

            var history= [];
            var r = history.push({'date': req.body.date, 'action': 'Pending Section 508 Coordinator review', 'user': '', 'status' : 'Pending Section 508 Coordinator Review'});

            var pred = new Prediction({
                solNum: req.body.solNum,
                title: req.body.title,
                url: req.body.url,
                predictions: req.body.predictions,
                reviewRec: req.body.reviewRec,
                date: req.body.date,
                numDocs: req.body.numDocs,
                eitLikelihood: req.body.eitLikelihood,
                agency: req.body.agency,
                office: req.body.office,
                contactInfo: req.body.contactInfo,
                position: req.body.position,
                reviewStatus: "Incomplete",
                noticeType: req.body.noticeType,
                actionStatus: req.body.actionStatus,
                parseStatus: req.body.parseStatus,
                history: history,
                feedback: req.body.feedback,
                undetermined: req.body.undetermined
            });
            pred.save().then((doc) => {
                res.send(doc);
            }, (e) => {
                res.status(400).send(e);
            });
        }
    })
    //console.log("Added: " + req.body.title);        
});



// Put data into mongoDB
app.put('/agencies', (req, res) => {
    var agency = new Agency ({
        Agency: req.body.Agency,
        Acronym: req.body.Acronym
    })  

    agency.save().then((doc) => {
        res.send(doc);
    }, (e) => {
        res.status(400).send(e);
    });
})

// Get total agencies from MongoDB
app.get('/agencies', (req, res) => {
    Agency.find().then((age) => {
        res.send(age);
    }, (e) => {
        res.status(400).send(e);
    });
});

// Get Total Agencies in the solicitations.
app.get('/AgencyList', (req, res) => {  
    Prediction.find({'eitLikelihood.value': 'Yes'}).then((preds) => { 
        var agencyList = []; 
        var map = new Object();
        for (let item of preds) 
        {
            if (!map.hasOwnProperty(item.agency))
            {
                map[item.agency] = item.agency;
                agencyList.push(item.agency)
            }
        }               
        agencyList.sort();  
        res.send(agencyList);
    }, (e) => {
        res.status(400).send(e);
    });
});

// Put data into mongoDB
app.put('/surveys', (req, res) => {

    Survey.findOne({ID: req.body.ID}, function (err, survey) {
        
        if (err)
            res.send(err)

        if (survey) 
        {             
            survey.update({ID: req.body.ID}, req.body).then((doc) => {
                res.send(doc);
            }, (e) => {
                res.status(400).send(e);
            })
        } 
        else
        {
            var survey = new Survey ({
                ID: req.body.ID,
                Question: req.body.Question,
                Choices: req.body.Choices,
                Section: req.body.Section,
                Type: req.body.Type,
                Answer: req.body.Answer,
                Note: req.body.Note,
                ChoicesNote: req.body.ChoicesNote,
            })  

            survey.save().then((doc) => {
                res.send(doc);
            }, (e) => {
                res.status(400).send(e);
            });
        }

    });    
})

// Get total surveys from MongoDB
app.get('/surveys', (req, res) => {
    Survey.find().then((survey) => {
        res.send(survey);
    }, (e) => {
        res.status(400).send(e);
    });
});



app.listen(port, () => {
    console.log(`Started up at port ${port}`);
});

module.exports = {app};
