'use strict';

/**
 * Module dependencies.
 */
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as errorHandler from '../errors.controller';
import * as passport from 'passport';
import * as _ from 'lodash';
import * as async from 'async';
import {IUser, User} from '../../models/user.model';
import {Message} from '../message/message';
import {MakeId, GenerateRandomToken} from '../../util/util';
import * as moment from 'moment';
import {IGamer, Gamer} from '../../models/gamer.model';
import * as crypto from 'crypto';
import * as path from 'path';
import {Config} from '../../config/config';
import { ResultsHandler } from '../results.controller';

let swig = require('swig');

export namespace Profile {
    /**
     * Update user details
     */
    export function Update(req: express.Request, res: express.Response) {
        // Init Variables
        let user: IUser = req.user;
        let isUserEmailUpdated = user.email !== req.body.email;
        let isUserNameUpdated = user.username !== req.body.username;

        // For security measurement we remove the roles from the req.body object
        delete req.body.roles;
        delete req.body.expireDate;

        async.waterfall([
            function(next: Function) {
                User.findOne({_id: user._id}, (err: Error, user: any) => {
                    if (!err) {
                        // Merge existing user
                        user = _.extend(user, req.body);
                        user.updated = Date.now();

                        user.save(function(err: Error) {
                            if (err) {
                                return res.status(400).send({
                                    message: errorHandler.getErrorMessage(err)
                                });
                            } else {

                                // strip out sensitive bits again
                                user.password = undefined;
                                user.salt = undefined;

                                req.login(user, function(err) {
                                    if (err) {
                                        return res.status(400).send(err);
                                    } else {

                                        next(null, user);
                                    }
                                });
                            }
                        });
                    } else {
                        return res.status(401).send({
                            message: 'User is not signed in'
                        });
                    }
                });
            },
            function(user: IUser, next: Function) {
                if (isUserNameUpdated) {
                    Gamer.findOneAndUpdate({'_id': user._id }, {'username': user.username}, function(err: Error, queryResults: any) {
                        if (err) return res.status(400).send(err);
                        if (isUserEmailUpdated) next(null, user);
                        else return res.json(user);
                    });
                } else {
                    if (isUserEmailUpdated) {
                        next(null, user);
                    }
                    else {
                        return res.json(user);
                    }
                }
            },
            function(user: IUser, next: Function) {
                Message.SendVerificationEmail(user, (err: Error) => { next(err, user); });
            }
        ], function(err, results) {
            if (err) {
                return res.status(400).send({ message: 'Unknown error occurred: ' + err.message });
            } else {
               ResultsHandler(err, results, res);
            }
        });

    };

    /**
     * Update user details
     */
    export function Unsubscribe(req: express.Request, res: express.Response) {
        let username = req.params.username;
        let settingDesc: string;
        let updateSetting = {};

        switch (req.params.subscribedToSetting) {
            case 'emailAvail':
                settingDesc = 'Allow RUIn to send you a daily Availability Email';
                updateSetting = { $set: { 'settings.subscribedTo.emailAvail': false }};
                break;
            case 'directInvites':
                settingDesc = 'Allow users to send you room invites via email';
                updateSetting = { $set: { 'settings.subscribedTo.directInvites': false }};
                break;
            case 'siteNews':
                settingDesc = 'Allow RUIn to contact you regarding site updates';
                updateSetting = { $set: { 'settings.subscribedTo.siteNews': false }};
                break;
            case 'promotions':
                settingDesc = 'Allow RUIn to contact you regarding site promotions';
                updateSetting = { $set: { 'settings.subscribedTo.promotions': false }};
                break;
        }

        User.findOneAndUpdate({username: username}, updateSetting, (err: Error, user: IUser) => {
            let template = swig.compileFile(path.join(__dirname, '../message/templates/massmail/unsubscribe.html'));
            let renderHTML = template({
                domain: Config.app.realm,
                subscribedToSetting: settingDesc
            });
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(renderHTML);
        });
    }

    function GetSubscribedToFeatureDescription(subscribedToSetting: string) {
        switch (subscribedToSetting) {
            case 'emailAvail':
                return 'Allows RUIn to send you a daily Availability Email';
            case 'directInvites':
                return 'Allows users to send you room invites via email';
            case 'siteNews':
                return 'Allows RUIn to contact you regarding site updates';
            case 'promotions':
                return 'Allows RUIn to contact you regarding site promotions';
        }
    }

    /**
     * Send User
     */
    export function Me(req: express.Request, res: express.Response) {
        res.json(req.user || null);
    };
}