'use strict';

import {Config} from '../../config/config';
import {Mailer} from './mailer';
import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame, Game} from '../../models/game.model';
import {IRoom, Room} from '../../models/room.model';
import {IAvailabilityQueue, AvailabilityQueue} from '../../models/availabilityqueue.model';
import {RoomsController} from '../../controllers/rooms/rooms.controller';
import * as tzutil from '../../util/timezone';
import * as log4js from 'log4js';
import * as _ from 'lodash';
import * as mongoose from 'mongoose';
import * as moment from 'moment';

let swig = require('swig');
let timezone = require('moment-timezone');
let Promise = require('bluebird');
let logger = log4js.getLogger();

export namespace MassMessage {

    /* exposed members */

    /*
    * Finds users that are available today and schedules when to email them regarding avail response matches
    */
    export function ScheduleAvailUsers(utcDayIndex: number, utcHour: number) {

        let _usersDict: any = {};
        let utcDayIndexNext = utcDayIndex !== 6 ? utcDayIndex + 1 : 0;
        let timeInc30Week: number = (utcDayIndex * 48) + (utcHour * 2);

        // remove all prior availqueues from yesterday
        return AvailabilityQueue.remove({}).exec()
        // get users
        .then( () => {
            return User.find( {'$and': [
                // {'settings.subscribedTo.emailAvail': true},
                {'emailIsVerified': true},
                {'gamesPreferred': {$ne: []}}
            ]}, {} ).exec();
        })
        // get gamers tied to those users and that have availability today
        .then( (users: IUser[]) => {
            users.forEach( user => {
                _usersDict[user.id] = user;
            });
            let query: any = {};
            query['_id'] = {'$in' : users };
            query['hasAvail'] = true;
            if (timeInc30Week <= (335 - 48))
                query['availsArr'] = {'$elemMatch': {'$gte': timeInc30Week, '$lte': (timeInc30Week + 48) }};
            else {
                query['$or'] = [{'availsArr': {'$gte': timeInc30Week}}, {'availsArr': {'$lte': timeInc30Week + 48 - 335}}];
            }

            return Gamer.find( {'$and': [query] }).exec();
        })
        .then( (gamers: IGamer[]) => {
            let results: any[] = [];
            gamers.forEach( gamer => {
                let timeIncs: number[] = gamer.availsArr;
                if (timeIncs.length > 0) {

                    if (timeInc30Week <= (335 - 48))
                        _.remove(timeIncs, (n) => { return n < timeInc30Week || n > (timeInc30Week + 48); });
                    else {
                        let nextDayTimeIncs = _.remove(timeIncs, (n) => { return n < (timeInc30Week + 48 - 335); });
                        _.remove(timeIncs, (n) => { return n < timeInc30Week || n > (timeInc30Week + 48); });
                        nextDayTimeIncs.forEach(t => t + 355);
                        timeIncs = _.union(timeIncs, nextDayTimeIncs);
                    }

                    // get the lowest number/earliest available as the scheduled time to send email
                    let minVal = _.min(timeIncs);
                    let availQueue = new AvailabilityQueue({
                        gamer: gamer._id,
                        email: _usersDict[gamer.id].email,
                        timezone: _usersDict[gamer.id].timezone,
                        dayIndex: Math.floor(minVal / 48),
                        emailAvailHourUtc: Math.floor((minVal % 48) / 2)
                    });
                    results.push(availQueue);

                    //move indicator up by 5 hours and check for min again
                    _.remove(timeIncs, (n) => { return n < (minVal + 10); });
                    if (timeIncs.length > 0) {
                        minVal = _.min(timeIncs);
                        availQueue = new AvailabilityQueue({
                            gamer: gamer._id,
                            email: _usersDict[gamer.id].email,
                            timezone: _usersDict[gamer.id].timezone,
                            dayIndex: Math.floor(minVal / 48),
                            emailAvailHourUtc: Math.floor((minVal % 48) / 2)
                        });
                        results.push(availQueue);
                    }
                }
            });
            return results;
        })
        // save all availqueues
        .then( (availsToSave: IAvailabilityQueue[]) => {
            return AvailabilityQueue.insertMany(availsToSave);
        });
    }

