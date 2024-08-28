'use strict';

import { Config } from '../../config/config';
import { Mailer } from './mailer';
import { IUser, User } from '../../models/user.model';
import { IGamer } from '../../models/gamer.model';
import { IGame } from '../../models/game.model';
import { IRoom } from '../../models/room.model';
import { Org, IOrg } from '../../models/org.model';
import { ICommentQueue, CommentQueue } from '../../models/commentqueue.model';
import { UsersController } from '../users/users.controller';
import { GamesController } from '../admin/games.controller';
import { RoomsController } from '../rooms/rooms.controller';
import { ResultsHandler } from '../results.controller';
import {GenerateRandomToken} from '../../util/util';
import * as log4js from 'log4js';
import * as path from 'path';
let log = log4js.getLogger();
import * as _ from 'lodash';

import * as express from 'express';
import * as async from 'async';
import * as crypto from 'crypto';
import * as moment from 'moment';
let swig = require('swig');
let timezone = require('moment-timezone');
let Promise = require('bluebird');


export namespace Message {

    export function NotifyAdmin(message: string, subject: string, callback: Function = (() => {}) ) {
        Mailer.SendMail(Config.sendGrid.adminEmail, subject, message, callback);
    }

    export function NotifyAdmin_ContactUs(req: express.Request, res: express.Response) {
        let subject = '[RUIn] Message from: ' + req.user.username + '[' + req.user.id + ']';
        let message = req.body.message;

        Mailer.SendMail(Config.sendGrid.adminEmail, subject, message, (err: Error, results: any) => { ResultsHandler(err, results, res); });
    }

    export function NotifyAdmin_NewUser(user: IUser, callback: Function = (() => {})) {
        let subject = `[RUIn] [New SignUp] ${user.username} ${user.email} ${user.timezone}`;
        NotifyAdmin('New user signed up', subject, callback);
    }

    export function SendRoomInviteEmail(req: express.Request, res: express.Response) {
        _SendRoomInviteEmail(req.params.roomId, req.params.occurrenceDate, req.user, req.params.userId, (err: Error, results: any) => { ResultsHandler(err, results, res); });
    }

    // export function SendRoomInviteEmailNonUser(req: express.Request, res: express.Response) {
    //     _SendRoomInviteEmailNonUser(req.params.roomId, req.user, req.body.emailObj, (err: Error, results: any) => { ResultsHandler(err, results, res); });
    // }

    // Sends Email verification
    export function SendVerificationEmail(user: IUser, callback: Function) {
        async.waterfall([
            GenerateRandomToken,
            //Set verification token and expiration on user
            (token: string, next: Function) => {
                User.findOneAndUpdate({_id: user._id}, {$set: {
                    emailVerificationToken: token,
                    emailVerificationExpires: moment().add('1', 'day').toDate(),
                    emailIsVerified: false
                }}, {new: true}, (err: Error, userUpdated: IUser) => {
                    if (err || !userUpdated) {
                        next({message: 'Error_SendVerificationEmail'});
                    }
                    else next(null, userUpdated);
                });
            },
            //send email
            (user: IUser, next: Function) => {
                let subject = '[RUIn] Please verify your email';
                let template = swig.compileFile(path.join(__dirname, './templates/email-verification-email.html'));
                let emailHTML = template({
                    appName: Config.app.title,
                    username: user.username,
                    url: Config.app.realm + '/#/verify/' + user.emailVerificationToken
                });
                Mailer.SendMail(user.email, subject, emailHTML, next);
            }
        ], (err: Error, results: any) => {
            callback(err, results);
        });

    }

