'use strict';

/*
 * Module dependencies.
 */
let env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import {Config, ISiteConfig} from './config/config';
import {GamesController} from './controllers/admin/games.controller';
import {Gamer, IGamer} from './models/gamer.model';
 import {IGDBImportAPI} from './controllers/platforms/igdb.import';
import * as log4js from 'log4js';
import * as mongoose from 'mongoose';
let async = require('async');
let moment = require('moment-timezone');

/************ SETTING ENV ************ */
moment.tz.setDefault('UTC'); //default moment-timezone lib to UTC
log4js.configure(Config.logConfig);
let logger = log4js.getLogger();
logger.level = 'info';
logger.info('scheduled jobs task starting. Environment set to: ' + env);

/************** Init Mongo/Mongoose **************/
mongoose.connect(Config.db);
logger.info('connected to mongo server at: ' + Config.db);

/**************************************
 * Task Runner
 *
 * call via cmd line:
 * node build/server/scheduledjobs.js SyncUserGames
 * node build/server/scheduledjobs.js SyncGamesLibrary
 * node build/server/scheduledjobs.js SyncIGDBGamesLibrary
 *
 * for heroku:
 * heroku run --app ruingaming node build/server/scheduledjobs.js SyncGamesLibrary
 * or
 * heroku run --app ruingaming worker SyncGamesLibrary
 *************************************/

let taskName = process.argv[2];
logger.info('task running: ' + taskName);

function RunTask(taskName: string) {
    switch (taskName) {

        case 'SyncIGDBGamesLibrary':
        //get all games from IGDB master list
            IGDBImportAPI.SyncGamesList().then(
                (results: any[]) => {
                    logger.info('Task completed: ' + JSON.stringify(results, null, 3));
                    logger.info('games added: ' + results.length);
                    process.exit();
                }
            );
            break;

        case 'SyncIGDBSingleGame':

            let gameName = process.argv[3];

            //get game matching from IGDB master list
            IGDBImportAPI.SyncSingleGame(gameName);
            break;

        default:
            logger.error('INVALID TASK REQUESTED');
            process.exit(1);
    }
}

RunTask(taskName);

