
'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {IOrg, Org} from '../../models/org.model';
import {OrgsController} from './orgs.controller';
import {TestData} from '../test/testdata';

let req: express.Request;
let res: express.Response;
let org1: IOrg;

describe('Orgs Controller Tests', function() {

    this.timeout(0);

    before((done) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            }
            org1 = testdata.org[0];
            done(err);
        });
    });

    it('should populate org results successfully', function(done) {
        OrgsController._Read(org1.id, (err: any, doc: any) => {
            expect(doc.admins[0].username, 'Read should populate member usernames and avatar').to.equal('bob');
            done();
        });
    });

    //cleanup by removing all elements in the collection        
    afterEach(function(done) {
        Org.remove({}).exec(done);
    });

});