    // Sends MagicLink email
    export function SendLoginLinkEmail(email: string, callback: Function) {
        async.waterfall([
            GenerateRandomToken,
            //Set verification token and expiration on user
            (token: string, next: Function) => {
                User.findOneAndUpdate({email: email}, {$set: {
                    emailVerificationToken: token,
                    emailVerificationExpires: moment().add('1', 'day').toDate()
                }}, {new: true}, (err: Error, userUpdated: IUser) => {
                    if (err || !userUpdated) {
                        next({message: 'Error_SendVerificationEmail'});
                    }
                    else next(null, userUpdated);
                });
            },
            //send email
            (user: IUser, next: Function) => {
                let subject = '[RUIn] Requested link to login';
                let template = swig.compileFile(path.join(__dirname, './templates/login-link-email.html'));
                let emailHTML = template({
                    appName: Config.app.title,
                    username: user.username,
                    url: Config.app.realm + '/#/verify/' + user.emailVerificationToken
                });
                Mailer.SendMail(user.email, subject, emailHTML, next);
            }
        ], (err: Error, results: any) => {
            callback(err, results);
        });

    }

    // Email after user has signed up
    export function SendOnboardingEmail(user: IUser, done: Function) {
        Mailer.SendMailTemplate(user.email, Config.sendGrid.templates.onboarding, done);
    }

    // Request to join the group to admin
    export function SendJoinOrgRequest(req: express.Request, res: express.Response) {
        let orgId: string = req.params.orgId;
        let userId: string = req.user._id;

        _SendJoinOrgRequest(orgId, userId, (err: Error, result: any) => {
            ResultsHandler(err, result, res);
        });
    }

    export function _SendJoinOrgRequest(orgId: string, userId: string, callback: Function) {

        UsersController._Read(userId, (err: Error, reqUser: IUser) => {
            if (err) { callback(err); }

            Org.findOne({ _id: orgId }, (err: Error, org: IOrg) => {
                if (err) { callback(err); }

                let adminsIds = org.admins || [];

                UsersController._ReadMany(adminsIds, (err: Error, admins: IUser[]) => {
                    if (err) { callback(err); }

                    if (reqUser.orgsRequests && reqUser.orgsRequests.length !== 0) {
                        for (let key in reqUser.orgsRequests) {
                            if (reqUser.orgsRequests[key].orgId === orgId) {
                                callback(null, null);
                                return;
                            }
                        }
                    }

                    crypto.randomBytes(20, function (err: Error, buffer: Buffer) {
                        let token = buffer.toString('hex');

                        let template = swig.compileFile(path.join(__dirname, './templates/org-request-email.html'));

                        let emailHTML = template({
                            username: reqUser.username,
                            groupname: org.name,
                            accepturl: Config.app.realm + `/#/accept/${token}/${userId}/${orgId}`,
                            appName: Config.app.title
                        });

                        reqUser.orgsRequests = reqUser.orgsRequests ? reqUser.orgsRequests : [];

                        reqUser.orgsRequests.push({
                            orgId: orgId,
                            token: token
                        });

                        UsersController._Update(reqUser, (err: Error, user: IUser) => {
                            let subject = '[RUIn] ' + user.username + ' wants to join your group';
                            for (let key in admins) {
                                Mailer.SendMail(admins[key].email, subject, emailHTML, (err: Error, results: string) => {
                                });
                            }
                            callback(null, true);
                        });
                    });
                });
            });
        });
    }

    // Invite user to join the room
    export function _JoinOrgEmail(org: IOrg, username: string, callback: Function) {
        User.find({_id: {$in: org.admins}}, (err: Error, admins: IUser[]) => {

            let subject = '[RUIn] New member: ' + username + ' has joined your Network: ' + org.name + '';
            let template = swig.compileFile(__dirname + '/templates/org-new-member.html');

            admins.forEach( admin => {
                let emailHTML = template({
                    adminName: admin.username,
                    groupname: org.name,
                    username: username,
                    appName: Config.app.title
                });

                Mailer.SendMail(admin.email, subject, emailHTML, (err: Error, results: string) => {
                    if (err) {
                        log.error('Error_neworgmember_sendmail', err);
                        return callback(err, { message: 'Error sending org join emails for: ' + org.name });
                    } else {
                        callback(null, { message: 'Confirmation sent to admins for: ' + org.name });
                    }
                });
            });
        });
    }