    /**
     * Send Mass Email with response to user's availability
     * {
		host = {gamerId: "sdfhfghgh", s:40, e:48}
		games
			"asdfa-sf-dfadf-dfsdff" = 
                [0] = {gamerId: "asfadgdsg", username: "bob", avatarUrlSm: "http://asdf.png", friend: true, org: false, start: 40, end: 44}
				[1] = {gamerId: "fdgsdbdfg", username: "john", avatarUrlSm: "http://asdf.png", friend: false, org: true, start: 42, end: 44, roomId: "fhdfghdfg", startr: 42, endr: 44}
        }
     */
     export function SendAvailResponseEmails(utcDayIndex: number, utcHour: number, emailOverride: string = null) {

        let timeInc30Week: number = (utcDayIndex * 48) + (utcHour * 2);

        let sendEmails: any[] = [];         //all email jobs to run
        let availGamerIds: mongoose.Types.ObjectId[];
        let gamersToEmail: IGamer[];
        let gamersAvail: IGamer[];
        let roomsToday: IRoom[];

        let dictEmails: any = {};           //gamerId -> email
        let dictTimezones: any = {};        //gamerId -> timezone
        let dictGamers: any = {};           //gamerId -> gamers
        let dictPrefGames: any = {};        //gameId -> game
        let dictPrefgameGamer: any = {};    //pref gameId -> gamerIds - find other gamers that pref same games
        let dictGameGamer: any = {};        //gameId -> gamerIds - find other gamers that own the same game pref game
        let dictOrgGamer: any = {};         //orgId -> gamerIds - who else is in the same org

        let candidates: any = {};           //end result
        let targetDateTime = _GetTargetDate(utcDayIndex);
        targetDateTime = moment(targetDateTime).add(utcHour, 'hour').toDate();

        //get any rooms for today
        return _GetRooms(targetDateTime)
            //get all availqueues of users to email
            .then( (rooms) => {
                roomsToday = rooms;
                return AvailabilityQueue.find({dayIndex: utcDayIndex, emailAvailHourUtc: utcHour}).exec();
            })
            .then( (availqueues) => {
                //find matching gamers and store emails in lookup
                availGamerIds = _.map(availqueues, (availQueue: IAvailabilityQueue) => { return availQueue.gamer; });
                availqueues.forEach(availqueue => {
                    dictEmails[availqueue.gamer.toString()] = availqueue.email;
                    dictTimezones[availqueue.gamer.toString()] = availqueue.timezone;
                });
                return Gamer.find( {_id: {$in : availGamerIds}} ).exec();
            })
            //find all gamers available during the next 5 hours
            .then( (results: IGamer[]) => {
                gamersToEmail = results;
                let query: any = {};
                query['hasAvail'] = true;
                query['isTester'] = {'$ne': true};
                if (timeInc30Week <= (335 - 10))
                    query['availsArr'] = {'$elemMatch': {'$gte': timeInc30Week, '$lte': timeInc30Week + 10 }};
                else {
                    query['$or'] = [{'availsArr': {'$gte': timeInc30Week}}, {'availsArr': {'$lte': timeInc30Week + 10 - 335}}];
                }
                return Gamer.find( { '$or': [{_id: {$in : availGamerIds}}, {'$and': [query] }]}).exec();
            })
            //build dictionary lookups
            .then( (results: IGamer[]) => {
                gamersAvail = results;
                gamersAvail.forEach( gamer => {
                    dictGamers[gamer.id] = gamer;
                    gamer.gamesPreferred.forEach(pg => {
                        if (!dictPrefgameGamer[pg.toString()])
                            dictPrefgameGamer[pg.toString()] = [gamer.id];
                        else
                            dictPrefgameGamer[pg.toString()].push(gamer.id);
                    });
                    gamer.games.forEach(g => {
                        if (!dictGameGamer[g.toString()])
                            dictGameGamer[g.toString()] = [gamer.id];
                        else
                            dictGameGamer[g.toString()].push(gamer.id);
                    });
                    gamer.orgs.forEach(o => {
                        if (!dictOrgGamer[o.toString()])
                            dictOrgGamer[o.toString()] = [gamer.id];
                        else
                            dictOrgGamer[o.toString()].push(gamer.id);
                    });
                });
                let gameIds: string[] = _.map(Object.keys(dictPrefgameGamer), (key: string) => { return key; });
                return Game.find( { _id: {$in: gameIds}}).exec();
            })
            //iterate through gamersToEmail and send mail
            .then((results: IGame[]) => {
                //create pref game lookup
                results.forEach( game => {
                    dictPrefGames[game.gameId] = game;
                });

                gamersToEmail.forEach( gamer => {

                    //for today's rooms, categorize to as this gamer's friends/networks/pub w/ active game
                    let gamerRooms = _CategorizeGamerRooms(gamer, roomsToday);

                    //for each of a gamer's pref game, find other candidates
                    let candidates: any = {};
                    candidates.games = {};
                    let hasMatches = false;
                    gamer.gamesPreferred.forEach( prefGame => {
                        let gamersWithPrefGame: any[] = [];
                        let prefGameString = prefGame.toString();
                        candidates.start = timeInc30Week;
                        candidates.end = timeInc30Week + 10;

                        //look up who has the game and add mini profile
                        if (dictGameGamer[prefGame.toString()]) {
                            dictGameGamer[prefGame.toString()].forEach( (gamerId: string) => {
                                if (gamerId !== gamer.id) { //excluding yourself
                                    let candidate: IGamer = dictGamers[gamerId];
                                    gamersWithPrefGame.push( {
                                        gamerId: gamerId,
                                        username: candidate.username,
                                        avatarUrlSm: candidate.avatarUrlSm,
                                        friend: _.indexOf(_.map(gamer.friends, f => f.toString()), gamerId) >= 0,
                                        org: _.intersectionWith(gamer.orgs, candidate.orgs, _.isEqual).length > 0,
                                        availsArr: candidate.availsArr,
                                        ispreferred: _.indexOf(dictPrefgameGamer[prefGame.toString()], gamerId) >= 0
                                    });
                                    hasMatches = true;
                                }
                            });
                            candidates.games[prefGame.toString()] = gamersWithPrefGame;
                        }
                    });

                    if (hasMatches) {
                        let user: IUser = new User({
                            'email': dictEmails[gamer.id],
                            'timezone': dictTimezones[gamer.id],
                            'username': gamer.username
                        });

                        sendEmails.push( ((user: IUser, gamer: IGamer, gamesLookup: any) => {
                            return _SendAvailResponseEmail(utcDayIndex, user, gamer, dictPrefGames, candidates, gamerRooms, emailOverride);
                        })(user, gamer, dictPrefGames));
                    }
                });
            })
            .then(() => {
                return Promise.all(sendEmails);
            });
    }

