'use strict';

import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame} from '../../models/game.model';
import {IOrg, Org} from '../../models/org.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';
import * as _ from 'lodash';

export namespace GamerGamesController {

    /* exposed CRUD members */
    // export function Read(req: express.Request, res: express.Response) {
    //     let id: string = req.params.gamerId || req.user.id;
    //     _Read(id, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer, res); });
    // }

    export function Update(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Update(id, req.body, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function AddGame(req: express.Request, res: express.Response) {
        _AddGame(req.params.gameId, req.user.id, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function RemoveGame(req: express.Request, res: express.Response) {
        _RemoveGame(req.params.gameId, req.user.id, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function AddPreferredGame(req: express.Request, res: express.Response) {
        _AddPreferredGame(req.params.gameId, req.user.id, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function RemovePreferredGame(req: express.Request, res: express.Response) {
        _RemovePreferredGame(req.params.gameId, req.user.id, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function ReplacePreferredGame(req: express.Request, res: express.Response) {
        _ReplacePreferredGame(req.params.oldGameId, req.params.newGameId, req.user.id, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function OwnsGame(req: express.Request, res: express.Response) {
        _OwnsGame(req.params.gameId, req.user.id, (err: Error, ownsGame: any) => { ResultsHandler(err, ownsGame, res); });
    }

    /* inner CRUD members */
    // export function _Read(id: string, callback: any) {
    //     Gamer.findOne({ _id: new mongoose.Types.ObjectId(id) }).populate('games').exec(callback);
    // }

    export function _Update(id: string, docs: [IGame], callback: any) {
        Gamer.findOneAndUpdate( { _id: new mongoose.Types.ObjectId(id) }, { $set: {'games' : docs} }, callback);
    }

    export function _AddGame(gameId: string, gamerId: string, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(gamerId) }, { $addToSet: {'games' : gameId} },
            (err: Error, gamer: IGamer) => {
                return _AddPreferredGame(gameId, gamerId, callback);
            });
    }

    export function _RemoveGame(gameId: string, gamerId: string, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(gamerId) }, { $pull: {'games' : gameId} },
            (err: Error, gamer: IGamer) => {
                _RemovePreferredGame(gameId, gamerId, callback);
            });
    }

    export function _AddPreferredGame(gameId: string, gamerId: string, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(gamerId) }, { $addToSet: {'gamesPreferred' : gameId} }, {new: true},
            (err: Error, updatedGamer: IGamer) => {
                //if more than 5 preferred games, remove the earliest one
                if (updatedGamer.gamesPreferred.length > 5) {
                    return _RemovePreferredGame(updatedGamer.gamesPreferred[0], gamerId, callback);
                } else {
                    return callback(err, updatedGamer);
                }
            }
        );
    }

    export function _RemovePreferredGame(gameId: string, gamerId: string, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(gamerId) }, { $pull: {'gamesPreferred' : gameId} }, {new: true}, callback);
    }

    export function _ReplacePreferredGame(oldGameId: string, newGameId: string, gamerId: string, callback: any) {
        _RemovePreferredGame(oldGameId, gamerId, (err: Error, gamer: IGamer) => {
            _AddPreferredGame(newGameId, gamerId, callback);
        });
    }

    /**
     * Find other gamers who own specified game and categorize them as friends/orgs/public
     */
    export function _OwnsGame(gameId: string, userId: string, callback: any) {
        Gamer.findOne( {_id: new mongoose.Types.ObjectId(userId)} )
            .populate('orgs')
            .exec((err: Error, gamer: IGamer) => {
                Gamer.find({ games: gameId, _id : {$ne: new mongoose.Types.ObjectId(userId)} }, 'username avails availsArr hasAvail gamesPreferred avatarIcon', (err: Error, gamers: IGamer[]) => {
                    if (err) {
                        return callback(err);
                    }
                    //categorize gamers into friends/orgs/public
                    let results: any = { friends: [], orgs: [], public: [] };
                    results.friends =
                        _.remove(gamers, (g: IGamer) => {
                            return _.find(gamer.friends, (f: mongoose.Types.ObjectId) => { return f.equals(g._id); });
                        });

                    results.orgs =
                        _.remove(gamers, (g: IGamer) => {
                            return _.find(gamer.orgs, (o: IOrg) => { return _.find(o.members, (om: mongoose.Types.ObjectId) => { return om.equals(g._id); }); });
                        });

                    results.public = gamers.slice(0, 50); //only return the top 50 results

                    return callback(null, results);
                });
            });
    }

    /**
     * Find other org members who own specified game (if specified)
     */
    export function _OwnsGameOrg(orgId: string, gameId: string, callback: any) {
        if (gameId) {
            Gamer.find( {orgs: new mongoose.Types.ObjectId(orgId), games: gameId} )
                .exec((err: Error, members: IGamer[]) => {
                    return callback(err, members);
                });
        } else {
            Gamer.find( {orgs: new mongoose.Types.ObjectId(orgId)} )
                .exec((err: Error, members: IGamer[]) => {
                    return callback(err, members);
                });
        }

    }

}
