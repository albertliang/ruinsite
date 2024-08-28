'use strict';

import * as mongoose from 'mongoose';
import * as express from 'express';
import * as async from 'async';
import * as _ from 'lodash';
import * as moment from 'moment';
//import * as tz from 'moment-timezone';
let tz = require('moment-timezone');
import * as tzutil from '../../util/timezone';
import * as log4js from 'log4js';
import * as Promise from 'bluebird';

import {GamersController} from '../gamers/gamers.controller';
import {IUser} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame, Game} from '../../models/game.model';
import {IOrg, Org} from '../../models/org.model';
import {IRoom, Room} from '../../models/room.model';
import {DashboardRooms, DashboardRoomGroup} from './dashboardrooms';

import {ResultsHandler} from '../results.controller';
import * as util from '../../util/util';
let logger = log4js.getLogger();

export namespace QueryDashboardController {

    /* exposed CRUD members */

    //get users's rooms, friends' rooms, orgs' rooms
    export function GetUserDashboard(req: express.Request, res: express.Response) {
        let user: IUser = req.user; //assumes user is populated during authentication
        let dateDefault: Date = req.query.dateFilter || new Date();
        let dateFilter: Date = tzutil.GetUserMidnight(user.timezone, dateDefault);
        let offset: number = tzutil.LocalTimeInc30Offset(user.timezone, dateFilter);
        let gamesFilter: number = parseInt(req.query.gamesFilter || 1);

        _GetUserDashboard(user.username, dateFilter, gamesFilter, offset,
            (err: Error, queryResults: DashboardRooms) => { ResultsHandler(err, queryResults, res); });
    }

    /* inner CRUD members */

    //Get users's rooms, friends' rooms, orgs' rooms
    //dateFilter: Date to filter down to. Assumes user's timezone midnight for db comparison purposes
    //gamesFilter: 0 - none, 1 - games owned by user, 2 - games preferred by user
    export function _GetUserDashboard(username: string, dateFilter: Date, gamesFilter: number, offset: number, callback: any) {

        async.waterfall([
            //get the user
            function (next: Function) {
                Gamer.findOne({ 'username': username }).exec(
                    function (err: Error, gamer: IGamer) {
                        if (_.isEmpty(gamer)) {
                            next(new Error('Could not find specified user: ' + username));
                        }
                        else {
                            next(err, gamer);
                        }
                    }
                );
            },
            //find the rooms your orgs have
            function (gamer: IGamer, next: Function) {
                //if gamer has no orgs, skip to next section
                if (_.isEmpty(gamer.orgs)) {
                    next(null, gamer, null);
                }
                else {
                    Org.find({ '_id': { '$in': gamer.orgs } },
                        function (err: Error, orgs: IOrg[]) {
                            let orgRoomIds: mongoose.Types.ObjectId[] = [];

                            _.forEach(orgs, (org: IOrg) => {
                                if (!_.isEmpty(org.rooms)) {
                                    _.forEach(org.rooms, (roomId: mongoose.Types.ObjectId) => {
                                        orgRoomIds.push(roomId);
                                    });
                                }
                            });
                            next(err, gamer, orgRoomIds);
                        });
                }
            },
            //join to find the user's rooms, friends' rooms, orgs' rooms
            function (gamer: IGamer, orgRoomIds: mongoose.Types.ObjectId[], next: Function) {
                _GetRoomsAsync(gamer, orgRoomIds, dateFilter, gamesFilter, offset, (err: Error, queryResults: DashboardRooms) => {
                    next(err, gamer, queryResults);
                });
            },
            //fill in games collection that are referenced by rooms
            function (gamer: IGamer, queryResults: DashboardRooms, next: Function) {
                let gameIds: string[] = [];

                function comp(x: any, y: any) {
                    if (x && y) {
                        return x.toString() === y.toString();
                    } else {
                        return true;
                    }
                }
                queryResults.roomGroups.forEach(roomGroup => {
                    gameIds = _.unionWith(gameIds,
                        util.ConcatSubArrays(roomGroup.userRooms, 'game'),
                        util.ConcatSubArrays(roomGroup.friendRooms, 'game'),
                        util.ConcatSubArrays(roomGroup.orgRooms, 'game'),
                        util.ConcatSubArrays(roomGroup.pubRooms, 'game'), _.isEqual);
                });
                gameIds = _.remove(gameIds, (x: string) => { return !_.isEmpty(x); });

                // find the games associated
                Game.find({ gameId: { $in: gameIds } }, (err: Error, games: IGame[]) => {
                    queryResults.games = games;
                    next(err, queryResults);
                });
            }
        ], (err, queryResults) => {
            //logger.debug(JSON.stringify(queryResults));
            callback(err, queryResults);
        });
    }

