'use strict';

import * as mongoose from 'mongoose';
import * as express from 'express';
import * as async from 'async';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as tz from 'moment-timezone';
//let tz = require('moment-timezone');
import * as log4js from 'log4js';
import * as Promise from 'bluebird';

import {GamersController} from '../gamers/gamers.controller';
import {IUser} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame, Game} from '../../models/game.model';
import {IOrg, Org} from '../../models/org.model';
import {IRoom, Room} from '../../models/room.model';
import {DashboardWeekRooms} from './dashboardweekrooms';

import {ResultsHandler} from '../results.controller';
import * as util from '../../util/util';
import * as tzutil from '../../util/timezone';
let logger = log4js.getLogger();

export namespace QueryDashboardWeekController {

    /* exposed CRUD members */

    //get users's rooms, friends' rooms, orgs' rooms
    export function GetUserDashboard(req: express.Request, res: express.Response) {
        let user: IUser = req.user; //assumes user is populated during authentication
        let dateFilter: Date;
        if (req.query.dateFilter) {
            dateFilter = tz.tz(req.query.dateFilter, 'YYYY-MM-DD', user.timezone).utc().toDate();
        } else {
            dateFilter = tz(new Date()).utc().toDate();
        }
        let offset: number = tzutil.LocalTimeInc30Offset(user.timezone, dateFilter);
        let gamesFilter: number = parseInt(req.query.gamesFilter || 0);

        _GetUserDashboard(user.username, dateFilter, gamesFilter, offset, user.timezone,
            (err: Error, queryResults: DashboardWeekRooms) => { ResultsHandler(err, queryResults, res); });
    }

    //get all rooms for anon user
    export function GetAnonDashboard(req: express.Request, res: express.Response) {
        let dateFilter: Date;
        let timezone: string = req.query.timezone;
        if (req.query.dateFilter && timezone) {
            dateFilter = tz.tz(req.query.dateFilter, 'YYYY-MM-DD', timezone).utc().toDate();
        } else {
            dateFilter = tz(new Date()).utc().toDate();
        }
        let offset: number = tzutil.LocalTimeInc30Offset(timezone, dateFilter);
        let gamesFilter: number = parseInt(req.query.gamesFilter || 0);

        _GetUserDashboard(null, dateFilter, gamesFilter, offset, timezone,
            (err: Error, queryResults: DashboardWeekRooms) => { ResultsHandler(err, queryResults, res); });
    }

    export function GetDashboardSelfAvailability(req: express.Request, res: express.Response) {
        let user: IUser = req.user; //assumes user is populated during authentication
        let dateFilter: Date;
        if (req.query.dateFilter) {
            dateFilter = tz.tz(req.query.dateFilter, 'YYYY-MM-DD', user.timezone).utc().toDate();
        } else {
            dateFilter = tz(new Date()).utc().toDate();
        }
        let offset: number = tzutil.LocalTimeInc30Offset(user.timezone, dateFilter);

        _GetDashboardSelfAvailability_Week(user, dateFilter, offset,
            (err: Error, avails: any) => {
                ResultsHandler(err, avails, res);
            });
    }

    export function GetDashboardOthersAvailability(req: express.Request, res: express.Response) {
        let user: IUser = req.user; //assumes user is populated during authentication
        let dateFilter: Date;
        if (req.query.dateFilter) {
            dateFilter = tz.tz(req.query.dateFilter, 'YYYY-MM-DD', user.timezone).utc().toDate();
        } else {
            dateFilter = tz(new Date()).utc().toDate();
        }
        let offset: number = tzutil.LocalTimeInc30Offset(user.timezone, dateFilter);

        _GetDashboardOthersAvailability_Week(user, dateFilter, offset, req.query.gameId,
            (err: Error, avails: any) => { ResultsHandler(err, avails, res); });
    }

    export function GetDashboardOrgsAvailability(req: express.Request, res: express.Response) {
        let user: IUser = req.user; //assumes user is populated during authentication
        let timezone: string = user ? user.timezone : req.query.timezone;

        _GetOrgAvailability_Week(req.params.orgId, req.params.gameId, timezone,
            (err: Error, avails: any) => { ResultsHandler(err, avails, res); });
    }

