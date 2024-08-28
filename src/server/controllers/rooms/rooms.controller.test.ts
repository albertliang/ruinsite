
'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {IRoom, Room} from '../../models/room.model';
import {IUser, User} from '../../models/user.model';
import {IOrg, Org} from '../../models/org.model';
import {IGame} from '../../models/game.model';
import {RoomsController} from '../../controllers/rooms/rooms.controller';
import * as moment from 'moment';
//import * as timezone from 'moment-timezone';
let timezone = require('moment-timezone');
import {TestData} from '../test/testdata';

let room: IRoom;
let user: IUser;
let game: IGame;

describe('Rooms Controller Tests', function() {

    this.timeout(0);

    before((done) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            }
            room = testdata.room[0];
            user = testdata.user1[0];
            game = testdata.game[0];
            done(err);
        });
    });

    it('should correctly calc the startTimeInc30 value', function(done) {
        let time = room.startTime;
        let expectedTimeInc30 = (time.getUTCHours() * 2) + Math.floor(time.getMinutes() / 30);
        expect(room.startTimeInc30).to.equal(expectedTimeInc30);
        done();
    });

    it('should refuse to update if not authorized', function(done) {
       room.description = 'new description';
       let fakeUserId = new mongoose.Types.ObjectId();
       RoomsController._Update(room, user, (err: Error, result: IRoom) => {
           expect(err.message).to.equal('user_not_authorized');
           done();
       });
    });

    it('if org was added to the room, add the room to org', function(done) {
        let room2 = new Room({
            game: room.game,
            org: room.org,
            host: room.host,
            gameMode: 'mode',
            description: 'new room',
            hostUsername : 'bob',
            startTime: room.startTime,
            players: []
        });

        RoomsController._Create(room2, user, (err: Error, roomCreated: IRoom) => {
            Org.findOne({_id: roomCreated.org}, (err: Error, org: IOrg) => {
                expect(org.rooms.indexOf(room2._id)).to.be.greaterThan(-1, 'could not find the newly created room in the attached org');
                done();
            } );
        });
    });

    it.skip('should convert an html template to an image on AWS S3', function(done) {
        game.name = 'Gears of War 4';
        game.iconLg = 'https://images.igdb.com/igdb/image/upload/t_cover_small/vo0k42jaombqazz5m12j.jpg'; //gears4
        //game.iconLg = 'http://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/359550/f63c9c7d6f92d2c33d6b8c4b5abf04db1e4c2a2b.jpg';
        room.gameMode = 'Horde Mode';
        room.description = 'Plan on staying until Wave 50!';
        room.maxPlayers = 5;
        room.players[0].avatarUrlSm = 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/b5/b52c3a37d6072debd742f1b1a218adcfb5d5cd7e.jpg';
        let p3 = {'username': 'mittromney', 'gamer': new mongoose.Types.ObjectId(), 'isCommitted': true, avatarUrlSm: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/b5/b52c3a37d6072debd742f1b1a218adcfb5d5cd7e.jpg'};
        let p4 = {'username': 'marcorubio', 'gamer': new mongoose.Types.ObjectId(), 'isCommitted': true, avatarUrlSm: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/b5/b52c3a37d6072debd742f1b1a218adcfb5d5cd7e.jpg'};
        let p5 = {'username': 'jebbush', 'gamer': new mongoose.Types.ObjectId(), 'isCommitted': true, avatarUrlSm: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/b5/b52c3a37d6072debd742f1b1a218adcfb5d5cd7e.jpg'};
        room.players.push(p3);
        room.players.push(p4);
        room.players.push(p5);

        RoomsController._GenerateRoomImage(room, game, (err: Error, results: any) => {
            console.log(results);
            done();
        });
    });

});
