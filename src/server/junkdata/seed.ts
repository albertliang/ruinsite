'use strict';

/*
Populates gamers/games/orgs/rooms collections with test database
WILL WIPE YOUR EXISTING COLLECTIONS FIRST!!!!!
*/
import * as mongoose from 'mongoose';
let _ = require('lodash');
let async = require('async');
let util = require('../util/util');
let moment = require('moment-timezone');

import {IGamer, Gamer} from '../models/gamer.model';
import {IUser, User} from '../models/user.model';
import {IGame, Game} from '../models/game.model';
import {IOrg, Org} from '../models/org.model';
import {IRoom, Room} from '../models/room.model';

//TARGET IS DEV DB
//let db = mongoose.connect('mongodb://ruin-test:!Ruin!@ds013212.mlab.com:13212/ruin-test' || 'mongodb://localhost:27017/ruin-dev');
let db = mongoose.connect('mongodb://localhost:27017/ruin-dev');
process.env.TZ = 'UTC';

//let gameData = require('./game.json');
let orgData = require('./org.json');

let _games: any = [], _orgs: IOrg[] = [], _orgIds: any = [], _gamers: any = [], _rooms: any = [], _gamers_with_usernames: any = [], gamers: any = [], users: any = [];

//setting steamId for first gamer so we can import steam games and populate some game information that's otherwise missing
let steamgamer = new Gamer({
    username: 'steamGuy',
    platforms: { steamId: '76561197983305443'},
});

