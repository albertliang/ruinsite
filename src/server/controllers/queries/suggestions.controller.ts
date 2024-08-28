'use strict';

import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame, Game} from '../../models/game.model';
import {IRoom, Room} from '../../models/room.model';
import * as tzutil from '../../util/timezone';
let tz = require('moment-timezone');
import * as log4js from 'log4js';
import * as _ from 'lodash';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as async from 'async';
import { GamersController } from '../gamers/gamers.controller';
import { ResultsHandler } from '../results.controller';
import moment = require('moment');

let swig = require('swig');
let timezone = require('moment-timezone');
let Promise = require('bluebird');
let logger = log4js.getLogger();

export namespace QuerySuggestionsController {

    /* exposed members */

    /**
     * Get users's suggested matches based on active games
     * @param req
     * @param res
     */
    export function GetUserSuggestions(req: express.Request, res: express.Response) {

        let user: IUser = req.user; //assumes user is populated during authentication
        let dateFilter: Date;
        if (req.query.dateFilter) {
            dateFilter = tz.tz(req.query.dateFilter, 'YYYY-MM-DD', user.timezone).utc().toDate();
        } else {
            dateFilter = tz(new Date()).utc();
        }

        _GetUserSuggestions(user.username, dateFilter, user.timezone,
            (err: Error, queryResults: any) => { ResultsHandler(err, queryResults, res); });
    }

