'use strict';

/**
 * Module dependencies.
 */
import {IUser, User} from '../../models/user.model';
import {UsersController} from './users.controller';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as errorHandler from '../errors.controller';
import * as passport from 'passport';
import * as _ from 'lodash';

export namespace Authorization {

    /**
     * User middleware
     */
    // export function UserByID(req: any, res: express.Response, next: Function, id: string) {
    //     UsersController._Read(id, (err: Error, user: IUser) => {
    //         if (err) return next(err);
    //         if (!user) return next(new Error('Failed to load User ' + id));

    //         req.user = user;
    //         next();
    //     });
    // };

    /**
     * Require login routing middleware
     */
    // export function RequiresLogin(req: express.Request, res: express.Response, next: Function) {
    //     if (!req.isAuthenticated()) {
    //         return res.status(401).send({
    //             message: 'User is not logged in'
    //         });
    //     }

    //     next();
    // };

    /**
     * User authorizations routing middleware
     */
    // export function HasAuthorization(roles: string[]) {
    //     let _this = this;

    //     return function(req: express.Request, res: express.Response, next: () => express.Response) {
    //         _this.requiresLogin(req, res, function() {
    //             if (_.intersection(req.user.roles, roles).length) {
    //                 return next();
    //             } else {
    //                 return res.status(403).send({
    //                     message: 'user_not_authorized'
    //                 });
    //             }
    //         });
    //     };
    // };

}