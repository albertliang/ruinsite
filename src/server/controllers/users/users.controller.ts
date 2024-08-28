'use strict';

/**
 * Module dependencies.
 */
import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';
import {Message} from '../message/message';

import {Authentication as authentication} from './users.controller.authentication';
//import {Authorization as authorization} from './users.controller.authorization';
import {Password as password} from './users.controller.password';
import {Profile as profile} from './users.controller.profile';
import {GamersController} from '../gamers/gamers.controller';
import {PromosController} from '../promos/promos.controller';
import {Config} from '../../config/config';

export namespace UsersController {

    /* Combines user controller methods all together */
    export let Authentication = authentication;
    //export let Authorization = authorization;
    export let Password = password;
    export let Profile = profile;

    /* exposed CRUD members */
    // Create functionality has been moved to users/users.controller.authentication -> SignUp

    export function Read(req: express.Request, res: express.Response) {
        _Read(req.params.userId, (err: Error, user: IUser) => { ResultsHandler(err, user, res); });
    }

    export function Update(req: express.Request, res: express.Response) {
        let id: string = req.user.id;
        _Update(req.body, (err: Error, user: IUser) => { ResultsHandler(err, user, res); });
    }

    export function Delete(req: express.Request, res: express.Response) {
        let id: string = req.user.id;
        _Delete(req.params.userId, (err: Error, user: IUser) => { ResultsHandler(err, null, res); });
    }

    export function List(req: express.Request, res: express.Response) {
        _List( (err: Error, docs: IUser[]) => { ResultsHandler(err, docs, res); });
    }

    export function IsUsernameUnique(req: express.Request, res: express.Response) {
        _IsUsernameUnique(req.body.userId, req.body.username, function(err: Error, isExists: any) {
            ResultsHandler(err, isExists, res);
        });
    }

    export function IsEmailUnique(req: express.Request, res: express.Response) {
        _IsEmailUnique(req.body.userId, req.body.email, function(err: Error, isExists: any) {
            ResultsHandler(err, isExists, res);
        });
    }

    /* inner CRUD members */
    export function _Create(user: IUser, callback: any) {

        user.save(function(errUser: Error, res: any) {
            if (errUser) {
                return callback(errUser);
            } else {

                let platforms: any = {};
                if (user.platforms && user.platforms.steam) {
                    platforms.steamId = user.platforms.steam.steamId;
                    platforms.steamName = user.platforms.steam.profileName;
                }
                let gamer = new Gamer({
                    _id: user._id,
                    username: user.username,
                    user: user,
                    platforms: platforms
                });

                GamersController._Create(gamer, (errGamer: Error) => {
                    if (errGamer) {
                        return callback(errGamer);
                    } else {

                        //message admin
                        if (Config.emailIfNewUser) {
                            Message.NotifyAdmin_NewUser(user);
                        }

                        callback(null, user);
                        
                        // return PromosController.HandlePromo(user, () => {
                        // });
                    }
                });
            }
        });

    }

    export function _Read(userId: string, callback: any) {
        User.findById( userId, '-password -salt', callback);
    }

    export function _ReadMany(userIds: mongoose.Types.ObjectId[], callback: any) {
        User.find({ _id: {'$in': userIds}}, callback);
    }

    export function _ReadBySteamId(steamId: string, callback: any) {
        User.findOne( { 'platforms.steam.steamId': steamId }, '-password -salt', callback);
    }

    export function _Update(user: IUser, callback: any) {
        User.findOneAndUpdate( { _id: user._id }, user, callback);
    }

    export function _Delete(userId: string, callback: any) {
        User.remove( { _id: new mongoose.Types.ObjectId(userId) }, callback);
    }

    export function _List(callback: any) {
        User.find({}, callback);
    }
    export function _GetEmail(userId: mongoose.Types.ObjectId,callback: any){
        User.findOne({_id: userId}, {'email': 1},callback);
    }

    //search for gamers that start with the given string
    export function _IsUsernameUnique(userId: string, username: string, callback: any) {
        User.findOne({'lowercaseUsername': username.toLowerCase()}, (err: Error, foundUser: IUser) => {
            if (foundUser && foundUser.id !== userId) {
                return callback(null, {isExists: true});
            } else {
                return callback(null, {isExists: false});
            }
        });
    }

    //search for gamers that start with the given string
    export function _IsEmailUnique(userId: string, email: string, callback: any) {
        User.findOne({'email': email.toLowerCase()}, (err: Error, foundUser: IUser) => {
            if (foundUser && foundUser.id !== userId) {
                return callback(null, {isExists: true});
            } else {
                return callback(null, {isExists: false});
            }
        });
    }
}