    //Get the actual Rooms based on roomIds from user, friends, and orgs
    //filter results based on date and games
    function _GetRoomsAsync(gamer: IGamer, orgRoomIds: mongoose.Types.ObjectId[], dateFilter: Date, gamesFilter: number, offset: number, callback: Function) {
        let queryResults = new DashboardRooms();
        let roomsByTimeInc: any = {};
        let occursOnDateFilter = dateFilter.getUTCDay() + (tz(dateFilter).utc().hours() * 2) / 100;
        queryResults.gamer = gamer;
        queryResults.gamerId = gamer._id;
        queryResults.timeInc30Offset = offset;

        let queryStartTime = {'$or':
            [
                { 'isRepeat': {'$ne': true }, 'startTime': {'$gte': dateFilter, '$lte': moment(dateFilter).add(1, 'day').toDate() }},
                {
                    'isRepeat': true,
                    'repeatConfig.occursOnDaysComp': {$elemMatch: {'$gte': occursOnDateFilter, '$lte': occursOnDateFilter + 1 }},
                    'repeatConfig.startsOn': {'$lte': dateFilter},
                    '$or': [{'repeatConfig.endsOn': null}, {'repeatConfig.endsOn': {'$gte': dateFilter}}],
                    'repeatConfig.excludes': {'$ne': dateFilter}
                }
            ]};
        let query: any = _.assign({}, queryStartTime); //copy object

        //also get series rooms

        //gamesFilter: 0 - none, 1 - games owned by user, 2 - games preferred by user
        if (gamesFilter === 1) {
            query.game = { $in: gamer.games };
        } else if (gamesFilter === 2) {
            query.game = { $in: gamer.gamesPreferred };
        }

        //logger.debug(JSON.stringify(query));

        // async parallel to get rooms for user, friends, orgs
        async.parallel([
            // populate user rooms, do NOT filter on games
            function (done: Function) {
                if (!_.isEmpty(gamer.rooms)) {
                    Room.find(_.assign({}, queryStartTime, { _id: { $in: gamer.rooms } })).exec(
                        (err: Error, results: IRoom[]) => {
                            results.forEach(room => {
                                //add rooms to the dictionary for the appropriate timeslot
                                let roomGroup: DashboardRoomGroup = (roomsByTimeInc[room.startTimeInc30.toString()] || new DashboardRoomGroup(room.startTimeInc30));
                                roomGroup.userRooms.push(room);
                                roomsByTimeInc[room.startTimeInc30.toString()] = roomGroup;
                            });
                            done(null);
                        }
                    );
                }
                else {
                    done(null);
                }
            },
            // populate friends rooms
            function (done: Function) {
                if (!_.isEmpty(gamer.friends)) {
                    Room.find(_.assign({}, query, { 'players.gamer': { $in: gamer.friends } })).exec(
                        (err: Error, results: IRoom[]) => {
                            results.forEach(room => {
                                //add rooms to the dictionary for the appropriate timeslot
                                let roomGroup: DashboardRoomGroup = (roomsByTimeInc[room.startTimeInc30.toString()] || new DashboardRoomGroup(room.startTimeInc30));
                                roomGroup.friendRooms.push(room);
                                roomsByTimeInc[room.startTimeInc30.toString()] = roomGroup;
                            });
                            done(null);
                        }
                    );
                }
                else {
                    done(null);
                }
            },
            // populate orgs rooms
            function (done: Function) {
                if (!_.isEmpty(orgRoomIds)) {
                    Room.find(_.assign({}, query, { 'players.gamer': { $nin: gamer.friends }, _id: { $in: orgRoomIds } })).exec(
                        (err: Error, results: IRoom[]) => {
                            results.forEach(room => {
                                //add rooms to the dictionary for the appropriate timeslot
                                let roomGroup: DashboardRoomGroup = (roomsByTimeInc[room.startTimeInc30.toString()] || new DashboardRoomGroup(room.startTimeInc30));
                                roomGroup.orgRooms.push(room);
                                roomsByTimeInc[room.startTimeInc30.toString()] = roomGroup;
                            });
                            done(null);
                        }
                    );
                }
                else {
                    done(null);
                }
            },
            // populate public rooms
            function (done: Function) {
                // force filter to preferred games only, room must be public, cannot be friend or org
                let queryPublic: any = _.assign({}, query);
                queryPublic.privacyLevel = 5; //public room
                //queryPublic.game = { $in: gamer.gamesPreferred };
                queryPublic._id = { $nin: orgRoomIds };

                Room.find(_.assign({}, queryPublic, { 'players.gamer': { $nin: gamer.friends } })).limit(50).exec(
                    (err: Error, results: IRoom[]) => {
                        results.forEach(room => {
                            //add rooms to the dictionary for the appropriate timeslot
                            let roomGroup: DashboardRoomGroup = (roomsByTimeInc[room.startTimeInc30.toString()] || new DashboardRoomGroup(room.startTimeInc30));
                            roomGroup.pubRooms.push(room);
                            roomsByTimeInc[room.startTimeInc30.toString()] = roomGroup;
                        });
                        done(null);
                    }
                );
            }
        ], (err: Error) => {
            //transpose the dictionary values to queryResults

            Object.keys(roomsByTimeInc).forEach((key) => {
                let timeGroup: DashboardRoomGroup = roomsByTimeInc[key];
                queryResults.roomGroups.push(timeGroup);
            });

            callback(err, queryResults);
        });
    }