    /* internal members */

    function _GetTargetDate(utcDayIndex: number) {
        let targetDate = moment().utc();
        while (targetDate.day() !== utcDayIndex) {
            targetDate.add(1, 'day');
        }
        return targetDate.toDate();
    }

    function _GetRooms(dateFilter: Date) {

        let dateFilterEnd = moment(dateFilter).add(1, 'day').toDate();
        let occursOnDay = dateFilter.getDay() + (dateFilter.getHours() / 100.0);

        let query = {'$or':
            [
                { 'isRepeat': {'$ne': true }, 'startTime': {'$gte': dateFilter, '$lt': dateFilterEnd }},
                {
                    'isRepeat': true,
                    'repeatConfig.occursOnDaysComp': {'$elemMatch': {'$gte': occursOnDay, '$lt': occursOnDay + 1 }},
                    '$or': [{'repeatConfig.endsOn': null}, {'repeatConfig.endsOn': {'$gte': dateFilterEnd}}]
                }
            ]};

        return Room.find(query).populate('game').exec();
    }

    //categorize today's rooms for specified gamer (user, friend, org, pub)
    function _CategorizeGamerRooms(gamer: IGamer, rooms: IRoom[]) {
        let gamerRooms: any = {};
        gamerRooms.usr = [];
        gamerRooms.fnd = [];
        gamerRooms.org = [];
        gamerRooms.pub = [];

        rooms.forEach(room => {
            let players = _.map(room.players, p => p.gamer);

            if (players.length > 0) {
                //add your rooms
                if (players.indexOf(gamer._id) >= 0) {
                    gamerRooms.usr.push(room);
                } else {
                    //add friend rooms
                    let friendsInRoom = _.intersectionWith(players, gamer.friends, _.isEqual);
                    if (!_.isEmpty(friendsInRoom)) {
                        gamerRooms.fnd.push(room);
                    }
                    //add network rooms
                    else if (room.org && gamer.orgs.indexOf(room.org) >= 0) {
                        gamerRooms.org.push(room);
                    }
                    //add pub rooms w/ active game
                    else if (gamer.gamesPreferred.indexOf(room.game) >= 0) {
                        gamerRooms.pub.push(room);
                    }
                }
            }
        });
        return gamerRooms;
    }