    // Process the CommentQueue collection and send out emails
    export function _SendNewCommentsEmail() {
        let templateRoom = swig.compileFile(__dirname + '/templates/room-newcomments-email.html');
        let templateGroup = swig.compileFile(__dirname + '/templates/org-newcomments-email.html');

        return new Promise((resolveTop: any, rejectTop: any) => {

            //get all queue items
            CommentQueue.find({}).exec()
            .then((comments: ICommentQueue[]) => {
                return Promise.each(comments, (comment: ICommentQueue) => {

                    return new Promise( (resolve: any, reject: any) => {
                        //find all player emails to contact
                        let userIds = _.map(comment.players, (p: any) => { return p.gamer; });
                        
                        let subject: string;
                        let roomLink: string;
                        let groupLink: string;
                        let roomLinkImg: string;
                        
                        if (comment.isRoomComment) {
                            subject = '[RUIn] ' + comment.comments.length + ' New Comments from your room: [' + comment.id + ']';
                            roomLink = Config.app.realm + `/#/rooms/` + comment.id;
                            roomLinkImg = 'http://' + Config.amazonAWS.cloudFrontDomain + '/' + comment.hostUsername + '/' + comment.id + '.jpg';
                        }
                        else {
                            subject = '[RUIn] ' + comment.comments.length + ' New Comments from your group: [' + comment.groupName + ']';
                            groupLink = Config.app.realm + `/#/groups/` + comment.id;
                        }

                        User.find({_id: {$in: userIds}}, 'email timezone emailIsVerified').exec()
                            .then( (users: IUser[]) => {

                                return Promise.each(users, (user: IUser) => {
                                    return new Promise( (resolve2: any, reject2: any) => {

                                        if (!user.emailIsVerified) {
                                            //invalid email? skip it
                                            resolve2();
                                        } else {
                                            let commentsText = '';
                                            comment.comments.forEach((c) => {
                                                commentsText +=
                                                `<b>` + c.username + `</b> ` + timezone(c.ts).tz(user.timezone).format('@h:mma') + ' ' + timezone().tz(user.timezone).zoneAbbr() + `
                                                <p>` + c.comment + `</p>`;
                                                });
                                            let emailHTML = !!comment.isRoomComment ? 
                                                templateRoom({
                                                    comments: () => { return commentsText; },
                                                    roomLink: roomLink,
                                                    roomLinkImg: roomLinkImg,
                                                    domainapi: (<any>Config.app).api || Config.app.realm,
                                                    domain: Config.app.realm,
                                                    appName: Config.app.title
                                                }) 
                                                :
                                                templateGroup({
                                                    comments: () => { return commentsText; },
                                                    groupLink: groupLink,
                                                    domainapi: (<any>Config.app).api || Config.app.realm,
                                                    domain: Config.app.realm,
                                                    appName: Config.app.title
                                                });

                                            Mailer.SendMail(user.email, subject, emailHTML, (err: Error, results: string) => {
                                                if (err) {
                                                    log.error('Error_newcomments_sendmail', err);
                                                    reject2({ message: 'Error sending new comments emails for room: ' + comment.id + ', email: ' + user.email});
                                                } else {
                                                    log.info('Email comment sent');
                                                    resolve2();
                                                }
                                            });
                                        }
                                    });
                                });
                            })
                            .then( () => {
                                resolve();
                            });
                    }).then( () => {
                        //queue item processed, remove it
                        return comment.remove();
                    }).catch((err: Error) => {
                        //queue item not processed?, remove it anyway otherwise it'll clog up the queue
                        return comment.remove();
                    });
                });
            })
            .then(resolveTop);
        });
    }