    //get user's friends
    export function _GetUserFriends(username: string, callback: any) {
        Gamer
            .findOne({ username: username }) //find the gamer
            .populate('friends') //get his friends
            .exec(
            (err: any, results: IGamer) => {
                callback(err, results.friends);
            });
    }

    //get what rooms a user is in
    export function _GetUserRooms(username: string, callback: any) {
        Gamer
            .findOne({ username: username }) //find the gamer
            .populate('rooms') //get his rooms
            .exec(
            (err: any, results: IGamer) => {
                callback(err, results.friends);
            });
    }

    //get what rooms a user's friends are in
    export function _GetUserFriendsRooms(username: string, callback: any) {
        Gamer
            .findOne({ username: username }) //find the gamer
            .populate('friends') //get his friends
            .populate('friends.rooms') //get his friends' room
            .exec(
            (err: any, results: IGamer) => {
                callback(err, results.friends);
            });
    }

    /**
     * Need authorization middleware
     */
    exports.hasAuthorization = function (req: express.Request, res: express.Response, next: Function) {
        // let hasAuth = false;
        // let user: IUser = req.user;
        // let isAdminRole = _.includes(user.roles, 'admin');

        // // Anyone has authorization to their own documents...
        // if (req.need.createdBy === req.user) {
        //     hasAuth = true;
        // // Admins can edit any data...
        // } else if (isAdminRole) {
        //     hasAuth = true;
        // }

        // if (!hasAuth) {
        //     return res.status(403).send('user_not_authorized');
        // }
        // next();
    };

}

