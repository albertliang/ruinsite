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
import {QuerySuggestionsController} from '../../controllers/queries/suggestions.controller';
import {TestData} from '../test/testdata';
import * as tzutil from '../../util/timezone';

let req: express.Request;
let res: express.Response;

let gamer1: IGamer;
let dateFilter: Date = moment(tz.tz('UTC')).startOf('day').toDate();
let timezone = 'America/New_York';
let offset: number = tzutil.LocalTimeInc30Offset(timezone, dateFilter);
let errHandler = (err: Error) => {if (err) {console.log(err); } };

describe('Testing Suggestions Controllers', function() {

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

    describe('Suggestions Querying', function() {
        it.only('should suggest creating a room ', function(done: Function) {
            QuerySuggestionsController._GetUserSuggestions('bob', dateFilter, timezone, (err: any, availResults: any) => {
                expect(availResults, 'suggestion results should not be null').to.not.equal(null);
                if (availResults) {
                    expect(Object.keys(availResults.candidatesLookup).length, 'query should have 4 candidates in lookup').to.equal(4);
                    expect(availResults.rooms[Object.keys(availResults.rooms)[0]].length, 'query should have matched 2 timeslots on the first day').to.equal(2);
                }
                done();
            });
        });

    });

});
