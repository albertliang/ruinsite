'use strict';

import * as mongoose from 'mongoose';
import * as express from 'express';
import * as async from 'async';
import * as _ from 'lodash';
import * as moment from 'moment';
let tz = require('moment-timezone');
import * as tzutil from '../../util/timezone';
import * as Promise from 'bluebird';

import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame, Game} from '../../models/game.model';
import {IOrg, Org} from '../../models/org.model';
import {IRoom, Room} from '../../models/room.model';
import {DashboardRooms, DashboardRoomGroup} from './dashboardrooms';
import {GamersController} from '../gamers/gamers.controller';

import {RoomsController} from '../rooms/rooms.controller';
import {ResultsHandler} from '../results.controller';
import * as util from '../../util/util';

export namespace QueryRecommendationController {

    /* exposed CRUD members */
    export function GetRoomCandidates(req: express.Request, res: express.Response) {
        let user: IUser = req.user;
        let roomId: string = req.params.roomId;
        let occurrenceDate: string = req.params.occurrenceDate;

        _GetRoomCandidatesById(roomId, user, occurrenceDate)
            .then( (candidates: IGamer[]) => { ResultsHandler(null, candidates, res); })
            .catch( (err: Error) => { ResultsHandler(err, null, res); });
    }

    /* internal CRUD members */

    /**
     * Output
     * {
            host = {gamerId: "sdfhfghgh", s:40, e:48}
            games
                "asdfa-sf-dfadf-dfsdff" =
                    [0] = {gamerId: "asfadgdsg", username: "bob", avatarUrlSm: "http://asdf.png", friend: true, org: false, start: 40, end: 44}
                    [1] = {gamerId: "fdgsdbdfg", username: "john", avatarUrlSm: "http://asdf.png", friend: false, org: true, start: 42, end: 44, roomId: "fhdfghdfg", startr: 42, endr: 44}
        }

        {
            'friends': IGamer[],
            'orgs': IGamer[],
            'pubs': IGamer[]
        }
     */

    export function _GetRoomCandidatesById(roomId: string, user: IUser, occurrenceDate?: string): Promise<Object> {
        return new Promise<any>((resolve, reject) => {
            Room.findById(roomId, (err: Error, room: IRoom) => {
                if (err || !room) {
                    reject(err);
                } else {
                    let dayOfWeek: number;
                    if (room.isRepeat) {
                        //find utc dayOfWeek based on startTime and local
                        const dayOfYear = moment.tz(occurrenceDate, 'MMDDYY', user.timezone).dayOfYear();
                        dayOfWeek = moment(room.startTime).tz(user.timezone).dayOfYear(dayOfYear).utc().day();

                    } else {
                        dayOfWeek = moment(room.startTime).day();
                    }
                    resolve(_GetRoomCandidates(room, user._id, dayOfWeek));
                }
            });
        });
    }

    /**
     * Get possible room candidates from host's friends, orgs, public sources
     */
    export function _GetRoomCandidates(room: IRoom, gamerId: mongoose.Types.ObjectId, dayOfWeek: number): Promise<Object> {
        return new Promise<any>((resolve, reject) => {
            GamersController.Games._OwnsGame(room.game.toString(), gamerId.toString(), (err: Error, ownsGame: any) => {
                ownsGame.friends.forEach((g: IGamer) => { g.isFriend = true; });
                ownsGame.orgs.forEach((g: IGamer) => { g.isOrg = true; });
                ownsGame.public = _RemoveRedundantCandidates(room, ownsGame.public);

                let candidates: IGamer[] = ownsGame.friends.concat(ownsGame.orgs).concat(ownsGame.public);
                candidates = _RemoveRedundantCandidates(room, candidates);

                //find the avail range of candidates
                const minAvail = dayOfWeek * 48 + room.startTimeInc30 - 2;
                const maxAvail = minAvail + 10;

                candidates.forEach( candidate => {
                    let availsForWeek: any = {};
                    let availsForQuery: any = {};

                    //convert arr to dict for lookup;
                    candidate.availsArr.forEach(avail => {
                        availsForWeek[avail.toString()] = true;
                    });

                    //if avail for that time, enter availsForQuery 0-9
                    for (let i = 0; i < (maxAvail - minAvail); i++) {
                        if (availsForWeek[minAvail + i]) {
                            availsForQuery[i.toString()] = true;
                        }
                    }

                    candidate.availCalc = availsForQuery;
                });

                //sort candidates by how available they are during the timeframe (categorized by friends, orgs, pub)
                //if same, sort by alpha
                candidates.sort((c1, c2) => {
                    let result = Object.keys(c2.availCalc).length + (c2.isFriend ? 100 : c2.isOrg ? 20 : 0)
                                - Object.keys(c1.availCalc).length - (c1.isFriend ? 100 : c1.isOrg ? 20 : 0);
                    if (result === 0) {
                        if (c1.username.toLowerCase() < c2.username.toLowerCase()) { return -1; }
                        else { return 1; }
                    } else {
                        return result;
                    }
                });
                resolve(candidates);
            });
        })
        .then((candidates: IGamer[]) => {
            // remove users that have opted out of directInvites
            let gamerIds = _.map(candidates, (gamer: IGamer) => { return gamer.id; });

            return User.find({_id: {$in: gamerIds}, 'settings.subscribedTo.directInvites': false}).exec().then((usersToRemove: IUser[]) => {
                //remove gamers where directInvites = false
                _.remove(candidates, (candidate: IGamer) => {
                    return _.findIndex(usersToRemove, (utr) => { return utr.id === candidate.id; }) >= 0;
                });
                return candidates;
            });
        });
    }

    // remove yourself and any candidates that are already in the room
    function _RemoveRedundantCandidates(room: IRoom, gamers: IGamer[]) {
        _.remove(gamers, (candidate) => {
            let isFound = false;
            room.players.forEach(player => {
                if (player.gamer.equals(candidate._id)) {
                    isFound = true;
                    return;
                }
            });
            if (isFound) { return true; }
            else { return false; }
        });
        return gamers;
    }

}