    // Invite other users to join the room, will determine
    // roomId, userIdFrom, userIdTo
    export function _SendRoomInviteEmail(roomId: string, occurrenceDate: string, userFrom: IUser, userIdTo: string, callback: Function) {

        async.parallel({
            // lookup room info
            room: (cb: any) => {
                RoomsController._Read(roomId, (roomErr: Error, roomResult: IRoom) => {
                    cb(roomErr, roomResult);
                });
            },
            // lookup recipient info
            recipient: (cb: any) => {
                UsersController._Read(userIdTo, (userErr: Error, userResult: IRoom) => {
                    cb(userErr, userResult);
                });
            }
        }, (err: Error, results: any) => {
            let roomUrl = Config.app.realm + '/#/rooms/' + roomId;
            let room: IRoom = results.room;
            let roomLink = Config.app.realm + `/#/rooms/` + roomId;

            //if room is a series, need to find the series occurrence if it exists
            if (room && room.isRepeat) {
                let targetDate = moment(occurrenceDate, 'MMDDYY');
                room.startTime = moment(room.startTime).set('month', targetDate.month()).set('date', targetDate.date()).toDate();
                roomLink = Config.app.realm + `/#/rooms/` + roomId + '/series/' + occurrenceDate;
            }

            let game: IGame = results.room.game;
            let recipient: IUser = results.recipient;
            let startTime = timezone(room.startTime).tz(recipient.timezone).format('MMM D @ h:mma') + ' ' + timezone().tz(recipient.timezone).zoneAbbr();
            let subject = '[RUIn] [' + room.hostUsername + '] ' + game.name + ' at ' + startTime;
            let roomLinkImg = 'http://' + Config.amazonAWS.cloudFrontDomain + '/' + room.hostUsername + '/' + room.id + '.jpg';

            let template = swig.compileFile(__dirname + '/templates/room-invite-email.html');
            let emailHTML = template({
                inviteFrom: userFrom.username,
                startTime: startTime,
                gameName: game.name,
                gameIcon: game.iconLg,
                roomLink: roomLink,
                roomLinkImg: roomLinkImg,
                domainapi: (<any>Config.app).api || Config.app.realm,
                domain: Config.app.realm,
                username: recipient.username,
                appName: Config.app.title
            });

            Mailer.SendMail(recipient.email, subject, emailHTML, (err: Error, results: string) => {
                if (err) {
                    log.error('Error_roominvite_sendmail', err);
                    return callback(err, { message: 'Error sending room invite to user: ' + recipient.username });
                } else {
                    callback(null, { message: 'Invite sent to: ' + recipient.username });
                }
            });
        });
    }

    // Invite non-users to join the room via email address
    // export function _SendRoomInviteEmailNonUser(roomId: string, userFrom: IUser, emailObj: any, callback: Function) {

    //     RoomsController._Read(roomId, (roomErr: Error, room: IRoom) => {
    //         let roomUrl = Config.app.realm + '/#/rooms/' + roomId;
    //         let game: IGame = <any>room.game;
    //         let startTime = timezone(room.startTime).tz(userFrom.timezone).format('MMM D @ h:mma') + ' ' + timezone().tz(userFrom.timezone).zoneAbbr();
    //         let subject = '[RUIn] Join ' + userFrom.username + ' for ' + game.name + ' on ' + startTime;
    //         let roomLink = Config.app.realm + `/#/rooms/` + roomId;
    //         let roomLinkImg = 'http://' + Config.amazonAWS.cloudFrontDomain + '/' + room.hostUsername + '/' + room.id + '.jpg';

    //         let template = swig.compileFile(__dirname + '/templates/room-invite-email-nonuser.html');
    //         let emailHTML = template({
    //             inviteFrom: userFrom.username,
    //             startTime: startTime,
    //             gameName: game.name,
    //             gameIcon: game.iconLg,
    //             roomLink: roomLink,
    //             roomLinkImg: roomLinkImg,
    //             userMessage: emailObj.message,
    //             appName: Config.app.title
    //         });

    //         Mailer.SendMailMultiple(emailObj.email, subject, emailHTML, (err: any, results: string) => {
    //             if (err.length) {
    //                 log.error('Error_roominvite_nonuser_sendmail');
    //                 return callback(err, { message: 'Error sending room invites to ' + err.join(', ') });
    //             } else {
    //                 callback(null, { message: 'Invite sent' });
    //             }
    //         });
    //     });
    // }

