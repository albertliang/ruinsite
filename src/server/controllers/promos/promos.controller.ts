'use strict';

import {IGame, Game} from '../../models/game.model';
import {IUser, User} from '../../models/user.model';
import {IOrg, Org} from '../../models/org.model';
import {OrgsController} from '../orgs/orgs.controller';
import {GamersController} from '../gamers/gamers.controller';
import {IPromo, Promo} from '../../models/promo.model';
import * as mongoose from 'mongoose';
import * as Promise from 'bluebird';
import {ResultsHandler} from '../results.controller';
let async = require('async');

export namespace PromosController {


    /* inner CRUD members */
    export function AddUpdatePromo(orgId: mongoose.Types.ObjectId, orgAbbr: string, callback: any) {
        Promo.findOneAndUpdate({addToOrg: orgId}, {$set: {'pcode': orgAbbr.toUpperCase()}}, (err: Error, res: IPromo) => {
            if (err) { return callback(err); }

            if (!res) {
                let newPromo = new Promo({'pcode': orgAbbr.toUpperCase(), 'addToOrg': orgId, 'extendBy': 0});
                newPromo.save(callback);
            } else {
                return callback(null, res);
            }
        });
    }

    export function HandlePromo(user: IUser, callback: any) {
        let pCode = user.pCode ? user.pCode.toUpperCase() : '';

        Promo.findOne({pcode: pCode}, (err: Error, promo: IPromo) => {
            if (promo) {
                async.parallel([
                    (cb: Function) => {
                        if (promo.extendBy)
                            ExtendSubscription(user._id, promo.extendBy, cb);
                        else
                            cb();
                    },
                    (cb: Function) => {
                        if (promo.addToOrg)
                            AddToOrg(user._id, promo.addToOrg, cb );
                        else
                            cb();
                    },
                    (cb: Function) => {
                        if (promo.addGame)
                            AddGame(user._id, promo.addGame, cb );
                        else
                            cb();
                    }
                ],
                (err: Error, results: any) => {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null);
                });
            } else {
                return callback(null);
            }
        });
    }

    function ExtendSubscription(userId: mongoose.Types.ObjectId, daysToExtend: number, callback: Function) {
        return User.findOne({_id: userId}).exec()
            .then( (user: IUser) => {
                let expireDate = new Date((user.expireDate).setDate(user.expireDate.getDate() + daysToExtend));
                User.updateOne({_id: userId}, {expireDate: expireDate}, callback);
            });
    }

    function AddToOrg(userId: mongoose.Types.ObjectId, orgId: mongoose.Types.ObjectId, callback: Function) {
        return Org.findOne({_id: orgId}).exec()
            .then( (org: IOrg) => {
                if (!org) {
                    return callback(null);
                }
                OrgsController._JoinOrg(org._id, userId, callback);
            });
    }

    function AddGame(userId: mongoose.Types.ObjectId, gameId: string, callback: Function) {
        return Game.findOne({_id: gameId}).exec()
            .then( (game: IGame) => {
                if (!game) {
                    return callback(null);
                }
                GamersController.Games._AddGame(gameId, userId.toString(), callback);
            });
    }

}


