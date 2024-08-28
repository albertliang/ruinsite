'use strict';

/*
Populates gamers/games/orgs/rooms collections with test database
node build/server/junkdata/miniseed.js
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
//let db = mongoose.connect('mongodb://ruin-test:!Ruin!@ds013212.mlab.com:13212/ruin-test');
//let db = mongoose.connect('mongodb://ruin-production:!s3cretM1ssion!@ds049216-a0.mlab.com:49216/heroku_v1630gzb');
let db = mongoose.connect('mongodb://localhost:27017/ruin-dev');
process.env.TZ = 'UTC';


let _orgIds: mongoose.Types.ObjectId[] = [], _gamersIds: mongoose.Types.ObjectId[] = [], _roomsIds: mongoose.Types.ObjectId[] = [];
let _games: any[] = [], _orgs: IOrg[] = [], _rooms: any[] = [], _gamers_with_usernames: any = [], gamers: any[] = [], users: any[] = [];

function genId(index: number) {
    let baseId = '9999999999999999999aaaaa';
    let newId = baseId.substr(0, (baseId.length - index.toString().length)) + index.toString();
    return new mongoose.Types.ObjectId(newId);
}

_orgIds = [new mongoose.Types.ObjectId('999999999999999999999999')];
_.times(10, (index: number) => {
    _gamersIds.push(genId(index));
});
_.times(500, (index: number) => {
    _roomsIds.push(genId(index));
});

async.waterfall([
    function(next: Function) {
        //drops existing collections
        async.parallel([
            //(cb: any) => {Game.remove({}, cb); },
            (cb: any) => {Gamer.remove({_id: {$in: _gamersIds}}, cb); },
            (cb: any) => {Org.remove({_id: {$in: _orgIds}}, cb); },
            (cb: any) => {Room.remove({_id: {$in: _roomsIds}}, cb); },
            (cb: any) => {User.remove({_id: {$in: _gamersIds}}, cb); },
        ], (err: Error, results: any) => {
            console.log('all collections dropped');
            next();
        });
    },

    function (next: Function) { //ONLY USE THOSE GAMES THAT HAVE ICON DATA POPULATED
        Game.find({iconLg: {$exists: true}}, (err: Error, games: IGame[]) => {
            _games = games;
            next(err);
        });
    },
    function (next: Function) { //CREATE ORGS
        let org = new Org({
            _id: _orgIds[0],
            name: 'Tester\'s Union',
            description: 'We\'re a dedicated group of virtual testers who are created and destroyed with reckless abandon by our cruel developers',
            url: 'http://ruingaming.io',
            isOpen: false
        });
        _orgs.push(org);
        console.log('created orgs', _orgIds.length);
        org.save((err, results) => {next(err); });
    },
    function (next: Function) { //CREATE GAMERS
        let startDate = moment.tz('UTC').startOf('day');
        let index: number = 0;

        //represents 15min increments from midnight, ie: 0=12am, 2=12:30am, 5=1:15am, 48=12pm, 95=11:45pm
        _gamersIds.forEach( gamerId => {
            let gamerGames = _.sampleSize(_games, 50);
            let gamer = new Gamer({
                _id: gamerId,
                username: 'ruintester' + index,
                games: gamerGames,
                gamesPreferred: _.sampleSize(gamerGames, 5),
                orgs: _.sampleSize(_orgIds, _.random(_orgIds.length)),
                friends: _.sampleSize(_gamersIds, 5),
                avails: [
                    {
                        '3' : true,
                        '4' : true,
                        '5' : true,
                        '6' : true,
                        '7' : true,
                        '44' : true
                    }, {}, {}, {}, {}, {}, {}],

                avail: {
                    'general': [{ 'dayOfWeek': _.random(0, 6), 'startTimeInc15': _.random(0, 95), 'duration': 60 }],
                    'specific': [{ 'startDate': startDate, 'startTimeInc15' : _.random(0, 95), 'duration': 60 }]
                },
                updateTS: startDate
            });
            gamers.push(gamer);
            _gamers_with_usernames.push({
                gamer: gamer._id,
                username: gamer.username,
                isCommitted: true
            });
            index++;
        });

        async.each(gamers, function (gamer: IGamer, cb: any) {
            gamer.save(function (err: Error) {
                cb(err);
            });
        }, function (err: Error) { //CREATE ROOMS
            console.log('created gamers', _gamersIds.length);

            async.forEach(_roomsIds, function (roomId: number, cb: Function) {
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

                let startDate = moment().tz('America/New_York').startOf('day');
                startDate.add(_.random(0, 30), 'days');
                //let startDate = moment('2016' + monthString + dayString, 'YYYYMMDD').tz('America/New_York').startOf('day');
                //let startDate = moment().tz('America/New_York').startOf('day');
                startDate.add(Math.floor(inc15 / 4), 'hours');
                startDate.add((inc15 % 4)  * 15, 'minutes');

                //console.log('startDate', startDate.toString());

                let players = _.sampleSize(_gamers_with_usernames, 4);
                let selectedOrg: IOrg = _.sample(_orgs);

                let room = new Room({
                    _id: roomId,
                    game: _.sample(_games),
                    org: selectedOrg._id,
                    orgName: selectedOrg.name,
                    host: players[0].gamer,
                    gameMode: _.sample(['Capture the Flag', 'Custom Game', 'TDM', 'Co-op vs AI', 'Up to the group']),
                    hostUsername: players[0].username,
                    hostTimezone: 'America/New_York',
                    joinServer: 'http://ruingaming.io/',
                    isLocked: false,
                    privacyLevel: 4,
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
        let index = 0;

        _gamersIds.forEach( gamerId => {
            let gamer = gamers[index];
            let user = new User({
                _id: gamer._id,
                username: gamer.username,
                email: 'junk@junk.com' + index,
                timezone: _.sample(tz, 1),
                password: 'password',
                salt: 'secret',
                provider: 'local',
                roles : ['user'],
                updated: Date.now(),
                created: Date.now(),
                emailIsVerified: false
            });
            users.push(user);
            index++;
        });

        async.each(users, function (user: IUser, cb: any) {
            user.save(function (err: Error) {
                cb(err);
            });
        },
        function (err: Error) {
            console.log('created users', _gamersIds.length);
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