    // Invite user to join the room
    export function _JoinRoomEmail(roomId: string, user: IUser, callback: Function) {
        RoomsController._Read(roomId, (roomErr: Error, room: IRoom) => {
            let roomUrl = Config.app.realm + '/#/rooms/' + roomId;
            let game: IGame = <any>room.game;
            let startTime = timezone(room.startTime).tz(user.timezone).format('MMM D @ h:mma') + ' ' + timezone().tz(user.timezone).zoneAbbr();
            let subject = '[RUIn] Confirmation for [' + room.hostUsername + '] ' + game.name + ' at ' + startTime;

            let template = swig.compileFile(__dirname + '/templates/room-joined-user-email.html');
            let emailHTML = template({
                hostName: room.hostUsername,
                startTime: startTime,
                gameName: game.name,
                gameIcon: game.iconLg,
                roomLink: Config.app.realm + '/#/rooms/' + roomId,
                username: user.username,
                appName: Config.app.title
            });

            Mailer.SendMail(user.email, subject, emailHTML, (err: Error, results: string) => {
                if (err) {
                    log.error('Error_joinroom_sendmail', err);
                    return callback(err, { message: 'Error sending room join confirm to user: ' + user.username });
                } else {
                    callback(null, { message: 'Confirmation sent to: ' + user.username });
                }
            });
        });
    }

    // New user via signup quick has joined the room
    export function _JoinRoomNewUserEmail(roomId: string, user: IUser, password: string, callback: Function) {
        RoomsController._Read(roomId, (roomErr: Error, room: IRoom) => {
            let roomUrl = Config.app.realm + '/#/rooms/' + roomId;
            let game: IGame = <any>room.game;
            let startTime = timezone(room.startTime).tz(user.timezone).format('MMM D @ h:mma') + ' ' + timezone().tz(user.timezone).zoneAbbr();
            let subject = 'Confirmation for [' + room.hostUsername + '] ' + game.name + ' at ' + startTime;

            let template = swig.compileFile(__dirname + '/templates/room-joined-nonuser-email.html');
            let emailHTML = template({
                hostName: room.hostUsername,
                startTime: startTime,
                gameName: game.name,
                gameIcon: game.iconLg,
                roomLink: Config.app.realm + '/#/rooms/' + roomId,
                username: user.username,
                password: password,
                appName: Config.app.title
            });

            Mailer.SendMail(user.email, subject, emailHTML, (err: Error, results: string) => {
                if (err) {
                    log.error('Error_joinroom_sendmail', err);
                    return callback(err, { message: 'Error sending room join confirm to user: ' + user.username });
                } else {
                    callback(null, { message: 'Confirmation sent to: ' + user.username });
                }
            });
        });
    }

    // Host or User has joined the room
    export function _JoinRoomHostEmail(roomId: string, newGamer: IUser, host: IUser, callback: Function) {
        RoomsController._Read(roomId, (roomErr: Error, room: IRoom) => {
            let roomUrl = Config.app.realm + '/#/rooms/' + roomId;
            let game: IGame = <any>room.game;
            let isHost = host._id.equals(newGamer._id);
            let subject = isHost ? `[RUIn] You've scheduled a game of ` + game.name : '[RUIn] ' + newGamer.username + ' has joined your game of ' + game.name;
            let fileName = isHost ? '/templates/room-joined-as-host-email.html' : '/templates/room-joined-host-email.html';
            let startTime = timezone(room.startTime).tz(newGamer.timezone).format('MMM D @ h:mma') + ' ' + timezone().tz(newGamer.timezone).zoneAbbr();

            let template = swig.compileFile(__dirname + fileName);

            let emailHTML = template({
                hostName: room.hostUsername,
                startTime: startTime,
                gameName: game.name,
                gameIcon: game.iconLg,
                roomLink: Config.app.realm + '/#/rooms/' + roomId,
                newGamer: newGamer.username,
                appName: Config.app.title
            });

            Mailer.SendMail(host.email, subject, emailHTML, (err: Error, results: string) => {
                if (err) {
                    log.error('Error_joinroom_sendmail', err);
                    return callback(err, { message: 'Error sending room join message to host: ' + room.hostUsername });
                } else {
                    callback(null, { message: 'Message sent to: ' + room.hostUsername });
                }
            });
        });
    }

