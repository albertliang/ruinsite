'use strict';

/*
 * Module dependencies.
 */
let env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
//let env = process.env.NODE_ENV = 'production';
let testemail = 'albert@ruingaming.io';
//let testemail: string = null;

import {MassMessage} from '../controllers/message/mass-message';
import {Message} from '../controllers/message/message';
import {Config, ISiteConfig} from '../config/config';
import {IUser, User} from '../models/user.model';
import {IGamer, Gamer} from '../models/gamer.model';
import * as fs from 'fs';
import * as log4js from 'log4js';
import * as mongoose from 'mongoose';

let moment = require('moment-timezone');

/************ SETTING ENV ************ */
moment.tz.setDefault('UTC'); //default moment-timezone lib to UTC
log4js.configure(Config.logConfig);
let logger = log4js.getLogger();
logger.level = 'info';
logger.info('Email list task starting. Environment set to: ' + env);

/************** Init Mongo/Mongoose **************/
mongoose.connect(Config.db);
mongoose.Promise = require('bluebird');
logger.info('connected to mongo server at: ' + Config.db);

/**************************************
 * Task Runner
 * 
 * call via cmd line:
 node build/server/mailinglist/email-list.js GetAllUserEmails
 node build/server/mailinglist/email-list.js ProcessCommentQueue
 node build/server/mailinglist/email-list.js GetEmailsNoRooms
 node build/server/mailinglist/email-list.js ScheduleAvailResponse
 node build/server/mailinglist/email-list.js EmailAvailResponse
 *************************************/

let taskName = process.argv[2];
let arg = process.argv.length > 3 ? process.argv[3] : null;
let args = process.argv.length > 3 ? process.argv.slice(3) : null;
logger.info('task running: ' + taskName);

function RunTask(taskName: string) {
    switch (taskName) {
        //gets emails for specified query and outputs it to file
        case 'GetAllUserEmails':
            User.find( {$and: [{email: {$ne: null}}, {emailIsVerified: true}]}, 'username email',
                (err: Error, users: IUser[]) => {
                    if (err) {
                        logger.error('Task failed: ' + err.message);
                        logger.error(err.stack);
                    } else {
                        let listUsers: string = '';
                        let counter = 0;
                        users.forEach( u => {
                            if (u.email.length > 0) {
                                listUsers += u.email + ', ' + u.username + '\r\n';
                                counter++;
                            }
                        });
                        fs.writeFileSync('allEmails.txt', listUsers);
                        logger.info('Email count: ' + counter);
                        logger.info('Results output to file: allEmails.txt');
                    }
                    process.exit();
                }
            );
            break;
        //gets emails for specified query and outputs it to file
        case 'GetEmailsNoRooms':
            Gamer.find({rooms: []}, (err: Error, gamers: IGamer[]) => {
                if (!err && gamers) {
                    User.find( {$and: [{_id: {$in: gamers}}, {email: {$ne: null}}]}, 'username email',
                        (err: Error, users: IUser[]) => {
                            if (err) {
                                logger.error('Task failed: ' + err.message);
                                logger.error(err.stack);
                            } else {
                                let listUsers: string = '';
                                let counter = 0;
                                users.forEach( u => {
                                    if (u.email.length > 0) {
                                        listUsers += u.email + ', ' + u.username + '\r\n';
                                        counter++;
                                    }
                                });
                                fs.writeFileSync('noRoomsEmails.txt', listUsers);
                                logger.info('Email count: ' + counter);
                                logger.info('Results output to file: allEmails.txt');
                            }
                            process.exit();
                        }
                    );
                }
            });
            break;
        //email players new comments that have occurred since last job
        case 'ProcessCommentQueue':
            Message._SendNewCommentsEmail().then((err: Error, results: any) => {
                logger.info('ProcessCommentQueue completed');
                process.exit();
            });
            break;
        //once a day, run job to get timeslot for each user's first avail, - 3 hours, round down to hour
        case 'ScheduleAvailResponse':
            {
                let utcDay = args && args[0] ? parseInt(args[0]) : (new Date()).getUTCDay();
                let utcHour = args && args[1] ? parseInt(args[1]) : (new Date()).getUTCHours();

                MassMessage.ScheduleAvailUsers(utcDay, utcHour).then( (results: any) => {
                    logger.info('ScheduleAvailResponse done');
                    logger.info(results);
                    process.exit();
                });
            }
            break;

        //email users to show results of availability
        case 'EmailAvailResponse':
            {
                let targetTime = new Date();
                targetTime.setHours(targetTime.getHours() + 4); //give respondents 4 hours to reply to request emails

                //get current UTC hour or take arg
                let utcDay = args && args[0] ? parseInt(args[0]) : targetTime.getUTCDay();
                let utcHour = args && args[1] ? parseInt(args[1]) : targetTime.getUTCHours();

                MassMessage.SendAvailResponseEmails(utcDay, utcHour, testemail).then( (results: any) => {
                    logger.info('EmailAvailResponse sent');
                    logger.info(results);
                    process.exit();
                });
            }
            break;
        default:
            logger.error('INVALID TASK REQUESTED');
            process.exit(1);
    }
}

RunTask(taskName);

