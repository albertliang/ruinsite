'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as moment from 'moment';
//import * as timezone from 'moment-timezone';
let tz = require('moment-timezone');
import {IGamer, Gamer} from '../../models/gamer.model';
import {IOrg, Org} from '../../models/org.model';
import {IRoom, IPlayer, Room} from '../../models/room.model';
import {IGame, Game} from '../../models/game.model';
import {DashboardWeekRooms} from '../../controllers/queries/dashboardweekrooms';
import {QueryDashboardWeekController} from '../../controllers/queries/dashboard.week.controller';
import {TestData} from '../test/testdata';
import * as tzutil from '../../util/timezone';

let req: express.Request;
let res: express.Response;

let gamer1: IGamer;
let dateFilter: Date = moment(tz.tz('UTC')).startOf('day').toDate();
let timezone = 'America/New_York';
let offset: number = tzutil.LocalTimeInc30Offset(timezone, dateFilter);
let errHandler = (err: Error) => {if (err) {console.log(err); } };

describe('Testing Dashboard Week Controllers', function() {

    this.timeout(0); //remove timeout for debugging purposes

    //init test objects
    before((done: Function) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            }
            gamer1 = testdata.gamer1[0];
            done(err);
        });
    });

    describe('Dashboard Querying', function() {
        it('should match a gamer to rooms for user, friends, orgs', function(done: Function) {
            QueryDashboardWeekController._GetUserDashboard('bob', dateFilter, 0, offset, timezone, (err: any, dashquery: DashboardWeekRooms) => {
                let result = dashquery.toJSON();
                expect(dashquery, 'dashboard results should not be null').to.not.equal(null);
                if (dashquery) {
                    expect(dashquery.dayRoomGroups[0][0].userRooms.length, 'query should have matched 1 assigned user room').to.equal(1);
                    expect(dashquery.dayRoomGroups[0][0].friendRooms.length, 'query should have matched 1 assigned friend room').to.equal(1);
                    expect(dashquery.dayRoomGroups[0][0].orgRooms.length, 'query should have matched 0 assigned org room').to.equal(0); //removes dupes from friends
                    expect(dashquery.dayRoomGroups[0][0].pubRooms.length, 'query should have matched 0 assigned pub room').to.equal(0); //removes dupes from friends
                }
                done();
            });
        });

        it('should match a gamer to rooms for user, friends, orgs if game filter is set to 1', function(done: Function) {
            QueryDashboardWeekController._GetUserDashboard('bob', dateFilter, 1, offset, timezone, (err: any, dashquery: DashboardWeekRooms) => {
                expect(dashquery, 'dashboard results should not be null').to.not.equal(null);
                if (dashquery) {
                    expect(dashquery.dayRoomGroups[0][0].userRooms.length, 'query should have matched 1 assigned user room').to.equal(1);
                    expect(dashquery.dayRoomGroups[0][0].friendRooms.length, 'query should have matched 1 assigned friend room').to.equal(1);
                    expect(dashquery.dayRoomGroups[0][0].orgRooms.length, 'query should have matched 0 assigned org room').to.equal(0); //removes dupes from friends
                }
                done();
            });
        });
    });

});
