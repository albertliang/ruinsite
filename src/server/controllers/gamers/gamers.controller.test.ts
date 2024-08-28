
'use strict';

import {expect} from 'chai';
import * as mongoose from 'mongoose';
import {IOrg, Org} from '../../models/org.model';
import {IGame} from '../../models/game.model';
import {IGamer} from '../../models/gamer.model';
import {GamersController} from './gamers.controller';
import {TestData} from '../test/testdata';

let game: IGame;
let gamer1: IGamer;

describe('Gamers Controller Tests', function() {

    this.timeout(0);

    before((done: Function) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            }
            game = testdata.game[0];
            gamer1 = testdata.gamer1[0];
            done(err);
        });
    });

    it('should get gamers that own game1', function(done: Function) {
        GamersController.Games._OwnsGame(game.id, gamer1.id, (err: any, doc: any) => {
            expect(doc.friends.length, 'should have at least 1 friends who own the game').to.be.greaterThan(0);
            done();
        });
    });

});
