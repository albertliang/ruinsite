
// 'use strict';

// import {expect} from 'chai';
// import * as sinon from 'sinon';
// import * as mongoose from 'mongoose';
// import * as express from 'express';
// import * as cleanup from '../test/testcleanup';
// import {GamerAvailabilitiesController} from './gamers.availabilities.controller';
// import {IGamer, Gamer, IAvailability, IAvailabilityGeneral, IAvailabilitySpecific} from '../../models/gamer.model';
// import * as tzUtil from '../../util/timezone';
// let moment = require('moment-timezone');

// describe('Avail Controller Tests', function() {

//     this.timeout(0);

//     it('Create Specific Avail - 6/1/2016 12:00AM America/New_York => 6/1/2016 04:00AM UTC', function(done: Function) {
//         let avail: any = {startDate: new Date('2016-06-01'), startTimeInc15: 0, duration: 120};
//         let localStartDateTime = tzUtil.CalcDateTimeFromAvailSpecific(avail.startDate, avail.startTimeInc15);
//         avail.startTimeInc15 = tzUtil.LocalTimeInc15ToUTCTimeInc15('America/New_York', avail.startDate, avail.startTimeInc15);
//         avail.startDate = tzUtil.GetUtcMidnight('America/New_York', localStartDateTime);

//         expect(avail.startDate.getUTCDate(), 'startDate should be 6/1/2016').to.equal(1);
//         expect(avail.startTimeInc15, 'startTimeInc15 should be 16').to.equal(16);
//         done();
//     });

//     it('Create Specific Avail - 6/1/2016 11:00PM America/New_York => 6/2/2016 03:00AM UTC', function(done: Function) {
//         let avail: any = {startDate: new Date('2016-06-01'), startTimeInc15: 92, duration: 120};
//         let localStartDateTime = tzUtil.CalcDateTimeFromAvailSpecific(avail.startDate, avail.startTimeInc15);
//         avail.startTimeInc15 = tzUtil.LocalTimeInc15ToUTCTimeInc15('America/New_York', avail.startDate, avail.startTimeInc15);
//         avail.startDate = tzUtil.GetUtcMidnight('America/New_York', localStartDateTime);

//         expect(avail.startDate.getUTCDate(), 'startDate should be 6/2/2016').to.equal(2);
//         expect(avail.startTimeInc15, 'startTimeInc15 should be 12').to.equal(12);
//         done();
//     });

// });
