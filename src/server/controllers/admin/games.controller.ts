'use strict';

import {IGame, Game} from '../../models/game.model';
import {IUser} from '../../models/user.model';
import {GamerGamesController} from '../gamers/gamers.games.controller';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as async from 'async';
import {Message} from '../message/message';
import {ResultsHandler} from '../results.controller';

export namespace GamesController {

    /* exposed CRUD members */
    export function Create(req: express.Request, res: express.Response) {
        _Create(req.body, (err: Error, game: IGame) => { ResultsHandler(err, game, res); });
    }

    export function CreateCustom(req: express.Request, res: express.Response) {
        _CreateCustom(req.user, req.body, (err: Error, game: IGame) => { ResultsHandler(err, game, res); });
    }

    export function Read(req: express.Request, res: express.Response) {
        _Read(req.params.gameId, (err: Error, game: IGame) => { ResultsHandler(err, game, res); });
    }

    export function Update(req: express.Request, res: express.Response) {
        _Update(req.body, (err: Error, game: IGame) => { ResultsHandler(err, null, res); });
    }

    export function Delete(req: express.Request, res: express.Response) {
        _Delete(req.params.gameId, (err: Error) => { ResultsHandler(err, null, res); });
    }

    export function List(req: express.Request, res: express.Response) {
        _List(function(err: Error, docs: IGame[]) {
            ResultsHandler(err, docs, res);
        });
    }

    export function ListByPlatform(req: express.Request, res: express.Response) {
        _ListByPlatform(req.params.platformId, function(err: Error, docs: IGame[]) {
            ResultsHandler(err, docs, res);
        });
    }

    export function SearchByPlatform(req: express.Request, res: express.Response) {
        _SearchByPlatform(req.params.platformId, req.params.gameName, function(err: Error, docs: IGame[]) {
            ResultsHandler(err, docs, res);
        });
    }

    export function SearchByName(req: express.Request, res: express.Response) {
        _SearchByName(req.params.gameName, function(err: Error, docs: IGame[]) {
            ResultsHandler(err, docs, res);
        });
    }

    /* inner CRUD members */
    export function _Create(game: IGame, callback: any) {
        Game.create(game, callback);
    }

    // user is requesting a new game get created
    // add it to their library and email/alert the admin
    export function _CreateCustom(user: IUser, game: IGame, callback: any) {
        Game.create(game, (err: Error, game: IGame) => {
            if (err) {
                return callback(err);
            }
            async.waterfall([
                function(next: Function) {
                    GamerGamesController._AddGame(game.id, user.id, next);
                }
            ],
            (err: Error, results: any) => {
                Message._AddCustomGameEmail(user, game, (err: Error, msg: string) => {
                    callback(err, game);
                });
            });
        });
    }

    export function _Read(id: string, callback: any) {
        Game.findOne({ _id: new mongoose.Types.ObjectId(id) }, callback);
    }

    export function _Update(game: IGame, callback: any) {
        Game.findOneAndUpdate( { _id: game._id }, game, callback);
    }

    export function _Delete(id: string, callback: any) {
        Game.remove( { _id: new mongoose.Types.ObjectId(id) }, callback);
    }

    export function _List(callback: any) {
        Game.find({}, null, {sort: {platformId: 1, name: 1}}, callback);
    }

    // omit non-verified games submitted by users
    export function _ListByPlatform(platformId: string, callback: any) {
        Game.find({platformId: platformId, usrRequest: {$ne: true}}, null, {sort: {name: 1}}, callback);
    }

    // omit non-verified games submitted by users
    export function _SearchByPlatform(platformId: string, gameName: string, callback: any) {
        Game.find({platformId: platformId, name: {'$regex': '^' + gameName, '$options': 'i'}, usrRequest: {$ne: true} }).limit(50).sort({name: 1}).exec(callback);
    }

    export function _SearchByName(gameName: string, callback: any) {
        Game.find({name: {'$regex': gameName, '$options': 'i'}, usrRequest: {$ne: true} }).sort({releaseDate: -1}).limit(12).sort({name: 1}).exec(callback);
    }

}


