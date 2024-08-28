
'use strict';

import {expect} from 'chai';
import {IGDBImportAPI} from '../../controllers/platforms/igdb.import';
import * as cleanup from '../test/testcleanup';

describe.skip('Testing IGDB Syncing', function() {

    this.timeout(0); //remove timeout for debugging purposes

    //this test takes a while if starting from empty db
    it('import/sync IGDB multiplayer games we havent saved yet', function(done) {

        IGDBImportAPI.SyncGamesList().then( (results: any) => {
            expect(results.length).to.be.greaterThan(0, 'there should be new games to save');
            done();
        });
    });


});
