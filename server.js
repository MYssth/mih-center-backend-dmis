const dboperations = require('./dboperations');

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
const { request, response } = require('express');
var app = express();
var router = express.Router();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
    origin: '*'
}));
app.use('/api/dmis', router);

router.use((request, response, next) => {
    //write authen here

    response.setHeader('Access-Control-Allow-Origin', '*'); //หรือใส่แค่เฉพาะ domain ที่ต้องการได้
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Credentials', true);

    console.log('middleware');
    next();
});

router.route('/addtask').post((request, response) => {

    let task = { ...request.body };
    dboperations.addTask(task).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/gettasklist/:personnel_id/:level_id').get((request, response) => {

    dboperations.getTaskList(request.params.personnel_id, request.params.level_id).then(result => {
        response.json(result[0]);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/gettask/:task_id/:level_id').get((request, response) => {

    dboperations.getTask(request.params.task_id, request.params.level_id).then(result => {
        response.json(result[0]);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/accepttask').post((request, response) => {

    let task = { ...request.body };
    dboperations.acceptTask(task).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/completetask').post((request, response) => {

    let task = { ...request.body };
    dboperations.completeTask(task).then(result => {
        response.status(201).json(result);
    }).catch(err => {
        console.error(err);
        response.sendStatus(500);
    });

});

router.route('/getoperator/:level_id').get((request, response) => {

    dboperations.getOperator(request.params.level_id).then(result => {
        response.json(result[0]);
    }).catch(err => {
        console.error(err);
        response.setStatus(500);
    });
    
});

var port = process.env.PORT;
app.listen(port);
console.log('DMIS API is running at ' + port);