'use strict';

/**
 * Module dependencies.
 */
import {IUser} from '../../models/user.model';
import {UsersController} from '../../controllers/users/users.controller';
import * as mongoose from 'mongoose';
import * as passport from 'passport';
import * as express from 'express';
import {Config} from '../config';
let JwtStrategy = require('passport-jwt').Strategy;
let ExtractJwt = require('passport-jwt').ExtractJwt;

class IJWToptions {
    secretOrKey: string;
    jwtFromRequest: Function;
    issuer: string;
    audience: string;
    algorithms: string[];
    ignoreExpiration: boolean;
    passReqToCallback: boolean;
}

let opts = new IJWToptions();
opts.jwtFromRequest =ExtractJwt.fromAuthHeaderWithScheme("jwt") //ExtractJwt.fromAuthHeader();
opts.secretOrKey = Config.jwt.secret;
opts.issuer = Config.jwt.issuer;
opts.audience = Config.jwt.audience;
opts.ignoreExpiration = true;
opts.passReqToCallback = true;

export interface IJWTpayload {
  exp: number; //expiresIn
  aud: string; //audience
  iss: string; //issuer
  uid: string; //userId
}

export function InitStrategy() {

    //use jwt strategy
    passport.use(new JwtStrategy(opts, function(req: express.Request, jwt_payload: IJWTpayload, done: Function) {

        //is token expired
        if (jwt_payload.exp < Date.now()) {
            return done(null, false, {'message': 'Token expired'});
        }

        UsersController._Read( jwt_payload.uid, function(err: Error, user: IUser) {
            if (err) {
                return done(err, false);
            }
            if (user) {
                return done(null, user);
            } else {
                //invalid token
                return done(null, false, {'message': 'Invalid token'});
            }
        });
    }));
}