    /* inner CRUD members */

    //Get users's rooms, friends' rooms, orgs' rooms
    //dateFilter: Date to filter down to. Assumes user's timezone midnight for db comparison purposes
    //gamesFilter: 0 - none, 1 - games owned by user, 2 - games preferred by user
    export function _GetUserDashboard(username: string, dateFilter: Date, gamesFilter: number, offset: number, timezone: string, callback: any) {

        async.waterfall([
            //get the user
            function (next: Function) {
                Gamer.findOne({ 'username': username }).exec(
                    function (err: Error, gamer: IGamer) {
                        if (_.isEmpty(gamer)) {
                            // if username not found assume it's anon user
                            const anonGamer: any = {
                                _id: new mongoose.Types.ObjectId(),
                                username: 'anon',
                            };
                            next(err, anonGamer);
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
                _GetRoomsAsync(gamer, orgRoomIds, dateFilter, gamesFilter, offset, timezone, (err: Error, queryResults: DashboardWeekRooms) => {
                    next(err, gamer, queryResults);
                });
            },
            //fill in games collection that are referenced by rooms and preferred games
            function (gamer: IGamer, queryResults: DashboardWeekRooms, next: Function) {
                let gameIds: string[] = [];

                function comp(x: any, y: any) {
                    if (x && y) {
                        return x.toString() === y.toString();
                    } else {
                        return true;
                    }
                }
                Object.keys(queryResults.dayRoomGroups).forEach((key) => {
                    gameIds = _.unionWith(gameIds, util.ConcatSubArrays(queryResults.dayRoomGroups[key], 'game'), _.isEqual);
                });
                gameIds = _.remove(gameIds, (x: string) => { return !_.isEmpty(x); });
                gameIds = _.unionWith(gameIds, gamer.gamesPreferred, _.isEqual); //add gamespreferred in case referenced by suggestions later

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
    function _GetRoomsAsync(gamer: IGamer, orgRoomIds: mongoose.Types.ObjectId[], dateFilter: Date, gamesFilter: number, offset: number, timezone: string, callback: Function) {
        let queryResults = new DashboardWeekRooms();
        let roomsByDayInc: Record<string, IRoom[]> = {};
        let roomResults: any = { 'usr': [], 'fnd': [], 'org': [], 'pub': [] };
        //let occursOnDateFilter = dateFilter.getUTCDay() + (tz(dateFilter).utc().hours() * 2) / 100;
        let dateFilterEnd = moment(dateFilter).add(7, 'day').toDate();
        queryResults.gamer = gamer;
        queryResults.gamerId = gamer._id;
        queryResults.timeInc30Offset = offset;

        let queryStartTime = {'$or':
            [
                { 'isRepeat': {'$ne': true }, 'startTime': {'$gte': dateFilter, '$lt': dateFilterEnd }},
                {
                    'isRepeat': true,
                    'repeatConfig.startsOn': {'$lte': dateFilterEnd},
                    '$or': [{'repeatConfig.endsOn': null}, {'repeatConfig.endsOn': {'$gte': dateFilter}}]
                }
            ]};
        let query: any = _.assign({}, queryStartTime); //copy object

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
                            roomResults.usr = results;
                            done(null);
                        });
                } else { done(null); }
            },
            // populate friends rooms
            function (done: Function) {
                if (!_.isEmpty(gamer.friends)) {
                    Room.find(_.assign({}, query, { 'players.gamer': { $in: gamer.friends } })).exec(
                        (err: Error, results: IRoom[]) => {
                            roomResults.fnd = results;
                            done(null);
                        });
                } else { done(null); }
            },
            // populate orgs rooms
            function (done: Function) {
                if (!_.isEmpty(orgRoomIds)) {
                    Room.find(_.assign({}, query, { 'players.gamer': { $nin: gamer.friends }, _id: { $in: orgRoomIds } })).exec(
                        (err: Error, results: IRoom[]) => {
                            roomResults.org = results;
                            done(null);
                        });
                } else { done(null); }
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
                        roomResults.pub = results;
                        done(null);
                    }
                );
            }
        ], (err: Error) => {
            //remove overlaps between user rooms and all others and for repeat rooms
            let userRoomIds = _.map(roomResults.usr, 'id');

            _.remove(roomResults.fnd, (r: IRoom) => { return _.includes(userRoomIds, r.id); });
            _.remove(roomResults.org, (r: IRoom) => { return _.includes(userRoomIds, r.id); });
            _.remove(roomResults.pub, (r: IRoom) => { return _.includes(userRoomIds, r.id); });

            roomResults.usr.forEach( (room: IRoom) => { _AddRoomToGroup(room, dateFilter, 'user', timezone, offset, roomsByDayInc); } );
            roomResults.fnd.forEach( (room: IRoom) => { _AddRoomToGroup(room, dateFilter, 'friends', timezone, offset, roomsByDayInc); } );
            roomResults.org.forEach( (room: IRoom) => { _AddRoomToGroup(room, dateFilter, 'orgs', timezone, offset, roomsByDayInc); } );
            roomResults.pub.forEach( (room: IRoom) => { _AddRoomToGroup(room, dateFilter, 'pubs', timezone, offset, roomsByDayInc); } );

            //sort rooms within each day's group
            Object.keys(roomsByDayInc).forEach( key => {
                roomsByDayInc[key].sort( (x: IRoom, y: IRoom) => x.startTimeInc30 - y.startTimeInc30 );
            });

            queryResults.dayRoomGroups = roomsByDayInc;

            callback(err, queryResults);
        });
    }

    function _AddRoomToGroup(room: IRoom, dateFilter: Date, type: string, timezone: string, offset: number, roomsByDayInc: Record<string, IRoom[]>) {
        const dayOfYearToday = moment(dateFilter).dayOfYear();
        room.roomCategory = type;

        //convert UTC to local timezone
        let dayOffset = 0;
        let startTimeInc30 = room.startTimeInc30 + offset;
        if (startTimeInc30 > 47) { startTimeInc30 -= 48; dayOffset++; }
        else if (startTimeInc30 < 0) { startTimeInc30 += 48; dayOffset--; }
        //adjust timeInc to user's local timezone
        room.startTimeInc30 = startTimeInc30;
        room.startTime = tz(room.startTime).tz(timezone).toDate();

        //add rooms to the dictionary for the appropriate timeslot
        if (room.isRepeat) {

            //convert occursOnDays to user's timezone
            let results: number[] = [];
            room.repeatConfig.occursOnDays.forEach(o => {
                let val = o + dayOffset;
                if (val > 6) { val = 0; }
                else if (val < 0) { val = 6; }
                results.push(val);
            });

            room.repeatConfig.occursOnDays.forEach((dayIndex: number) => {

                let dayIndexCalc = (dayIndex - moment(dateFilter).day()) + dayOffset;
                if (dayIndexCalc < 0) { dayIndexCalc += 7; }
                if (dayIndexCalc > 6) { dayIndexCalc -= 7; }

                let targetDate = (dayOfYearToday + dayIndexCalc).toString();
                if (!roomsByDayInc[targetDate]) {
                    roomsByDayInc[targetDate] = [];
                }

                //add room series if no series occurrence exists
                if (_.findIndex(roomsByDayInc[targetDate], (r: IRoom) => { return (r.repeatParentId && r.repeatParentId.equals(room._id)); }) === -1) {
                    room.repeatConfig.occursOnDays = results; //moved this before clone because cloneDeep is messed up

                    let roomClone: IRoom = _.cloneDeep(room);
                    roomClone.startTime = tz.tz(roomClone.startTime, timezone).dayOfYear(dayOfYearToday + dayIndexCalc).toDate();
                    roomsByDayInc[targetDate].push(roomClone);
                }
            });
        } else {
            let dayIndexCalc = moment(room.startTime).diff(moment(dateFilter), 'day', false);
            let targetDate = moment(dateFilter).add('day', dayIndexCalc).dayOfYear().toString();
            if (!roomsByDayInc[targetDate]) {
                roomsByDayInc[targetDate] = [];
            }

            //if series parent already exists, replace with the occurrence
            if (room.repeatParentId) {
                let seriesRoomIndex = _.findIndex(roomsByDayInc[targetDate], (r: IRoom) => { return r._id.equals(room.repeatParentId); });
                if (seriesRoomIndex >= 0) {
                    roomsByDayInc[targetDate].splice(seriesRoomIndex, 1, room);
                } else {
                    roomsByDayInc[targetDate].push(room);
                }
            } else {
                roomsByDayInc[targetDate].push(room);
            }
        }
    }

    /**
     * get gamer's availability for the week starting at the specified date and formats it for the dashboard
     * format should look like this:
     * [
            {"0":true,"1":true,"44":true,"45":true,"46":true,"47":true},
            {"0":true,"1":true,"2":true,"3":true},
            {"44":true,"45":true,"46":true,"47":true},
            {"44":true,"45":true,"46":true,"47":true},
            {"44":true,"45":true,"46":true,"47":true},
            {"44":true,"45":true,"46":true,"47":true},
            {"0":true,"1":true,"44":true,"45":true,"46":true,"47":true}
        ]
     *  */
    export function _GetDashboardSelfAvailability_Week(user: IUser, startDate: Date, offset: number, callback: Function) {
        Gamer.findById(user.id, (err: Error, gamer: IGamer) => {
            if (err) {
                return callback(err);
            }
            let availStore = tzutil.OffsetGamerAvail(gamer.avails, startDate, false, user.timezone);
            return callback(null, availStore);
        });
    }

    export function _GetDashboardOthersAvailability_Week(user: IUser, startDate: Date, offset: number, gameId: string, callback: Function) {
        Gamer.findById(user.id, (err: Error, gamer: IGamer) => {
            if (err) {
                return callback(err);
            }

            // Find out who has this game
            GamersController.Games._OwnsGame(gameId, gamer.id, (err: Error, ownsGame: any) => {
                if (err) { return callback(err); }

                let gamers = ownsGame.friends.concat(ownsGame.orgs).concat(ownsGame.public);
                let minigamers: any = {};

                // convert ownsgames format to mini-profile
                ownsGame.friends.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, category: 'fnd'}; });
                ownsGame.orgs.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, category: 'org'}; });
                ownsGame.public.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, category: 'pub'}; });

                //put avails into 7 day timeslots by gamerId
                let gamersAvailable = _.filter(gamers, (gamer: IGamer) => { return gamer.hasAvail; });
                let timeslots = tzutil.OffsetMultiGamerAvail(gamersAvailable, startDate, false, user.timezone);
                _CategorizeTimeslotNodes(minigamers, timeslots);

                return callback(null, {timeslots: timeslots, gamers: minigamers});
            });
        });
    }

    export function _GetOrgAvailability_Week(orgId: string, gameId: string, timezone: string, callback: Function) {

        // Find out which members are available
        GamersController.Games._OwnsGameOrg(orgId, gameId, (err: Error, members: IGamer[]) => {
            if (err) { return callback(err); }

            let minigamers: any = {};

            // convert ownsgames format to mini-profile
            members.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, category: 'org'}; });

            //put avails into 7 day timeslots by gamerId
            let gamersAvailable = _.filter(members, (gamer: IGamer) => { return gamer.hasAvail; });
            let today = tz(new Date()).utc().toDate();
            let timeslots = tzutil.OffsetMultiGamerAvail(gamersAvailable, today, false, timezone);
            _CategorizeTimeslotNodes(minigamers, timeslots);

            return callback(null, {timeslots: timeslots, gamers: minigamers});
        });
    }

    /**
     * Lookup gamer and replace the leaf nodes of the timeslots obj
     */
    function _CategorizeTimeslotNodes(gamers: any, timeslots: any[]) {
        timeslots.forEach( (day: any) => {
            let keys = Object.keys(day);
            keys.forEach((key: string) => {
                let newNode: any = {'fnd': [], 'org': [], 'pub': []};
                let gamerIds: mongoose.Types.ObjectId[] = day[key];
                gamerIds.forEach((gamerId: mongoose.Types.ObjectId) => {
                    let category = gamers[gamerId.toString()].category;
                    newNode[category].push(gamerId.toString());
                });
                day[key] = newNode;
            });
        });
    }

}