    /**
     * candidates data format:
     * {
        start: 40, end: 50,
        games
			"asdfa-sf-dfadf-dfsdff" = 
                [0] = {gamerId: "asfadgdsg", username: "bob", avatarUrlSm: "http://asdf.png", friend: true, org: false, availsArr: [42, 43, 320]}
				[1] = {gamerId: "fdgsdbdfg", username: "john", avatarUrlSm: "http://asdf.png", friend: false, org: true, availsArr: [42, 43, 320], roomId: "fhdfghdfg", startr: 42, endr: 44}
        }
    */
    function _SendAvailResponseEmail(utcDayIndex: number, user: IUser, gamer: IGamer, gamesLookup: any, candidates: any, gamerRooms: any, emailOverride: string = null): Promise<Object> {

        let targetDate = _GetTargetDate(utcDayIndex);
        // let offset: number = tzutil.LocalTimeInc30Offset(user.timezone, targetDate);
        let subject = `[RUIn] Games your friends are playing today`;
        //let motd = _.sample(['Matching you with awesome']);
        let template = swig.compileFile(__dirname + '/templates/massmail/avail-response-email.html');

        //get the email html body
        let html = '';

        html += _GetEmailHtml_AllRooms(gamerRooms, user.timezone);

        gamer.gamesPreferred.forEach( pgameId => {
            let game = gamesLookup[pgameId.toString()];
            let gameCandidates = candidates.games[pgameId.toString()];

            if (gameCandidates && gameCandidates.length > 0) {
                html += _GetEmailHtml_Games(user, game, gameCandidates, candidates.start, candidates.end);
            }
        });

        let emailHTML = template({
            domain: (<any>Config.app).api || Config.app.realm,
            emailBody: () => { return html; },
            appName: Config.app.title,
            username: gamer.username
        });

        return new Promise((resolve: any, reject: any) => {
            Mailer.SendMail(emailOverride || user.email, subject, emailHTML, (err: Error, results: string) => {
                if (err) {
                    let errMsg = 'Error_avail_response_email to ' + user.email + '[' + user.username + ']';
                    resolve(errMsg);
                }
                resolve(user.username + ': ' + user.email);
            });
        });
    }

    function _GetEmailHtml_Games(user: IUser, game: IGame, gameCandidates: any, start: number, end: number) {
        let createRoomUrl = Config.app.realm + '/#/dashboard/week?gameId=' + game.id;
        let html = `
            <div class="container">
                <div style="vertical-align: middle; width: 510px;">
                    <div style="height: 50px; margin: 0px 15px 5px 10px; display: inline-block; width: 300px">
                        <img class="game-image" src="` + game.iconSm + `" alt=""> 
                        <span style="width: 80%; font-size: 12px; color: #F09586">
                            <b>` + game.name + `</b>
                        </span>
                    </div>
                    <div style="float: right; padding-top: 10px;">
                        <a class="button" href="` + createRoomUrl + `">Check Avail</a>
                    </div>
                </div>
                ` + _GetEmailHtml_Candidates(user, gameCandidates, start, end) + `
            </div>
            `;
        return html;
    };

