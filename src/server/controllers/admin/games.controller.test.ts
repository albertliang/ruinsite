
'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {IGame, Game} from '../../models/game.model';
import {GamesController} from '../../controllers/admin/games.controller';
import * as cleanup from '../test/testcleanup';

let game = {
    _id: new mongoose.Types.ObjectId(),
    gameId: 'game1',
    platformId: 1,
    name: 'game'
};
let req: express.Request;
let res: express.Response;

describe('Games Controller Tests', function() {

    this.timeout(0);

    before((done) => {
        cleanup.ClearCollections(done);
    });

    it('should save directly to the model successfully', function(done) {
        let gameRepo = new Game(game);
        let savedId = gameRepo.id;

        gameRepo.save( (err: Error, doc: IGame) => {
            Game.findOne({_id: savedId}, (err: any, res: IGame) => {
                expect(res.gameId, 'couldn\'t find id that was saved').to.equal('game1');
                done();
            });
        });
    });

    it('should save via the controller successfully', function(done) {
        let gameRepo = new Game(game);
        GamesController._Create(gameRepo, (err: any, doc: IGame) => {
            let savedId = doc.id;
            GamesController._Read(savedId, (err: any, res: IGame) => {
                expect(res.gameId, 'couldn\'t find id that was saved').to.equal('game1');
                done();
            });
        });
    });

    it('should update via the controller successfully', function(done) {
        let gameRepo = new Game(game);
        GamesController._Create(gameRepo, (err: any, doc: IGame) => {
            doc.name = 'newGame';
            GamesController._Update(doc, (err: any, res: IGame) => {
                GamesController._Read(res.id, (err: any, res: IGame) => {
                    expect(res.name, 'could not update game object').to.equal('newGame');
                    done();
                });
            });
        });
    });

    //this test takes a long time
    // it.skip('import/sync Steam multiplayer games we havent saved yet', function(done) {
    //     GamesController._Sync( (err: any, docs: IGame[]) => {
    //         if (err) {
    //             expect(err).to.be.null('import functionality has failed');
    //         } else {
    //             expect(docs.length).to.be.greaterThan(0, 'there should be new games to save');
    //         }
    //         done();
    //     });
    // });

    //cleanup by removing all elements in the collection
    afterEach(function(done) {
        Game.remove({}).exec(done);
    });

});
