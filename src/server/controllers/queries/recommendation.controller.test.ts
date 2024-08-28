'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as moment from 'moment';
//import * as timezone from 'moment-timezone';
let timezone = require('moment-timezone');
import {IGamer, Gamer} from '../../models/gamer.model';
import {IOrg, Org} from '../../models/org.model';
import {IRoom, IPlayer, Room} from '../../models/room.model';
import {IGame, Game} from '../../models/game.model';
import {IUser} from '../../models/user.model';
import {QueryRecommendationController} from '../../controllers/queries/recommendation.controller';
import {TestData} from '../test/testdata';

let req: express.Request;
let res: express.Response;
let errHandler = (err: Error) => {if (err) {console.log(err); } };

let room: IRoom;
let user: IUser;

describe('Testing Recommendation Controllers', function() {

    this.timeout(0); //remove timeout for debugging purposes

    //init test objects
    before((done: Function) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            }
            room = testdata.room[0];
            user = testdata.user1[0];
            done(err);
        });
    });

    describe('Recommendation Controller', function() {
        it('should return recommendations for a friend and an org', function(done: Function) {
            room.privacyLevel = 5; //set to allow public matching
            QueryRecommendationController._GetRoomCandidates(room, user._id, user.timezone, room.startTime.getUTCDay()).then( (results: any) => {
                expect(results.friends.length, 'should have 1 friend match').to.equal(1);
                expect(results.org.length, 'should have 2 org match').to.equal(2);
                expect(results.pub.length, 'should have 1 pub match').to.equal(1);
                done();
            });
        });

        it('should return a score of 2 if time overlap is >= 60 min', function(done: Function) {
            QueryRecommendationController._GetRoomCandidates(room, user._id, user.timezone, room.startTime.getUTCDay()).then( (results: any) => {
                expect(results.friends[0].compat.score, 'score should be 2 (very compatible)').to.equal(2);
                done();
            });
        });

        it('should return a score of 1 if time overlap is < 60 min', function(done: Function) {
            // move the room's start time to +30 min
            room.startTime = moment(room.startTime).add(30, 'minutes').toDate();
            QueryRecommendationController._GetRoomCandidates(room, user._id, user.timezone, room.startTime.getUTCDay()).then( (results: any) => {
                expect(results.friends[0].compat.score, 'score should be 1 (somewhat compatible)').to.equal(1);
                done();
            });
        });

        it('should return a score of 0 if time overlap is < 60 min and candidate is 60 min late', function(done: Function) {
            // move the room's start time to +60 min
            room.startTime = moment(room.startTime).add(60, 'minutes').toDate();
            QueryRecommendationController._GetRoomCandidates(room, user._id, user.timezone, room.startTime.getUTCDay()).then( (results: any) => {
                expect(results.friends[0].compat.score, 'score should be 0 (not compatible)').to.equal(0);
                done();
            });
        });


        // it('should match a gamer to rooms for user, friends, orgs', function(done) {
        //     QueryDashboardController._GetUserDashboard('bob', dateFilter, 0, offset, (err: any, dashquery: DashboardRooms) => {
        //         let result = dashquery.toJSON();
        //         expect(dashquery, 'dashboard results should not be null').to.not.equal(null);
        //         if (dashquery) {
        //             expect(dashquery.roomGroups[0].userRooms.length, 'query should have matched 1 assigned user room').to.equal(1);
        //             expect(dashquery.roomGroups[0].friendRooms.length, 'query should have matched 1 assigned friend room').to.equal(1);
        //             expect(dashquery.roomGroups[0].orgRooms.length, 'query should have matched 0 assigned org room').to.equal(0); //removes dupes from friends
        //             expect(dashquery.roomGroups[0].pubRooms.length, 'query should have matched 0 assigned pub room').to.equal(0); //removes dupes from friends
        //         }
        //         done();
        //     });
        // });

        // it('should match a gamer to rooms for user, friends, orgs if game filter is set to 1', function(done) {
        //     QueryDashboardController._GetUserDashboard('bob', dateFilter, 1, offset, (err: any, dashquery: DashboardRooms) => {
        //         expect(dashquery, 'dashboard results should not be null').to.not.equal(null);
        //         if (dashquery) {
        //             expect(dashquery.roomGroups[0].userRooms.length, 'query should have matched 1 assigned user room').to.equal(1);
        //             expect(dashquery.roomGroups[0].friendRooms.length, 'query should have matched 1 assigned friend room').to.equal(1);
        //             expect(dashquery.roomGroups[0].orgRooms.length, 'query should have matched 0 assigned org room').to.equal(0); //removes dupes from friends
        //         }
        //         done();
        //     });
        // });
    });


});