    function _GetEmailHtml_Candidates(user: IUser, gameCandidates: any, start: number, end: number) {
        let html = '';
        let startHourBase = moment().startOf('day').add(start * 30, 'minutes');
        let prefgameIcon = '<span style="color:orange;">★</span>';

        let isAvail = (availsArr: number[], indicator: number) => {
            if (indicator > 335) { indicator -= 335; } //if indicator is past 11:30pm Sat, roll over to sunday
            if (availsArr.indexOf(indicator) >= 0) { return 'avail-line'; } else { return 'base-line'; }
        };

        let isPrefGame = (isPrefGame: boolean) => {
            if (isPrefGame)
                return prefgameIcon;
            else
                return '';
        };

        gameCandidates.forEach( (gameCandidate: any) => {
            let startHour = timezone(startHourBase).tz(user.timezone); //copy startHourBase so add won't change value next iteration

            let categoryType: string = '';
            if (gameCandidate.friend)
                categoryType = 'fnd';
            else if (gameCandidate.org)
                categoryType = 'org';
            else
                categoryType = 'pub';

            html += `
            <div style="width: 100%; margin-left: 20px;">
                <div style="display: inline-block; margin-right: 5px; width: 140px; white-space: nowrap;">
                    <img class="candidate-image ` + categoryType + `" src="` + gameCandidate.avatarUrlSm + `" alt="">
                    <span style="font-size: 12px;">
                        <b>` + gameCandidate.username + `</b>
                        ` + isPrefGame(gameCandidate.ispreferred) + `
                    </span>
                </div>
                <div style="display: inline-block; width: 340px;">
                    <div>
                        <span class="time-indicator">` + startHour.add(0, 'hour').format('hha') + `</span>
                        <span class="time-indicator">` + startHour.add(1, 'hour').format('hha') + `</span>
                        <span class="time-indicator">` + startHour.add(1, 'hour').format('hha') + `</span>
                        <span class="time-indicator">` + startHour.add(1, 'hour').format('hha') + `</span>
                        <span class="time-indicator">` + startHour.add(1, 'hour').format('hha') + `</span>
                    </div>
                    <div style="display: table; width: 100%;">
                        <span class="` + isAvail(gameCandidate.availsArr, start + 0) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 1) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 2) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 3) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 4) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 5) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 6) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 7) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 8) + `"></span>
                        <span class="` + isAvail(gameCandidate.availsArr, start + 9) + `"></span>
                    </div>
                </div>
            </div>
                `;
        });

        return html;
    };

    function _GetEmailHtml_AllRooms(gamerRooms: any, userTimezone: string) {

        let html = '';

        if (gamerRooms.usr.length > 0) {
            html += _GetEmailHtml_Rooms(gamerRooms.usr, 'usr', userTimezone);
        }
        if (gamerRooms.fnd.length > 0) {
            html += _GetEmailHtml_Rooms(gamerRooms.fnd, 'fnd', userTimezone);
        }
        if (gamerRooms.org.length > 0) {
            html += _GetEmailHtml_Rooms(gamerRooms.org, 'org', userTimezone);
        }
        if (gamerRooms.pub.length > 0) {
            html += _GetEmailHtml_Rooms(gamerRooms.pub, 'pub', userTimezone);
        }

        //wrap everything in a container if there's at least one room
        if (html.length > 0) {
            html = `
            <div class="container">
                <div style="font-size: 14px;">Upcoming Games to Join<p></div>
                ` + html + `</div>`;
        }

        return html;
    }

    function _GetEmailHtml_Rooms(gamerRooms: IRoom[], roomCategory: string, userTimezone: string) {

        let html = '';

        gamerRooms.forEach((room: IRoom) => {
            let game: any = room.game;
            let roomTime: string;

            if (room.isRepeat) {
                //find next upcoming repeat
                let nextDate: Date = RoomsController.FindNextSeriesOccurrence(room);
                nextDate = timezone(nextDate).hours(room.startTime.getUTCHours()).minutes(room.startTime.getUTCMinutes()).toDate();
                roomTime = timezone(nextDate).tz(userTimezone).format('ddd h:mma');
            } else {
                roomTime = timezone(room.startTime).tz(userTimezone).format('M/DD h:mma');
            }

            html += `
            <a href="` + Config.app.realm + `/#/rooms/` + room._id.toString() + `">
            <div class="game-tile ` + roomCategory + `">
                <div style="float:left;">
                    <img class="game-image" src="` + game.iconSm + `"> 
                </div>
                <div class="info">
                    <div>
                        <div class="overflow-text game-left" style="color: #F09586">` + game.name + `</div>
                        <div class="overflow-text game-right">` + roomTime + `</div>
                    </div>
                    <div class="overflow-text">` + room.gameMode + `</div>
                    <div>
                        <div class="overflow-text game-left">` + room.hostUsername + `</div>
                        <div class="overflow-text game-right">` + room.players.length + `/` + room.maxPlayers + `</div>
                    </div>
                </div>
            </div>
            </a>`;
        });
        return html;
    }


}
