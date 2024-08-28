'use strict';

/**
 * Module dependencies.
 */
import {IUser, User} from '../../models/user.model';
import * as mongoose from 'mongoose';
import * as passport from 'passport';
let LocalStrategy = require('passport-local').Strategy;

export function InitStrategy() {

	// Use local strategy
	passport.use(new LocalStrategy(
        {
			usernameField: 'username',
			passwordField: 'password',
            passReqToCallback: true
		},
		function(req: Express.Request, username: string, password: string, done: Function) {
			User.findOne({ $or: [{lowercaseUsername: username.toLowerCase()}, {email: username.toLowerCase()}] }, function(err, user) {
				if (err) {
					return done(err);
				}
				if (!user) {
					return done(null, false, {
						message: 'Unknown user or invalid password'
					});
				}
				if (!user.authenticate(password)) {
					return done(null, false, {
						message: 'Unknown user or invalid password'
					});
				}

				return done(null, user);
			});
		}
	));
}