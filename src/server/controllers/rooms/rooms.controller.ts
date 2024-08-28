'use strict';

import {IRoom, IComment, IPlayer, Room} from '../../models/room.model';
import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame} from '../../models/game.model';
import {IOrg, Org} from '../../models/org.model';
import {ICommentQueue, CommentQueue} from '../../models/commentqueue.model';
import {OrgsController} from '../orgs/orgs.controller';
import {GamersController} from '../gamers/gamers.controller';
import {PlatformApi} from '../platforms/platform.api';
import {Message} from '../message/message';
import * as util from '../../util/util';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';
import * as moment from 'moment';
import * as path from 'path';
import * as AWSUtil from '../../util/aws';
import * as log4js from 'log4js';
import {Config} from '../../config/config';
import * as _ from 'lodash';

let timezone = require('moment-timezone');
let async = require('async');
let fs = require('fs');
let swig = require('swig');
let phantomrs = require('phantom-render-stream');
let Stream = require('stream');
let streamBuffers = require('stream-buffers');
let logger = log4js.getLogger();

export namespace RoomsController {

    /* exposed CRUD members */
    export function Create(req: express.Request, res: express.Response) {
        _Create(req.body, req.user, (err: Error, room: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function CreateFromLink(req: express.Request, res: express.Response) {
        let body: any = {
            host: req.user,
            game: req.params.gameId,
            startTime: moment().startOf('day').add(req.params.startTimeInc15 * 15, 'minutes').toDate(),
            startTimeInc30: Math.floor(req.params.startTimeInc15 / 2),
            gameMode: 'Automatch',
            players: [req.user],
            duration: 90,
            privacyLevel: 4,
            maxPlayers: 4
        };
        _Create(req.body, req.user, (err: Error, room: IRoom) => {
            res.redirect(Config.app.realm + '/#/rooms/' + room.id);
        });
    }

    export function Read(req: express.Request, res: express.Response) {
        _Read(req.params.roomId, (err: Error, room: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function ReadSeries(req: express.Request, res: express.Response) {
        let roomId = new mongoose.Types.ObjectId(req.params.roomId);
        let occurrenceDate = req.params.occurrenceDate;

        _ReadSeries(roomId, occurrenceDate, (err: Error, room: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function Update(req: express.Request, res: express.Response) {
        let room: IRoom = req.body;
        _Update(room, req.user, (err: Error, roomSaved: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function JoinRoom(req: express.Request, res: express.Response) {
        _JoinRoom(req.params.roomId, req.params.occurrenceDate, req.user, true, (err: Error, room: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function LeaveRoom(req: express.Request, res: express.Response) {
        _LeaveRoom(req.params.roomId, req.user._id, (err: Error, room: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function AddComment(req: express.Request, res: express.Response) {
        _AddComment(req.params.roomId, req.params.occurrenceDate, req.user, req.body.comment, (err: Error, room: IRoom) => { ResultsHandler(err, room, res); });
    }

    export function Delete(req: express.Request, res: express.Response) {
        let roomId = req.params.roomId;
        _Delete(roomId, req.user._id, (err: Error) => { ResultsHandler(err, null, res); });
    }

    // export function CreateRoomImage(req: express.Request, res: express.Response, next: Function) {

    //     AWSUtil.UploadFile(req.body.host, req.params.roomId, req.body.image, (err: Error) => {
    //         ResultsHandler(err, null, res)
    //     });

    // }

    /**
     * Only Room host is authorized
     * */
    export function IsAuthorized() {
        return function(req: express.Request, res: express.Response, next: () => express.Response) {
            let roomId: string = req.params.roomId;
            Room.findById(roomId, (err: Error, room: IRoom) => {
                if (room.host && room.host.equals(req.user._id)) {
                    return next();
                } else {
                    return res.status(403).send({
                        message: 'user_not_authorized'
                    });
                }
            });
        };
    }

    /* inner CRUD members */

    /**
     * Create the room
     * - then add user as host
     * - if org was specified, add the room to the org
     * - have the user join the room as a player and add the room to the gamer
     */
    export function _Create(room: IRoom, user: IUser, callback: any) {
        room.host = user._id;
        room.hostUsername = user.username;
        room.hostTimezone = user.timezone;

        room.startTime = timezone(room.startTime).tz('UTC').toDate();
        room.startTimeInc30 = util.CalcTimeInc30(new Date(room.startTime.toString()));
        _UpdateRepeatConfig(room, user);

        Room.create(room, (err: Error, newRoom: IRoom) => {
            if (err) {
                callback(err);
            } else {
                async.parallel({
                    //if org was added, add the room to org
                    orgRoom: (cb: Function) => {
                        if (newRoom.org) {
                            OrgsController._AddRoom(newRoom.org, newRoom._id, (orgErr: Error, orgResult: IOrg) => {
                                cb(orgErr, orgResult);
                            });
                        } else {
                            cb(null, newRoom);
                        }
                    },
                    //add the room to the gamer and player to the room
                    joinRoom: (cb: any) => {
                        _JoinRoom(newRoom.id, null, user, true, (roomErr: Error, roomResult: IRoom) => {
                            cb(roomErr, roomResult);
                        });
                     },
                }, (err: Error, results: any) => {
                    if (err) return callback(err);

                    //fire and forget image generation
                    _GenerateRoomImageById(newRoom.id, (err: Error) => {});
                    //message admin
                    if (Config.emailIfNewRoom) {
                        Message.NotifyAdmin(JSON.stringify(newRoom), 'new room created by: ' + newRoom.hostUsername);
                    }

                    return callback(err, results.joinRoom);
                });
            }
        });
    }

    export function _Read(roomId: string, callback: any) {
        Room.findById(roomId)
            .populate('game')
            .populate('org', 'name')
            .populate('host')
            .exec(callback);
    }

    /**
     * Get the series occurrence at specified date
     * If no date provided, find the next upcoming instance/startTime
     *  If occurrence exists, return that
     *  If not, return series with upcoming startTime
     * TODO: what happens if this is the last occurrence? then go with latest valid occurrence
     */
    export function _ReadSeries(roomId: mongoose.Types.ObjectId, occurrenceDate: string, callback: any) {
        let dateFilter: Date;

        // Get the series occurrence at specified date
        if (occurrenceDate) {
            dateFilter = moment(occurrenceDate, 'MMDDYY').toDate();
            Room.findOne({'repeatParentId': roomId, 'startTime': {'$gte': dateFilter, '$lte': moment(dateFilter).add(1, 'day').toDate() }})
                .populate('game')
                .populate('org', 'name')
                .populate('host')
                .exec((err: Error, room: IRoom) => {
                    if (room) {
                        return callback(err, room);
                    } else {
                        //if no room found, get the parent room and adjust for given occurrenceDate
                        Room.findOne({'_id': roomId, 'isRepeat': true})
                            .populate('game')
                            .populate('org', 'name')
                            .populate('host')
                            .exec( (err: Error, roomSeries: IRoom) => {
                                let oldStartTime = moment(roomSeries.startTime).utc();
                                roomSeries.startTime = moment(dateFilter).hours(oldStartTime.hours()).minutes(oldStartTime.minutes()).seconds(0).milliseconds(0).toDate();
                                return callback(null, roomSeries);
                            });

                    }
                });
        // If no date provided, find the next upcoming instance/startTime
        } else {
            Room.findOne({'_id': roomId, 'isRepeat': true})
                .populate('game')
                .populate('org', 'name')
                .populate('host')
                .exec( (err: Error, roomSeries: IRoom) => {
                    if (err) { return callback(err); }

                    // find the room instance for the next occurrence date (if it exists)
                    let nextOccurrence: Date = FindNextSeriesOccurrence(roomSeries);

                    Room.findOne({'repeatParentId': roomId, 'startTime': {'$gte': nextOccurrence, '$lte': moment(nextOccurrence).add(1, 'day').toDate() }})
                        .populate('game')
                        .populate('org', 'name')
                        .populate('host')
                        .exec((err: Error, room: IRoom) => {
                            if (room) {
                                // if there's an instance on the next occurrence date
                                return callback(err, room);
                            } else {
                                // didn't find an occurrence, return series instead
                                let oldStartTime = moment(roomSeries.startTime).utc();
                                roomSeries.startTime = moment(nextOccurrence).hours(oldStartTime.hours()).minutes(oldStartTime.minutes()).seconds(0).milliseconds(0).toDate();
                                return callback(null, roomSeries);
                            }
                        });
                });
        }
    }

    // find the next series occurrence date
    export function FindNextSeriesOccurrence(room: IRoom) {
        let currentDay = new Date().getUTCDay();
        let smallestOccursOn: number = 8;
        let largestOccursOn: number = -8;
        let smallestPrev: number = -8;
        let smallestNext: number = 8;
        let nextOccurrence: Date;
        let prevOccurrence: Date;
        let occursOnDays = _.clone(room.repeatConfig.occursOnDays);

        occursOnDays.push(Math.min.apply(null, occursOnDays) + 7); //next occurrence in the next week
        occursOnDays.push(Math.max.apply(null, occursOnDays) - 7); //prev occurrence in the prev week

        occursOnDays.forEach( dayOfWeek => {
            let diff = moment().utc().day(dayOfWeek).diff(moment().utc().day(currentDay), 'days');
            if (diff <= 0 && diff > smallestPrev) {
                smallestPrev = diff;
                prevOccurrence = moment().utc().day(dayOfWeek).toDate();
            } else if (diff >= 0 && diff < smallestNext) {
                smallestNext = diff;
                nextOccurrence = moment().utc().day(dayOfWeek).toDate();
            }
        });

        //if prev occurrence was yesterday and the next is more than a day away, show the prev
        if (smallestPrev === -1 && smallestNext > 1) {
            nextOccurrence = prevOccurrence;
        }
        return nextOccurrence;
    }

    export function _Update(room: IRoom, user: IUser, callback: any) {
        //only host can update room
        Room.findOne({_id: room._id}, (err: Error, oldRoom: IRoom) => {
            if (err) {
                return callback(err);
            } else {
                if (!user._id.equals(room.host)) {
                    let unauthErr: any = new Error('user_not_authorized');
                    unauthErr.status = 403;
                    return callback(unauthErr);
                } else {
                    room.startTimeInc30 = util.CalcTimeInc30(new Date(room.startTime.toString()));
                    _UpdateRepeatConfig(room, user);

                    Room.findOneAndUpdate( { _id: room._id }, room, {new: true}, (err: Error, newRoom: IRoom) => {
                        if (err) return callback(err);

                        async.waterfall([
                            function(next: Function) {
                                //if org was added, add the room to org
                                if (!oldRoom.org && newRoom.org) {
                                    OrgsController._AddRoom(newRoom.org, newRoom._id, next);
                                }
                                //if org was removed, remove the room from the org
                                else if (oldRoom.org && !newRoom.org) {
                                    OrgsController._RemoveRoom(oldRoom.org, newRoom._id, next);
                                }
                                //if org was updated to new org, remove the room from the old org and add to new org
                                else if (oldRoom.org && newRoom.org && !oldRoom.org.equals(newRoom.org)) {
                                    OrgsController._RemoveRoom(oldRoom.org, newRoom._id, (orgErr: Error, orgResult: IOrg) => {
                                        OrgsController._AddRoom(newRoom.org, newRoom._id, next);
                                    });
                                } else {
                                    next();
                                }
                            }
                        ],
                        (err: Error, results: any) => {
                            //fire and forget image generation
                            _GenerateRoomImageById(newRoom.id, (err: Error) => {});
                            callback(err, newRoom);
                        });
                    });
                }
            }
        });
    }

    function _UpdateRepeatConfig(room: IRoom, user: IUser) {
        if (room.isRepeat === true) {
            room.repeatParentId = null;
            room.repeatConfig.occursOnDays = _ConvertOccursOnToUTC(user, room.startTime, room.repeatConfig.occursOnDays);
            room.repeatConfig.occursOnDaysComp = room.repeatConfig.occursOnDays.map( (dayOfWeek: number) => { return dayOfWeek + (room.startTimeInc30 / 100); } );

            //if there's a sunday value, add a 7 for ease of sat->sun comparison purposes
            let sunday = _.find(room.repeatConfig.occursOnDaysComp, (dayOfWeekComp: number) => { return dayOfWeekComp < 1; } );
            if (sunday) {
                room.repeatConfig.occursOnDaysComp.push(sunday + 7);
            }
        } else {
            room.repeatConfig = null;
        }
	}

    // Calc the local to UTC day offset (if there is one) and apply it to every element in the occursOn array
    function _ConvertOccursOnToUTC(user: IUser, startsTime: Date, occursOn: number[]) {
        let results: number[] = [];
        let starts = timezone(startsTime.toString());
        let offset = starts.utc().day() - starts.tz(user.timezone).day();
        if (offset > 1) { offset = -1; } // if day threshold is 0 -> 6, Sun -> Sat
        if (offset < 0) { offset = 1; } // if day threshold is 6 -> 0, Sat -> Sun
        occursOn.forEach(o => {
            let val = o + offset;
            if (val > 6) { val = 0; }
            else if (val < 0) { val = 6; }
            results.push(val);
        });
        return results;
    }

    /**
     * Add the Gamer to the room and add the room to the gamer
     */
    export function _JoinRoom(roomId: string, occurrenceDate: string, user: IUser, isCommitted: boolean, callback: any) {
        async.waterfall([

            // lookup room.game just so we know the platform
            (next: Function) => {
                Room.findById(roomId).populate('game').exec((err: Error, room: IRoom) => { next(err, room, room.game); });
            },
            // if this is a room series, make a new room occurrence (unless this is the host)
            (room: IRoom, game: IGame, next: Function) => {
                if (!user._id.equals(room.host) && room.isRepeat) {
                    const dayOfYear = moment.tz(occurrenceDate, 'MMDDYY', 'UTC').dayOfYear();
                    let startTime = moment(room.startTime).dayOfYear(dayOfYear).toDate();

                    _CreateRoomOccurrence(room, startTime, (err: Error, newRoom: IRoom) => {
                        roomId = newRoom.id; //may or may not be the same room
                        next(err, newRoom, game);
                    } );
                } else {
                    next(null, room, game);
                }
            },
            // find the gamer obj, add room and game to the gamer
            // add the game to gamer's library
            // add the game to gamer's preferred games list
            (room: IRoom, game: IGame, next: Function) => {
                Gamer.findOneAndUpdate( {'_id': user._id},
                    {
                        $addToSet: {
                            'rooms' : new mongoose.Types.ObjectId(room.id),
                            'games' : game._id,
                            'gamesPreferred': game._id
                        }
                    },
                    (err: Error, gamer: IGamer) => {
                        //if there were 5 or more preferred games and you're adding a new game, remove the earliest one
                        if (gamer.gamesPreferred.length >= 5 && gamer.gamesPreferred.indexOf(game._id) === -1 ) {
                            GamersController.Games._RemovePreferredGame(gamer.gamesPreferred[0].toString(), gamer.id,
                            (err: Error, newGamer: IGamer) => {
                                next(err, newGamer, game);
                            });
                        } else {
                            next(err, gamer, game);
                        }
                    });
            },
            // create a player obj and add to the room
            (gamer: IGamer, game: IGame, next: Function) => {
                let alias = PlatformApi.GetUserPlatformAlias(gamer, game.platformId);

                let player: IPlayer = {
                    username: gamer.username,
                    gamer: gamer._id,
                    avatarIcon: gamer.avatarIcon,
                    platformAlias: alias,
                    isCommitted: isCommitted};

                Room.findByIdAndUpdate( roomId, { $addToSet: {'players' : player} }, {new: true},
                    (err: Error, results: IRoom) => { next(err, results); });
            },
            // if isQuickJoin, get user pwd for email and remove isQuickJoin value
            (roomSaved: IRoom, next: Function) => {
                if (user.isQuickJoin) {
                    User.findOneAndUpdate( {_id: user._id}, { $unset: {isQuickJoin: ''}},
                        (err: Error, newUser: IUser) => {
                            next(err, roomSaved, newUser.password);
                        }
                    );
                } else {
                    next(null, roomSaved, '');
                }
            },
            // send join confirm email
            (roomSaved: IRoom, password: string, next: Function) => {
                if (user.isQuickJoin) {
                    Message._JoinRoomNewUserEmail(roomId, user, password,
                        (err: Error, msg: any) => { next(err, msg, user, roomSaved); }
                    );
                } else {
                    // don't email yourself if you're the host
                    if (user._id.equals(roomSaved.host)) {
                        next(null, null, user, roomSaved);
                    } else {
                        Message._JoinRoomEmail(roomId, user,
                            (err: Error, msg: any) => { next(err, msg, user, roomSaved); }
                        );
                    }
                }
            },
            //send email to host
            (message: string, newGamer: IUser, roomSaved: IRoom, next: Function) => {
                User.findOne({_id: roomSaved.host}, (err: Error, result: IUser) => {
                    if (err) {
                        return next(err, message, roomSaved);
                    } else {
                        Message._JoinRoomHostEmail(roomId, newGamer, result,
                            (err: Error, msg: any) => { next(err, msg, roomSaved); }
                        );
                    }
                });
            }
        ],
        (err: Error, results: any, roomSaved: IRoom) => {
            if (err) return callback(err);

            //fire and forget image generation
            _GenerateRoomImageById(roomId, (err: Error) => {});
            callback(err, roomSaved);
        });
    }

    /**
     * Remove the gamer from the room and remove the room from the gamer
     */
    export function _LeaveRoom(roomId: string, gamerId: mongoose.Types.ObjectId, callback: any) {
        async.waterfall([
            (next: Function) => {
                Gamer.findOneAndUpdate( {'_id': gamerId}, { $pull: {'rooms' : new mongoose.Types.ObjectId(roomId)} },
                    (err: Error, results: IGamer) => { next(err, results); });
            },
            (gamer: IGamer, next: Function) => {
                Room.findByIdAndUpdate(roomId, { $pull: {'players': {'gamer': gamerId}}}, {new: true},
                    (err: Error, results: IRoom) => { next(err, gamer, results); });
            },
            //send email to host
            (gamer: IGamer, roomSaved: IRoom, next: Function) => {
                User.findOne({_id: roomSaved.host}, (err: Error, result: IUser) => {
                    if (err) {
                        return next(err, '', roomSaved);
                    } else {
                        Message._LeaveRoomHostEmail(roomId, gamer, result,
                            (err: Error, msg: any) => { next(err, msg, roomSaved); }
                        );
                    }
                });
            }
        ],
        (err: Error, results: any, roomSaved: IRoom) => {
            if (err) return callback(err);

            //fire and forget image generation
            _GenerateRoomImageById(roomId, (err: Error) => {});
            callback(err, roomSaved);
        });
    }

    export function _AddComment(roomId: string, occurrenceDate: string, user: IUser, comment: string, callback: any) {
        let newComment: IComment = {username: user.username, gamer: user._id, comment: comment, ts: moment(timezone.tz('UTC')).toDate()};

        // if this is a room series, make a new room occurrence
        Room.findById(roomId, (err: Error, room: IRoom) => {
            if (err) return callback(err);

            let startTime: Date;

            if (room.isRepeat && occurrenceDate) {
                const dayOfYear = moment.tz(occurrenceDate, 'MMDDYY', 'UTC').dayOfYear();
                startTime = moment(room.startTime).dayOfYear(dayOfYear).toDate();
            } 
              
            _CreateRoomOccurrence(room, startTime, (err: Error, newRoom: IRoom) => {
                newRoom.comments.push(newComment);
                newRoom.save((err: Error, results: any) => {
                    _QueueComment(newRoom, newComment, (err: Error) => {
                        return callback(err, newRoom);
                    });
                });
            });
        });
    }

    function _QueueComment(room: IRoom, newComment: IComment, callback: Function) {
        //email players about new comment
        CommentQueue.findByIdAndUpdate(room.id, {$addToSet: {'comments': newComment}, $pull: {'players': {'gamer': newComment.gamer}}},
        (err: Error, result: ICommentQueue) => {
            if (err || !result) {
                // no record exists, create a new one
                let commentQueue = {
                    _id: room._id,
                    isRoomComment: true,
                    hostUsername: room.hostUsername,
                    comments: [newComment],
                    players: room.players
                };
                let newCommentQueue = new CommentQueue(commentQueue);
                _.remove(newCommentQueue.players, (player: IPlayer) => { return player.gamer.equals(newComment.gamer); });
                newCommentQueue.save((err: Error, res: any) => { callback(err); });
            } else {
                callback(null);
            }
        });
    }

    export function _Delete(roomId: string, userId: mongoose.Types.ObjectId, callback: any) {
        //only host can delete room
        Room.findById(roomId, (err: Error, room: IRoom) => {
            if (err) {
                return callback(err);
            } else {
                if (!userId.equals(room.host)) {
                    let unauthErr: any = new Error('user_not_authorized');
                    unauthErr.status = 403;
                    return callback(unauthErr);
                } else {
                    async.parallel([
                        //if this room is an occurrence of a series, exclude it from the series
                        (cb: Function) => {
                            _DeleteRoomOccurrence(room, cb);
                        },
                        //if this room is a series, nullify all instances of repeatParentId
                        (cb: Function) => {
                            _DeleteRoomSeriesReferences(room, cb);
                        },
                        //remove org.rooms entry
                        (cb: Function) => {
                            if (room.org) {
                                OrgsController._RemoveRoom(room.org, room._id, (err: Error, results: IRoom) => { cb(err, results); });
                            } else {
                                cb(null, null);
                            }
                        },
                        //remove gamer.rooms entry
                        (cb: Function) => {
                            Gamer.findOneAndUpdate( {'_id': userId}, { $pull: {'rooms' : new mongoose.Types.ObjectId(roomId)} },
                                (err: Error, results: IGamer) => { cb(err, results); });
                        },
                        //remove the room itself
                        (cb: Function) => {
                            Room.remove( { _id: room._id }, (err: Error) => { cb(err); } );
                        },
                        //remove room image from AWS
                        (cb: Function) => {
                            AWSUtil.DeleteFile(room.hostUsername, room.id, (err: Error) => {
                                //cb(err); //fire-forget for now
                            });
                            cb(null);
                        }
                    ],
                    (err: Error, results: any) => {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, { roomId: room.id, deleted: 1});
                        }
                    });
                }
            }
        });
    }

    /**
     * Creates a copy of the room object, saves it, returns the occurrence
     */
    function _CreateRoomOccurrence(roomSeries: IRoom, startTime: Date, callback: Function) {
        //if not a room series, just return yourself
        if (roomSeries.isRepeat !== true) {
            return callback(null, roomSeries);
        }

        //check if room occurrence already exists for this date
        Room.findOne({'repeatParentId': roomSeries._id, 'startTime': {'$gte': startTime, '$lt': moment(startTime).add(1, 'day').toDate() }}, (err: Error, foundRoomOccurrence: IRoom) => {
            if (err) {
                return callback(err);
            }
            if (foundRoomOccurrence) {
                return callback(null, foundRoomOccurrence);
            }

            let cloneRoom: any = _.clone(roomSeries.toJSON());
            delete cloneRoom._id;
            let roomOccurrence = new Room(cloneRoom);
            roomOccurrence.isNew = true; //creates a new doc
            roomOccurrence.startTime = startTime;
            roomOccurrence.isRepeat = false;
            roomOccurrence.repeatConfig = null;
            roomOccurrence.repeatParentId = roomSeries._id;
            Room.create(roomOccurrence, (err: Error, newRoom: any) => {
                async.parallel([
                    //remove this occurrence from the series
                    (cb: Function) => {
                        let dayToExclude = timezone(newRoom.startTime).tz(newRoom.hostTimezone).startOf('day').toDate();
                        Room.findByIdAndUpdate(roomSeries.id, { $addToSet: {'repeatConfig.excludes': dayToExclude}}, (err: Error, results: any) => {
                            cb(err, results);
                        });
                    },
                    //clone new occurrence for gamer.rooms
                    (cb: Function) => {
                        Gamer.findOneAndUpdate( {'_id': roomSeries.host}, { $addToSet: { 'rooms' : newRoom._id } }, cb);
                    },
                    //clone new occurrence for org.rooms
                    (cb: Function) => {
                        if (roomSeries.org) {
                            Org.findOneAndUpdate( {'_id': roomSeries.org}, { $addToSet: { 'rooms' : newRoom._id } }, cb);
                        } else {
                            cb(null);
                        }
                    }
                ],
                (err: Error, results: any) => {
                    return callback(err, newRoom);
                });
            });
        });

    }

    /**
     * Removes occurrence if it exists, adds to excludes on the series
     */
    function _DeleteRoomOccurrence(roomOccurrence: IRoom, callback: Function) {
        if (!roomOccurrence.repeatParentId) {
            return callback(null);
        }
        Room.findOneAndUpdate({_id: roomOccurrence.repeatParentId }, {$addToSet: {'excludes': roomOccurrence.startTime}}, callback);
    }

    /**
     * Removes orphan references to a series via repeatParentId
     */
    function _DeleteRoomSeriesReferences(roomSeries: IRoom, callback: Function) {
        if (!roomSeries.repeatConfig) {
            return callback(null);
        }
        Room.updateMany({ repeatParentId: roomSeries._id }, {repeatParentId: null}, { 'multi': true }, (err: Error, results: any) => { callback(err); });
    }

    export function _GenerateRoomImageById(roomId: string, callback: Function) {
        Room.findById(roomId)
            .populate('game')
            .exec((err: Error, room: IRoom) => {
                if (err) {
                    return callback(err);
                }
                _GenerateRoomImage(room, <any>room.game, (err: Error) => {
                    return callback(err);
                });
            });
    }

    /**
     * Create an image of the room-card and upload it to AWS Bucket for hosting, displays under room link
     */
    export function _GenerateRoomImage(room: IRoom, game: IGame, callback: Function) {

        let deepLinkHTML = _GenerateRoomHtml(room, game);

        let htmlStream = new Stream.Readable();
        htmlStream.push(deepLinkHTML);
        htmlStream.push(null);

        let imgStream = new streamBuffers.WritableStreamBuffer({
            initialSize: (50 * 1024),   // start at 50 kilobytes.
            incrementAmount: (10 * 1024) // grow by 10 kilobytes each time buffer overflows.
        });

        imgStream.on('finish', (err: Error) => {
            AWSUtil.UploadFileBuffer(room.hostUsername, room.id, imgStream.getContents(), (err: Error, results: any) => {
                //return callback(err, results); //don't wait for callback
            });
        });

        let convert = phantomrs({
            pool: 5,
            format: 'jpeg',
            phantomFlags: ['--ignore-ssl-errors=true']
        });

        htmlStream.pipe(
            convert({
                quality: 100,
                width: 500,
                height: 209 + (30 * Math.floor((room.players.length - 1) / 3)),
                crop: true
            })
            .on('log', function(err: any) {
                logger.error('Error generating html->image: ' + JSON.stringify(err));
                //return callback({message: 'Error generating html->image: ' + JSON.stringify(err)});
            })
        )
        //send image to Amazon S3 bucket
        .pipe(imgStream);

        //just output to file for testing purposes
        // .pipe(fs.createWriteStream('out.png').on('close', (err: Error) => {
        //     callback(null);
        // }));

        //don't wait for callback, fire-and-forget to save time, assume everything went to plan
        return callback(null);
    }

    export function _GenerateRoomHtml(room: IRoom, game: IGame) {
        let template = swig.compileFile(__dirname + '/templates/room.link.html');
        let playersHtml: string = '';
        room.players.forEach(player => {
            let playerImg: string;
            if (player.avatarIcon) {
                playerImg =
                `<div style="width: 32%;display: inline-block;margin-top: 10px;color: #333";">
                    <div style="vertical-align: middle; display: inline-block; margin-right: 5px">
                        <img style="vertical-align: middle; height: 25px; width: 25px; margin-right: 5px; border-radius: 3px;" src=`  + player.avatarIcon + ` />
                    </div>
                    <div style="overflow: hidden;white-space: nowrap;-o-text-overflow: ellipsis;-ms-text-overflow: ellipsis;text-overflow: ellipsis; max-width: 100px;vertical-align: middle; display: inline-block; margin-top: 3px;padding-left: 5px;">
                        ` + player.username + `
                    </div>
                </div>`;
            } else {
                playerImg =
                `<div style="width: 32%;display: inline-block;margin-top: 10px;">
                    <div style="vertical-align: middle; display: inline-block; margin-right: 5px; height: 25px; width: 25px; border: 1px solid #999999; border-radius: 3px;">
                        <span style="font-size: 13px; padding: 5px;color: #999;" class="glyphicon glyphicon-user" />
                    </div>
                    <div style="overflow: hidden;white-space: nowrap;-o-text-overflow: ellipsis;-ms-text-overflow: ellipsis;text-overflow: ellipsis; max-width: 100px; vertical-align: middle; display: inline-block; margin-top: 3px;padding-left: 5px;">
                        ` + player.username + `
                    </div>
                </div>`;
            }
            playersHtml += playerImg;
        });
        let deepLinkHTML = template({
            gameName: game.name,
            gameIcon: game.iconLg,
            gamePlatform: room.platformId,
            gameMode: room.gameMode,
            startTime: timezone(room.startTime).tz(room.hostTimezone).format('MMM D @ h:mma') + ' ' + timezone().tz(room.hostTimezone).zoneAbbr(),
            hostName: room.hostUsername,
            messageCount: room.comments.length,
            description: room.description,
            playerCount: room.players.length + (room.maxPlayers ? ' of ' + room.maxPlayers : ''),
        });

        deepLinkHTML += playersHtml + '</div></div>';
        return deepLinkHTML;
    }

}