    // Email to host that a user has left their room
    export function _LeaveRoomHostEmail(roomId: string, gamer: IGamer, host: IUser, callback: Function) {
        RoomsController._Read(roomId, (roomErr: Error, room: IRoom) => {
            let roomUrl = Config.app.realm + '/#/rooms/' + roomId;
            let game: IGame = <any>room.game;
            let subject = '[RUIn] ' + gamer.username + ' has left your game of ' + game.name;
            let startTime = timezone(room.startTime).tz(room.hostTimezone).format('MMM D @ h:mma') + ' ' + timezone().tz(room.hostTimezone).zoneAbbr();

            let template = swig.compileFile(__dirname + '/templates/room-leave-host-email.html');
            let emailHTML = template({
                hostName: room.hostUsername,
                startTime: startTime,
                gameName: game.name,
                gameIcon: game.iconLg,
                roomLink: Config.app.realm + '/#/rooms/' + roomId,
                gamer: gamer.username,
                appName: Config.app.title
            });

            Mailer.SendMail(host.email, subject, emailHTML, (err: Error, results: string) => {
                if (err) {
                    log.error('Error_leaveroom_sendmail', err);
                    return callback(err, { message: 'Error sending room left message to host: ' + room.hostUsername });
                } else {
                    callback(null, { message: 'Message sent to: ' + room.hostUsername });
                }
            });
        });
    }

    // User wants to add a non-existent game to the master list
    export function _AddCustomGameEmail(user: IUser, game: IGame, callback: Function) {

        let subject = '[RUIn] [New Game Request] for ' + game.name + ' by ' + user.username;

        let template = swig.compileFile(__dirname + '/templates/custom-game-request-email.html');
        let emailHTML = template({
            gameId: game.id,
            gameName: game.name,
            platformId: game.platformId,
            userId: user.id,
            username: user.username,
            userEmail: user.email
        });

        Mailer.SendMail(Config.sendGrid.adminEmail, subject, emailHTML, (err: Error, results: string) => {
            if (err) {
                log.error('Error_newgame_sendmail', err);
                return callback(err, { message: 'Error sending new game request to ' + Config.sendGrid.adminEmail });
            } else {
                callback(null, { message: 'Confirmation sent to: ' + Config.sendGrid.adminEmail });
            }
        });
    }

    // User wants to reset password
    export function _ForgotPasswordEmail(user: IUser, token: string, callback: Function) {
        let template = swig.compileFile(__dirname + '/templates/reset-password-email.html');
        let emailHTML = template({
            name: user.username,
            appName: Config.app.title,
            url: Config.app.realm + '/#/reset/' + token
        });

        Mailer.SendMail(user.email, 'Password Reset for RUIn', emailHTML, (err: Error, results: string) => {
            if (err) {
                log.error('Error_passwordresetrequest_sendmail', err);
                return callback(err, { message: 'Error occurred sending the forgot password email.' });
            } else {
                callback(null, { message: 'Email sent to: ' + user.email });
            }
        });
    }

    // Notify user their password has changed
    export function _ResetPasswordEmail(user: IUser, callback: Function) {
        let template = swig.compileFile(__dirname + '/templates/reset-password-confirm-email.html');
        let emailHTML = template({
            name: user.username,
            appName: Config.app.title
        });

        Mailer.SendMail(user.email, 'Your password has been changed', emailHTML, (err: Error, results: string) => {
            if (err) {
                log.error('Error_passwordresetconfirm_sendmail', err);
                return callback(err, { message: 'Error occurred sending the password reset email.' });
            } else {
                callback(null, { message: 'Email sent to: ' + user.email });
            }
        });

    }
}
