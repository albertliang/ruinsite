'use strict';

import * as mongoose from 'mongoose';
import * as moment from 'moment';
//import * as timezone from 'moment-timezone';
let timezone = require('moment-timezone');
import {IGamer, Gamer} from '../../models/gamer.model';
import {IUser, User} from '../../models/user.model';
import {IOrg, Org} from '../../models/org.model';
import {IRoom, IPlayer, Room} from '../../models/room.model';
import {IGame, Game} from '../../models/game.model';
import * as cleanup from './testcleanup';
let async = require('async');

export namespace TestData {

    export function ClearAndCreateTestData(callback: Function) {
        let user1: IUser, user2: IUser, user1Friend: IUser, user1Org: IUser, user2DiffGameOrg: IUser, userPublic: IUser;
        let gamer1: IGamer, gamer2: IGamer, gamer1Friend: IGamer, gamer1Org: IGamer, gamer2DiffGameOrg: IGamer, gamerPublic: IGamer;
        let game: IGame, game2: IGame;
        let room: IRoom;
        let org: IOrg;
        let today = moment(timezone.tz('UTC')).startOf('day').toDate();
        let now = moment(timezone.tz('UTC')).toDate();
        let errHandler = (err: Error) => {if (err) {console.log(err); } };

        game = new Game({
            gameId: 'game1',
            platformId: 'steam',
            name: 'game1 long name',
            iconSm: 'https://images.igdb.com/igdb/image/upload/t_cover_small/iyydljzdli44mdiyaeva.jpg'
        });

        game2 = new Game({
            gameId: 'game2',
            platformId: 'steam',
            name: 'game2 long name',
        });

        gamer1 = new Gamer({
            username: 'bob',
            games: [game._id],
            gamesPreferred: [game._id],
            friends: [],
        });
        let baseDay = today.getUTCDay() * 48;
        gamer1.avails[today.getUTCDay()]['0'] = true;
        gamer1.avails[today.getUTCDay()]['1'] = true;
        gamer1.availsArr = [baseDay, baseDay + 1];
        gamer1.hasAvail = true;

        gamer2 = new Gamer({
            username: 'dole',
            games: [game._id],
            friends: [gamer1._id],
        });
        gamer2.avails[today.getUTCDay()]['0'] = true;
        gamer2.avails[today.getUTCDay()]['1'] = true;
        gamer2.availsArr = [baseDay, baseDay + 1];
        gamer2.hasAvail = true;

        gamer1Friend = new Gamer({
            username: 'mittromney',
            games: [game._id],
            friends: [gamer1._id],
        });
        gamer1Friend.avails[today.getUTCDay()]['0'] = true;
        gamer1Friend.avails[today.getUTCDay()]['1'] = true;
        gamer1Friend.availsArr = [baseDay, baseDay + 1];
        gamer1Friend.hasAvail = true;

        gamer1Org = new Gamer({
            username: 'chrischristie',
            games: [game._id],
            friends: [],
        });
        gamer1Org.avails[today.getUTCDay()]['0'] = true;
        gamer1Org.avails[today.getUTCDay()]['1'] = true;
        gamer1Org.availsArr = [baseDay, baseDay + 1];
        gamer1Org.hasAvail = true;

        gamer2DiffGameOrg = new Gamer({
            username: 'bencarson',
            games: [game2._id],
            friends: [],
        });
        gamer2DiffGameOrg.avails[today.getUTCDay()]['0'] = true;
        gamer2DiffGameOrg.avails[today.getUTCDay()]['1'] = true;
        gamer2DiffGameOrg.availsArr = [baseDay, baseDay + 1];
        gamer2DiffGameOrg.hasAvail = true;

        gamerPublic = new Gamer({
            username: 'tedcruz',
            games: [game._id],
            gamesPreferred: [game._id],
            friends: [],
        });
        gamerPublic.avails[today.getUTCDay()]['0'] = true;
        gamerPublic.avails[today.getUTCDay()]['1'] = true;
        gamerPublic.availsArr = [baseDay, baseDay + 1];
        gamerPublic.hasAvail = true;

        user1 = new User({_id: gamer1._id, username: 'bob', email: 'albert@ruingaming.io', timezone: 'America/New_York', roles: ['user'], orgsRequests: [], emailIsVerified: true});
        user2 = new User({_id: gamer2._id, username: 'dole', email: 'albert1@ruingaming.io', timezone: 'America/New_York', roles: ['user'], orgsRequests: [], emailIsVerified: true});
        user1Friend = new User({_id: gamer1Friend._id, username: 'mittromney', email: 'albert2@ruingaming.io', timezone: 'America/New_York', roles: ['user'], orgsRequests: [], emailIsVerified: true});
        user1Org = new User({_id: gamer1Org._id, username: 'chrischristie', email: 'albert3@ruingaming.io', timezone: 'America/New_York', roles: ['user'], orgsRequests: [], emailIsVerified: true});
        user2DiffGameOrg = new User({_id: gamer2DiffGameOrg._id, username: 'bencarson', email: 'albert4@ruingaming.io', timezone: 'America/New_York', roles: ['user'], orgsRequests: [], emailIsVerified: true});
        userPublic = new User({_id: gamerPublic._id, username: 'tedcruz', email: 'albert5@ruingaming.io', timezone: 'America/New_York', roles: ['user'], orgsRequests: [], emailIsVerified: true});

        org = new Org({
            name: 'orgName',
            description: 'org description',
            host: gamer1._id,
            rooms: [],
            admins: [],
            members: []
        });

        room = new Room({
            game: game._id,
            org: org._id,
            host: gamer1._id,
            gameMode: 'TDM',
            description: 'room description',
            hostUsername : 'bob',
            hostTimezone : 'America/New_York',
            startTime: moment(today).add(15, 'minutes'),
            startTimeInc30: 0,
            duration: 60,
            players: []
        });

        gamer1.friends = [gamer2._id, gamer1Friend._id];
        gamer1.orgs = [org._id];
        gamer2.orgs = [org._id];
        gamer1Friend.friends = [gamer1._id];
        gamer1Org.orgs = [org._id];
        gamer2DiffGameOrg.orgs = [org._id];
        gamer1.rooms = [room._id];
        gamer2.rooms = [room._id];
        org.rooms = [room._id];
        org.admins = [gamer1._id];
        org.members = [gamer1._id, gamer1Org._id, gamer2DiffGameOrg._id];
        room.players = [{'username': 'bob', 'gamer': gamer1._id, 'isCommitted': true}, {'username': 'dole', 'gamer': gamer2._id, 'isCommitted': false}];

        cleanup.ClearCollections((err: Error) => {
            if (err) {
                callback(err);
            } else {
                async.parallel({
                    game: (cb: any) => {game.save(cb); },
                    org: (cb: any) => {org.save(cb); },
                    room: (cb: any) => {room.save(cb); },
                    user1: (cb: any) => {user1.save(cb); },
                    user2: (cb: any) => {user2.save(cb); },
                    user1Friend: (cb: any) => {user1Friend.save(cb); },
                    user1Org: (cb: any) => {user1Org.save(cb); },
                    user2DiffGameOrg: (cb: any) => {user2DiffGameOrg.save(cb); },
                    userPublic: (cb: any) => {userPublic.save(cb); },
                    gamer1: (cb: any) => {gamer1.save(cb); },
                    gamer2: (cb: any) => {gamer2.save(cb); },
                    gamer1Friend: (cb: any) => {gamer1Friend.save(cb); },
                    gamer1Org: (cb: any) => {gamer1Org.save(cb); },
                    gamer2DiffGameOrg: (cb: any) => {gamer2DiffGameOrg.save(cb); },
                    gamerPublic: (cb: any) => {gamerPublic.save(cb); },
                }, (err: Error, results: any) => {
                    callback(err, results);
                });
            }
        });
    }

}