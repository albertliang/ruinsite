'use strict';

import { IComment, IOrg, Org } from '../../models/org.model';
import { IUser } from '../../models/user.model';
import { IGamer, Gamer } from '../../models/gamer.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import { ResultsHandler } from '../results.controller';
import { UsersController } from '../users/users.controller';
import { PromosController } from '../promos/promos.controller';
import { Message } from '../message/message';
import { Game, IGame } from '../../models/game.model';
import * as moment from 'moment';
import { CommentQueue, ICommentQueue, IPlayer } from '../../models/commentqueue.model';
import * as _ from 'lodash';
let async = require('async');

export namespace OrgsController {

    /* exposed CRUD members */
    export function Create(req: express.Request, res: express.Response) {
        let user: IUser = req.user;
        let org: IOrg = req.body;

        _Create(user._id, org, (err: Error, org: IOrg) => { ResultsHandler(err, org, res); });
    }

    export function Read(req: express.Request, res: express.Response) {
        _Read(req.params.orgId, (err: Error, org: IOrg) => { ResultsHandler(err, org, res); });
    }

    export function Update(req: express.Request, res: express.Response) {
        _Update(req.body, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function JoinOrg(req: express.Request, res: express.Response) {
        _JoinOrg(req.params.orgId, req.user._id, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function LeaveOrg(req: express.Request, res: express.Response) {
        _LeaveOrg(req.params.orgId, req.user._id, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function AddAdmin(req: express.Request, res: express.Response) {
        _AddAdmin(req.params.orgId, req.params.gamerId, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function RemoveAdmin(req: express.Request, res: express.Response) {
        _RemoveAdmin(req.params.orgId, req.params.gamerId, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function Delete(req: express.Request, res: express.Response) {
        _Delete(req.params.orgId, (err: Error) => { ResultsHandler(err, null, res); });
    }

    export function AddGame(req: express.Request, res: express.Response) {
        _AddGame(req.params.orgId, req.params.gameId, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function RemoveGame(req: express.Request, res: express.Response) {
        _RemoveGame(req.params.orgId, req.params.gameId, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    }

    export function Search(req: express.Request, res: express.Response) {
        _Search(req.params.orgName, (err: Error, docs: IOrg[]) => { ResultsHandler(err, docs, res); });
    }

    export function AddComment(req: express.Request, res: express.Response) {
        _AddComment(req.params.orgId, req.user, req.body.comment, (err: Error, org: IOrg) => { ResultsHandler(err, org, res); });
    }

    export function Top(req: express.Request, res: express.Response) {
        _Top((err: Error, docs: IOrg[]) => {
            if (err) {
                ResultsHandler(err, null, res);
            }

            docs.sort(function(a: IOrg, b: IOrg){
                if (a.members.length > b.members.length) {
                    return -1;
                } else if (a.members.length < b.members.length) {
                    return 1;
                } else {
                    return 0;
                }
            });

            let topDocs = docs.splice(0, 3);

            ResultsHandler(err, topDocs, res);
        });
    }

    export function AcceptUser(req: express.Request, res: express.Response) {
        _AcceptUser(req.params.orgId, req.params.userId, req.params.token, (err: Error, result: boolean) => { ResultsHandler(err, result, res); });
    }

    /**
     * Only Org admins are authorized
     * */
    export function IsAuthorized() {
        return function (req: express.Request, res: express.Response, next: () => express.Response) {
            let orgId: string = req.params.orgId;
            Org.findById(orgId, (err: Error, org: IOrg) => {
                if (org.admins && org.admins.indexOf(req.user._id) >= 0) {
                    return next();
                } else {
                    return res.status(403).send({
                        message: 'user_not_authorized'
                    });
                }
            });
        };
    }

    /* inner CRUD members */
    export function _Create(userId: mongoose.Types.ObjectId, org: IOrg, callback: any) {
        // add the user to admins if not already there
        if (!org.admins) {
            org.admins = [userId];
        } else if (org.admins.indexOf(userId) === -1) {
            org.admins.push(userId);
        }

        // add the user to members if not already there
        if (!org.members) {
            org.members = [userId];
        } else if (org.members.indexOf(userId) === -1) {
            org.members.push(userId);
        }

        Org.create(org, (err: Error, newOrg: IOrg) => {
            if (err) {
                return callback(err, null);
            }
            Gamer.findOneAndUpdate({ _id: userId }, { $addToSet: { 'orgs': newOrg._id } }, (err, gamer) => {
                return callback(err, newOrg);
            });
        });
    }

    export function _Read(orgId: string, callback: any) {
        Org.findOne({ _id: new mongoose.Types.ObjectId(orgId) },
            (err: Error, org: any) => {
                if (err) {
                    return callback(err);
                }
                //populate admins, members, games
                async.parallel([
                    (cb: Function) => {
                        Gamer.find({ _id: { $in: org.admins } }, { 'username': 1, 'avatarIcon': 1 },
                            (err: Error, admins: IGamer[]) => {
                                org.admins = admins;
                                cb();
                            });
                    },
                    (cb: Function) => {
                        Gamer.find({ _id: { $in: org.members } }, { 'username': 1, 'avatarIcon': 1 },
                            (err: Error, members: IGamer[]) => {
                                org.members = members;
                                cb();
                            });
                    },
                    (cb: Function) => {
                        Game.find({ _id: { $in: org.games } }, { 'name': 1, 'iconSm': 1 },
                            (err: Error, games: IGame[]) => {
                                org.games = games;
                                cb();
                            });
                    }
                ],
                    (err: Error, results: any) => {
                        if (err) {
                            return callback(err);
                        }
                        return callback(null, org);
                    }
                );
            }
        );
    }

    export function _ReadBySteamGroup(steamGroupName: string, callback: any) {
        Org.findOne({ steamGroupName: steamGroupName }, callback);
    }

    export function _Update(org: IOrg, callback: any) {
        Org.findOneAndUpdate({ _id: org._id }, org, (err: Error, oldOrg: IOrg) => {
            let oldAbbr: string = oldOrg.abbreviation || '';
            let newAbbr: string = org.abbreviation || '';

            if (newAbbr.toUpperCase() !== oldAbbr.toUpperCase()) {
                PromosController.AddUpdatePromo(org._id, org.abbreviation, (err: Error, res: any) => {
                    return callback(err, org);
                });
            } else {
                return callback(err, org);
            }
        });
    }

    export function _JoinOrg(orgId: mongoose.Types.ObjectId, gamerId: mongoose.Types.ObjectId, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $addToSet: { 'members': gamerId } }, (err: Error, org: IOrg) => {
            if (err) {
                callback(err, null);
                return;
            }

            Gamer.findOneAndUpdate({ _id: gamerId }, { $addToSet: { 'orgs': org._id } }, (err: Error, gamer: any) => {
                Message._JoinOrgEmail( org, gamer.username, () => {} );
                return callback(err, gamer);
            });
        });
    }

    export function _LeaveOrg(orgId: mongoose.Types.ObjectId, gamerId: mongoose.Types.ObjectId, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $pull: { 'members': gamerId, 'admins': gamerId } }, (err: Error, org: IOrg) => {
            if (err || !org) {
                callback(err, null);
            } else {
                Gamer.findOneAndUpdate({ _id: gamerId }, { $pull: { 'orgs': org._id } }, (err: Error, gamer: any) => {
                    return callback(err, gamer);
                });
            }
        });
    }

    export function _AddAdmin(orgId: mongoose.Types.ObjectId, gamerId: mongoose.Types.ObjectId, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $addToSet: { 'admins': gamerId } }, callback);
    }

    export function _RemoveAdmin(orgId: mongoose.Types.ObjectId, gamerId: mongoose.Types.ObjectId, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $pull: { 'admins': gamerId } }, callback);
    }

    export function _AddRoom(orgId: mongoose.Types.ObjectId, roomId: mongoose.Types.ObjectId, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $addToSet: { 'rooms': roomId } }, callback);
    }

    export function _RemoveRoom(orgId: mongoose.Types.ObjectId, roomId: mongoose.Types.ObjectId, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $pull: { 'rooms': roomId } }, callback);
    }

    export function _AddGame(orgId: mongoose.Types.ObjectId, gameId: string, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $addToSet: { 'games': gameId } }, callback);
    }

    export function _RemoveGame(orgId: mongoose.Types.ObjectId, gameId: string, callback: any) {
        Org.findOneAndUpdate({ _id: orgId }, { $pull: { 'games': gameId } }, callback);
    }

    export function _Delete(orgId: string, callback: any) {
        Org.remove({ _id: new mongoose.Types.ObjectId(orgId) }, callback);
    }

    export function _Search(orgName: string, callback: any) {
        Org.find({ 'name': { '$regex': orgName, '$options': 'i' } }, { 'name': 1, 'isOpen': 1 }).limit(50).exec(callback);
    }

    export function _Top(callback: any) {
        Org.find({}, {'name': 1, 'isOpen': 1, 'members': 1}).exec(callback);
    }
    export function _AcceptUser(orgId: string, userId: string, token: string, callback: any) {
        UsersController._Read(userId, (err: Error, user: IUser) => {
            if (err) {
                callback(err, false);
                return;
            }

            for (let i = 0; i < user.orgsRequests.length; i++) {
                if (user.orgsRequests[i].token === token && user.orgsRequests[i].orgId === orgId) {
                    _JoinOrg(new mongoose.Types.ObjectId(orgId), new mongoose.Types.ObjectId(userId), (err: Error, gamer: IGamer) => {
                        if (err) {
                            callback(err, false);
                            return;
                        }
                        user.orgsRequests.splice(i, 1);
                        UsersController._Update(user, (err: Error, user: IUser) => {
                            callback(err, true);
                        });
                    });
                    break;
                }
            }
        });
    }

    export function _AddComment(orgId: string, user: IUser, comment: string, callback: any) {
        let newComment: IComment = {username: user.username, gamer: user._id, comment: comment, ts: moment().utc().toDate()};

        // if this is a room series, make a new room occurrence
        Org.findById(orgId, (err: Error, org: IOrg) => {
            if (err) return callback(err);

            org.comments.push(newComment);
            org.save((err: Error, results: any) => {
                 _QueueComment(org, newComment, (err: Error) => {
                    return callback(err, org);
                });
            });
        });
    }

    function _QueueComment(org: IOrg, newComment: IComment, callback: Function) {
        //email players about new comment
        CommentQueue.findByIdAndUpdate(org.id, {$addToSet: {'comments': newComment}, $pull: {'players': {'gamer': newComment.gamer}}},
        (err: Error, result: ICommentQueue) => {
            if (err || !result) {

                // no record exists, create a new one
                let commentQueue = {
                    _id: org._id,
                    isRoomComment: false,
                    groupName: org.name,
                    hostUsername: org.name,
                    comments: [newComment],
                    players: org.members.map<IPlayer>(m => {return {gamer: m, username: ""}})
                };
                let newCommentQueue = new CommentQueue(commentQueue);
                // _.remove(newCommentQueue.players, (player: IPlayer) => { return player.gamer.equals(newComment.gamer); });
                newCommentQueue.save((err: Error, res: any) => { callback(err); });
            } else {
                callback(null);
            }
        });
    }
}
