'use strict';

import {IGamer, Gamer} from '../../models/gamer.model';
import {IUser} from '../../models/user.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';
import * as _ from 'lodash';
import * as Promise from 'bluebird';

import {GamerAvailabilitiesController as availabilities} from './gamers.availabilities.controller';
import {GamerFriendsController as friends} from './gamers.friends.controller';
import {GamerGamesController as games} from './gamers.games.controller';
import {GamerOrgsController as orgs} from './gamers.orgs.controller';
import {GamerPlatformsController as platforms} from './gamers.platforms.controller';
import {GamerSearchFiltersController as searchfilters} from './gamers.searchfilters.controller';
import { UsersController as user } from '../users/users.controller';

let gravatar = require('gravatar');

export namespace GamersController {

    /* Combines gamer controller methods all together */
    export let Availabilities = availabilities;
    export let Friends = friends;
    export let Games = games;
    //export let Orgs = orgs;
    export let Platforms = platforms;
    export let SearchFilters = searchfilters;
    export let UserController = user;

    /* exposed CRUD members */
    // create functionality moved into users.controller->_Create function so that user and gamer share the same _id

    export function Read(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Read(id, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer, res); });
    }

    export function ReadAndPopulate(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _ReadAndPopulate(id, (err: Error, gamer: IGamer) => {
            if (!gamer.avatarUrlSm && !gamer.avatarUrlLg) {
                user._GetEmail(gamer.user, (err: Error, user: IUser) => {
                    if (user && user.email) {
                        let urlSm = gravatar.url(user.email, {s: '200', r: 'g', d: 'mm'});
                        let urlLg = gravatar.url(user.email, {s: '600', r: 'g', d: 'mm'});
                        gamer.avatarUrlSm = urlSm;
                        gamer.avatarUrlLg = urlLg;

                        _Update(gamer._id.toString(), gamer, (err: Error, gamer: IGamer) => {});
                    }
                 });
            }
            ResultsHandler(err, gamer, res); });
    }

    export function ReadPlatform(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Read(id, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer.platforms, res); });
    }

    export function Update(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Update(id, req.body, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function UpdateAvatar(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        const avatar = req.body.avatar;
        _UpdateAvatar(id, avatar, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    export function Delete(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Delete(id, (err: Error) => { ResultsHandler(err, null, res); });
    }

    export function Search(req: express.Request, res: express.Response) {
        _Search(req.params.userName, function(err: Error, docs: IGamer[]) {
            ResultsHandler(err, docs, res);
        });
    }

    /* inner CRUD members */
    export function _Create(gamer: IGamer, callback: any) {
        Gamer.create(gamer, callback);
    }

    export function _Read(id: string, callback: any) {
        Gamer.findById(id, callback);
    }

    export function _ReadAndPopulate(id: string, callback: any) {
        Gamer.findById(id)
            .populate( {path: 'games', options: { sort: { 'name': 1}}} )
            .populate( {path: 'gamesPreferred', options: { sort: { 'name': 1}}} )
            .populate( {path: 'orgs', select: 'name members', options: { sort: { 'name': 1}}} )
            .populate( {path: 'friends', options: { sort: { 'username': 1}}} )
            .exec(callback);
    }

    export function _ReadList(ids: mongoose.Types.ObjectId[]) {
        return Gamer.find({_id: {$in: ids}}, {username: 1, avatarIcon: 1}).exec();
    }

    export function _ReadByPlatformId(platformId: string, ids: string[], callback: any) {
        Gamer.find({}).where('platforms.' + platformId).in(ids).exec(callback);
    }

    export function _Update(id: string, gamer: IGamer, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, gamer, callback);
    }

    export function _UpdateAvatar(id: string, avatarIcon: any, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, {$set : {'avatarIcon': avatarIcon }}, callback);
    }

    export function _Delete(id: string, callback: any) {
        Gamer.remove({ _id: new mongoose.Types.ObjectId(id) }, callback);
    }

    //search for gamers that start with the given string
    export function _Search(username: string, callback: any) {
        Gamer.find({'username': {'$regex': '^' + username, '$options': 'i'}}, 'username').limit(50).exec(callback);
    }

    /**
     * Need authorization middleware
     */
    exports.hasAuthorization = function(req: express.Request, res: express.Response, next: Function) {
        // let hasAuth = false;
        // let user: IUser = req.user;
        // let isAdminRole = _.includes(user.roles, 'admin');
        //
        // // Anyone has authorization to their own documents...
        // if (req.need.createdBy === req.user) {
        //     hasAuth = true;
        // // Admins can edit any data...
        // } else if (isAdminRole) {
        //     hasAuth = true;
        // }
        //
        // if (!hasAuth) {
        //     return res.status(403).send('user_not_authorized');
        // }
        next();
    };
}
