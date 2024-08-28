'use strict';

/*
 * Module dependencies.
 */
import express = require('express');
import bodyparser = require('body-parser');
import {Config, ISiteConfig} from './config/config';
import * as log4js from 'log4js';
import * as mongoose from 'mongoose';
import * as passport from 'passport';

let mongofactory = require('./mongo-factory');
let moment = require('moment-timezone');
let path = require('path');

require('./models/');

/************ SETTING ENV ************ */
let env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
moment.tz.setDefault('UTC'); //default moment-timezone lib to UTC

log4js.configure(Config.logConfig);
//log4js.addAppender(log4js.appenders.console());
let logger = log4js.getLogger();
//logger.level =Config.logLevel ;
logger.info('server starting. Environment set to: ' + env);

/************** Init Mongo/Mongoose **************/
mongoose.connect(Config.db); //, { useMongoClient: true });
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
mongoose.Promise = require('bluebird');
logger.info('connected to mongo server at: ' + Config.db);

/************** Load Express **************/
let app = express();

// express middleware

app.use(bodyparser.json());
//app.use(cookieParser());

// development error handler
// will print stacktrace
if (env === 'development' || env === 'test') {
    app.use(function(err: any, req: express.Request, res: express.Response, next: any) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}
// production error handler
// no stacktraces leaked to user
else {
    app.use(function(err: any, req: express.Request, res: express.Response, next: any) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });
}

// Express/Mongo session storage
// app.use(expressSession({
//  secret: config.sessionSecret,
//  store: new mongoStore({
//    mongooseConnection: mongoose.connection
//    //collection: config.sessionCollection
//  })
// }));

// Bootstrap passport config
require('./config/passport')();

// use passport session
app.use(passport.initialize());
app.use(passport.session());

//app.use(express.static(path.join(__dirname, Config.public_folder)));
app.use(express.static(Config.public_folder));

//create express routes
require('./routes')(app);

// Start the app by listening on <port>
let port = process.env.PORT || Config.port;
app.listen(port);
logger.info('listening on port: ', port);

// Expose app
exports = module.exports = app;