async.waterfall([
    function(next: Function) {
        //drops existing collections
        async.parallel([
            (cb: any) => {Game.remove({}, cb); },
            (cb: any) => {Gamer.remove({}, cb); },
            (cb: any) => {Org.remove({}, cb); },
            (cb: any) => {Room.remove({}, cb); },
            (cb: any) => {User.remove({}, cb); }
        ], (err: Error, results: any) => {
            console.log('all collections dropped');
            next();
        });
    },
    function (next: Function) { //CREATE GAMES
        let searchParams = {tags: ['action', 'strategy']}; //this reduces the resultset

        // SteamImportAPI.SyncGamesList(searchParams).then( (results: any) => {
        //     console.log('created games', results.length);
        //     next();
        // })
        // .catch( (err: Error) => {
        //     console.error('steam game import functionality has failed');
        //     next(err);
        // });
    },
    function (next: Function) { //SAVE INITIAL STEAM GAMER FOR IMPORT PURPOSES
        steamgamer.save(next());
    },
    function (next: Function) { // import first user's games from steam
        // SteamImportAPI.SyncUserGames(steamgamer)
        //     .then((results: any) => {
        //         //console.log('games updated: ', results.gamesUpdated);
        //         next(); })
        //     .catch((err: Error) => {
        //         next(err);
        //     });
    },
    function (next: Function) { //ONLY USE THOSE GAMES THAT HAVE ICON DATA POPULATED
        Game.find({iconLg: {$exists: true}}, (err: Error, games: IGame[]) => {
            _games = games;
            next(err);
        });
    },
    function (next: Function) { //CREATE ORGS
        async.each(orgData, function (data: any, cb: any) {
            let org = new Org(data);
            _orgs.push(org);
            _orgIds.push(org._id);
            org.save(cb);
        }, function (err: Error) {
            console.log('created orgs', _orgIds.length);
            next(err);
        });
    },
    function (next: Function) { //CREATE GAMERS
        let startDate = moment.tz('UTC').startOf('day');

        //represents 15min increments from midnight, ie: 0=12am, 2=12:30am, 5=1:15am, 48=12pm, 95=11:45pm
        _.times(10, function (index: number) {
            let gamerGames = _.sampleSize(_games, _.random(2, _games.length));
            let gamer = new Gamer({

                username: 'randomGuy' + index,
                platforms: { 'steamName': 'randomGuy' + index + '_Alias' },
                games: gamerGames,
                gamesPreferred: gamerGames,
                orgs: _.sampleSize(_orgIds, _.random(_orgIds.length)),
                friends: _.sampleSize(_gamers, 20),
                avail: {
                    'general': [{ 'dayOfWeek': _.random(0, 6), 'startTimeInc15': _.random(0, 95), 'duration': 60 }],
                    'specific': [{ 'startDate': startDate, 'startTimeInc15' : _.random(0, 95), 'duration': 60 }]
                },
                updateTS: startDate
            });
            let gamerId = gamer._id;
            _gamers.push(gamerId);
            gamers.push(gamer);
            _gamers_with_usernames.push({
                gamer: gamer._id,
                username: gamer.username,
                isCommitted: true
            });
        });

        async.each(gamers, function (gamer: IGamer, cb: any) {
            gamer.save(function (err: Error) {
                cb(err);
            });
        }, function (err: Error) { //CREATE ROOMS
            console.log('created gamers', _gamers.length);

            async.times(1000, function (id: number, cb: Function) {
                let inc15 = _.random(0, 95);
                let max = 30;
                let min = 1;
                let day = Math.floor(Math.random() * (max - min + 1)) + min;
                let dayString = day.toString();
                let month = new Date().getMonth() + 1;
                let monthString = month.toString();
                if (month < 10) {
                    monthString = '0' + month;
                }
                if (day < 10) {
                    dayString = '0' + day;
                }

                let startDate = moment('2016' + monthString + dayString, 'YYYYMMDD').tz('America/New_York').startOf('day');
                //let startDate = moment().tz('America/New_York').startOf('day');
                startDate.add(Math.floor(inc15 / 4), 'hours');
                startDate.add((inc15 % 4)  * 15, 'minutes');

                //console.log('startDate', startDate.toString());

                let players = _.sampleSize(_gamers_with_usernames, 4);
                let selectedOrg: IOrg = _.sample(_orgs);

                let room = new Room({
                    game: _.sample(_games),
                    org: selectedOrg._id,
                    orgName: selectedOrg.name,
                    host: new mongoose.Types.ObjectId(_.sample(players).gamer),
                    gameMode: 'Capture the Flag',
                    hostUsername: _.sample(_gamers_with_usernames).username,
                    joinServer: 'http://ruingaming.io/',
                    isLocked: false,
                    privacyLevel: _.random(5),
                    startTime: startDate,
                    duration: 60,
                    maxPlayers: 8,
                    players: players
                });
                _rooms.push(room);
                room.save(function (err: Error) {
                    cb(err);
                });
            }, function (err: Error) {
                next(err);
            });
        });
    },
    function (next: Function) { //CREATE USERS
        let tz = ['America/New_York'];

        _.times(10, function (index: number) {
            let gamer = gamers[index];
            //console.log('gamer.username', gamer._id);
            let user = new User({
                _id: gamer._id,
                username: gamer.username,
                email: 'junk@junk.com',
                timezone: _.sample(tz, 1),
                password: 'password',
                salt: 'secret',
                provider: 'local',
                roles : ['user'],
                updated: Date.now(),
                created: Date.now(),
                emailIsVerified: true
            });
            //console.log('gamer.username', user._id);
            users.push(user);
        });

        async.each(users, function (user: IUser, cb: any) {
            user.save(function (err: Error) {
                cb(err);
            });
        },
        function (err: Error) {
            console.log('created users', _gamers.length);
            next(err);
        });
    },
    function (next: Function) { //ADD ROOMS TO GAMERS
        async.each(_rooms, function (room: IRoom, cb: any) {
            let players = util.ConcatSubArrays(room.players, 'gamer');

            Gamer.updateMany({ '_id': { '$in': players } }, { '$addToSet': { 'rooms': room._id } }, { 'multi': true },
                (err, count) => {
                    cb(err);
                });
        },
        function (err: Error) {
            console.log('created rooms', _rooms.length);
            next(err);
        });
    },
    function (next: Function) { //ADD ROOMS TO ORGS
        async.each(_rooms, function (room: IRoom, cb: any) {
            if (!_.isEmpty(room.org)) {
                //for each room, get the org (if exists) and add the roomId to the org
                Org.updateOne({ '_id': room.org }, { '$addToSet': { 'rooms': room._id } },
                    (err: Error, count: number) => {
                        //console.log(count);
                        cb(err);
                    });
            }
            else { cb(null); }
        },
        function (err: Error) {
            next(err);
        });
    },
    function (next: Function) {  //ADD MEMBERS TO ORGS
        async.each(_orgIds, function (org: mongoose.Types.ObjectId, cb: any) {
            let orgmembers = gamers.filter((gamer: IGamer) => {
                if (gamer.orgs.indexOf(org) >= 0) { return true; }
                else { return false; }
            });

            let orgmemberIds = _.map(orgmembers, (om: any) => { return om._id; });

            Org.updateMany({ '_id': org }, { 'members': orgmemberIds }, { 'multi': true },
                (err: Error, count: any) => {
                    cb(err);
                });
        }, function (err: Error) {
            next(err);
        });
    },
    function (next: Function) { // ADD ALL STEAM GAMES INTO MASTER LIB

        // SteamImportAPI.SyncGamesList(null).then( (results: any) => {
        //     console.log('steam games imported: ', results.length);
        //     next();
        // })
        // .catch( (err: Error) => {
        //     next(err);
        // });
    },
    function (next: Function) { // REMOVE STEAMGUY NOW THAT WE'RE DONE WITH HIM
        steamgamer.remove((err: Error) => {
            next(err);
        });
    }
], function (err: Error) {
    if (err) {
        console.error(err);
    } else {
        console.log('population complete');
    }
    mongoose.disconnect();
    process.exit(0);
});
