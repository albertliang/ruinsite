'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as moment from 'moment';
let timezone = require('moment-timezone');
import * as tzutil from './timezone';

let dateFilter: Date = moment(timezone.tz('UTC')).startOf('day').toDate();
let tz: string = 'America/New_York';
let offset: number = tzutil.LocalTimeInc30Offset('America/New_York', dateFilter);


describe('Testing tzutil', function() {

    this.timeout(0); //remove timeout for debugging purposes

    it('Avail convert Sunday 12am EDT -> Sunday 5am UTC', function(done: Function) {
        let oldAvail: any[] = [{'0': true}, {}, {}, {}, {}, {}, {}];
        //set targetDate to a sunday
        let targetDate = new Date('3/5/2017');
        let newAvail = tzutil.OffsetGamerAvail(oldAvail, targetDate, true, tz);
        expect(newAvail[0]['10']).to.equal(true);
        done();
    });

    it('Avail convert Sunday 5am UTC -> Sunday 12am EDT', function(done: Function) {
        let oldAvail: any[] = [{'10': true}, {}, {}, {}, {}, {}, {}];
        //set targetDate to a sunday
        let targetDate = new Date('3/5/2017');
        let newAvail = tzutil.OffsetGamerAvail(oldAvail, targetDate, false, tz);
        expect(newAvail[0]['0']).to.equal(true);
        done();
    });

    it('Avail convert Saturday 9pm EDT -> Sunday 2am UTC', function(done: Function) {
        let oldAvail: any[] = [{}, {}, {}, {}, {}, {}, {'42': true}];
        //set targetDate to a sunday
        let targetDate = new Date('3/5/2017');
        let newAvail = tzutil.OffsetGamerAvail(oldAvail, targetDate, true, tz);
        expect(newAvail[0]['4']).to.equal(true);
        done();
    });

    it('Avail convert Sunday 12am UTC -> Saturday 7pm EDT', function(done: Function) {
        let oldAvail: any[] = [{'0': true}, {}, {}, {}, {}, {}, {}];
        //set targetDate to a sunday
        let targetDate = new Date('3/5/2017');
        let newAvail = tzutil.OffsetGamerAvail(oldAvail, targetDate, false, tz);
        expect(newAvail[6]['38']).to.equal(true);
        done();
    });

});