    /**
     * Get users's suggested matches based on active games
     * {
		rooms: [],
		candidatesLookup:
			"asdfa-sf-dfadf-dfsdff" =
                {_id: "asdfa-sf-dfadf-dfsdff", username: "bob", avatarIcon: "http://asdf.png", category: "fnd", gamesPreferred: []}
        }
     */
    export function _GetUserSuggestions(username: string, dateFilter: Date, timezone: string, callback: Function) {

        Gamer.findOne({'username': username }, (err: Error, gamer: IGamer) => {
            if (err) {
                return callback(err);
            }

            //convert gamer's UTC avails to their local timezone
            let localAvail = tzutil.OffsetGamerAvail(gamer.avails, dateFilter, false, timezone);
            let roomsByDayInc: Record<string, IRoom[]> = {};
            let candidatesLookup: Record<string, IMiniGamer> = {};

            //loop through gamer's active games
            async.each(gamer.gamesPreferred, (gameId: string, cb) => {

                //find other gamers who have the game and are also available
                _GetOthersAvailability_Week(gamer.id, timezone, dateFilter, gameId, (err: Error, avails: IOtherAvails) => {

                    let rankings: IRankedSuggestion[] = [];

                    //iterate through all timeslots to calc/sort rankings for each timeslot: day 0-6, timeInc 0-47
                    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

                        for (let timeInc = 0; timeInc < 47; timeInc++) {
                            let gamersInThisTimeslot = avails.timeslots[dayIndex][timeInc];

                            if (gamersInThisTimeslot) {
                                let counter = timeInc;
                                let identicalTimeInc = 0;
                                //see if we can compact timeslots if gamers are the same
                                while (_isArrayEqual(gamersInThisTimeslot, avails.timeslots[dayIndex][counter++])) {
                                    identicalTimeInc++;
                                }

                                let ranking = {
                                    day: dayIndex,
                                    startTimeInc30: timeInc,
                                    endTimeInc30: timeInc + identicalTimeInc,
                                    gameId: gameId,
                                    gamers: gamersInThisTimeslot,
                                    rank: _CalcTimeslotRanking(gamersInThisTimeslot, avails.gamers)
                                };
                                //if user is also avail at same time, rank +2
                                if (localAvail[dayIndex][timeInc] === true) { ranking.rank += 2; }
                                rankings.push(ranking);

                                //stacking mult rankings, jump ahead a few timeIncs
                                timeInc += identicalTimeInc;
                            }
                        }
                    }

                    if (rankings.length > 0) {
                        // remove rankings below 4 (not very scientific)
                        // let totalRank = rankings.reduce((sum, current) => sum + current.rank, 0);

                        rankings = rankings.filter(ranking => ranking.rank >= 6);

                        // return as suggestions
                        for (let r = 0; r < rankings.length; r++) {
                            let ranking = rankings[r];
                            const gamersInThisTimeslot = avails.timeslots[ranking.day][ranking.startTimeInc30];
                            const nextStartTime = tzutil.CalcNextDateTimeFromAvail(dateFilter, ranking.day, ranking.startTimeInc30, timezone);

                            // only show suggestions after now (don't bother for past)
                            if (nextStartTime < moment().toDate())
                                continue;

                            let roomSuggestion: any = {
                                game: gameId,
                                host: gamer._id,
                                hostUsername: gamer.username,
                                category: 'suggest',
                                startTime: nextStartTime,
                                until: (ranking.endTimeInc30 - ranking.startTimeInc30) * 30,
                                candidates: gamersInThisTimeslot,
                                ranking: ranking.rank
                            };
                            _AddRoomToGroup(roomSuggestion, dateFilter, roomsByDayInc);
                            gamersInThisTimeslot.forEach(gamerId => {
                                candidatesLookup[gamerId.toString()] = avails.gamers[gamerId.toString()];
                            });
                        }
                    }
                    cb();
                });
            }, (err: Error) => {

                //sort rooms by date/time
                Object.keys(roomsByDayInc).forEach( key => {
                    roomsByDayInc[key].sort((r1, r2) => r1.startTime.getTime() - r2.startTime.getTime());
                });

                //return suggestion results when all of a user's preferred games are processed
                callback(err, {rooms: roomsByDayInc, candidatesLookup: candidatesLookup});
            });

        });
    }

    /* interfaces */

    interface IOtherAvails {
        timeslots: mongoose.Types.ObjectId[][][]; //2-dimensional array representing an array of object ids
        gamers: Record<string, IMiniGamer>;
    }

    interface IMiniGamer {
        _id: mongoose.Types.ObjectId;
        username: string;
        avatarIcon: string;
        gamesPreferred: mongoose.Types.ObjectId[];
        category: string;
    }

    interface IRankedSuggestion {
        rank: number;
        gameId: string;
        day: number;
        startTimeInc30: number;
        endTimeInc30: number;
        gamers: mongoose.Types.ObjectId[];
    }

    /* internal members */

    /**
    Gets other gamers who have the same game and their availabilities for the next week
    returns:
        {timeslots: timeslots, gamers: minigamers}
    */
    function _GetOthersAvailability_Week(gamerId: string, userTimezone: string, startDate: Date, gameId: string, callback: any) {

        // Find out who has this game
        GamersController.Games._OwnsGame(gameId, gamerId, (err: Error, ownsGame: any) => {
            if (err) { return err; }

            //concat friends/orgs/pubs who own this game as a lookup
            let gamers = ownsGame.friends.concat(ownsGame.orgs).concat(ownsGame.public);
            let minigamers: Record<string, IMiniGamer> = {};

            // convert ownsgames format to mini-profile
            ownsGame.friends.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, gamesPreferred: g.gamesPreferred, category: 'fnd'}; });
            ownsGame.orgs.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, gamesPreferred: g.gamesPreferred, category: 'org'}; });
            ownsGame.public.forEach( (g: IGamer) => { if (g.hasAvail) minigamers[g.id] = {_id: g._id, username: g.username, avatarIcon: g.avatarIcon, gamesPreferred: g.gamesPreferred, category: 'pub'}; });

            //put avails into 7 day timeslots by gamerId
            let gamersAvailable = _.filter(gamers, (gamer: IGamer) => { return gamer.hasAvail; });
            let timeslots = tzutil.OffsetMultiGamerAvail(gamersAvailable, startDate, false, userTimezone);
            //_CategorizeTimeslotNodes(minigamers, timeslots);

            return callback(null, {timeslots: timeslots, gamers: minigamers});
        });
    }

    /** Rank suggestions by gamer availabilities
    player: 1 pt
    friends: 2 pts, orgs: 1 pt
    want min of 4 pubs, or 2 non-pub players, even in optimal time = (1+1+1+1) + 2 = 6, or (3+1) + 2 = 6
    */
    function _CalcTimeslotRanking(gamerIds: any, gamers: Record<string, IMiniGamer>) {
        let rankScore = gamerIds.length;
        gamerIds.forEach( (gamerId: any) => {
            let gamer = gamers[gamerId.toString()];
            if (gamer.category === 'fnd') { rankScore += 2; }
            else if (gamer.category === 'org') { rankScore += 1; }
        });

        return rankScore;
    }

    function _AddRoomToGroup(room: IRoom, dateFilter: Date, roomsByDayInc: Record<string, IRoom[]>) {

        //add rooms to the dictionary for the appropriate timeslot
        let dayIndex = moment(room.startTime).diff(moment(dateFilter), 'day', false);
        let targetDate = moment(dateFilter).add('day', dayIndex).dayOfYear().toString();
        if (!roomsByDayInc[targetDate]) {
            roomsByDayInc[targetDate] = [];
        }

        roomsByDayInc[targetDate].push(room);
    }

    //assumes arrays already sorted
    function _isArrayEqual(arr1: any[], arr2: any[]) {

        if (arr1 && arr2 &&
            arr1.length > 0 && arr2.length > 0 &&
            arr1.length === arr2.length &&
            arr1.every(function(u, i) { return u.toString() === arr2[i].toString(); })) {
           return true;
        } else {
           return false;
        }
    }

}
