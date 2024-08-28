'use strict';

import {IGamer, Gamer} from '../../models/gamer.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';

export namespace GamerFriendsController {

    /* exposed CRUD members */
    // export function Read(req: express.Request, res: express.Response) {
    //     let id: string = req.params.gamerId || req.user.id;
    //     _Read(id, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer, res); });
    // }

    export function Update(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Update(id, req.body, ResultsHandler);
    }

    export function AddFriend(req: express.Request, res: express.Response) {
        _AddFriend(req.params.friendId, req.user.id, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function RemoveFriend(req: express.Request, res: express.Response) {
        _RemoveFriend(req.params.friendId, req.user.id, (err: Error) => { ResultsHandler(err, null, res); });
    }

    /* inner CRUD members */
    // export function _Read(id: string, callback: any) {
    //     Gamer.findOne({ _id: new mongoose.Types.ObjectId(id) }).populate('friends').exec(callback);
    // }

    export function _Update(id: string, docs: [string], callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, { $set: {'friends' : docs} }, callback);
    }

    export function _GetFriends(id: string, callback: any) {
        Gamer.findOne({ _id: new mongoose.Types.ObjectId(id) })
            .populate('friends')
            .exec( (err: Error, gamer: IGamer) => {
                return callback(err, gamer.friends);
            });
    }

    export function _GetGamerFriends(gamer: IGamer, callback: any) {
        Gamer.find({ _id: {$in : gamer.friends }}, callback);
    }

    export function _AddFriend(friendId: string, gamerId: string, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(gamerId) }, { $addToSet: {'friends' : new mongoose.Types.ObjectId(friendId)} }, callback);
    }

    export function _RemoveFriend(friendId: string, gamerId: string, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(gamerId) }, { $pull: {'friends' : new mongoose.Types.ObjectId(friendId)} }, callback);
    }

}
