'use strict';

import {expect} from 'chai';
import {User, IUser} from '../../models/user.model';
import {Gamer, IGamer} from '../../models/gamer.model';
import {MassMessage} from './mass-message';
import {Config} from '../../config/config';
import {TestData} from '../test/testdata';
import * as cleanup from '../test/testcleanup';
import * as moment from 'moment';
let timezone = require('moment-timezone');

let user: IUser;

describe('Mass Message Tests', function() {

    this.timeout(0);

    let today = moment(timezone.tz('UTC')).startOf('day').toDate();
    let dayOfWeek = today.getUTCDay();

    before((done: any) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            } else {
                return done();
            }
        });
    });

    it('should find a user and schedule a avail request email', function(done: any) {
        MassMessage.ScheduleAvailUsers(dayOfWeek, 0).then( (results: any) => {
            done();
        });
    });

    it('should find a user and send a avail response email', function(done: any) {
        MassMessage.SendAvailResponseEmails(dayOfWeek, 0).then( (results: any) => {
            done();
        });
    });

});