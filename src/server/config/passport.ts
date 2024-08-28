'use strict';

/**
 * Module dependencies.
 */
import * as mongoose from 'mongoose';
import * as passport from 'passport';
import {IUser, User} from '../models/user.model';
import {Config} from './config';
import * as localstrat from './strategies/local';
import * as jwtstrat from './strategies/jwt';
import * as steam from './strategies/steam';

/**
 * Module init function.
 */
export = function() {
	// Serialize sessions
	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

	// Deserialize sessions, don't show salt or pwd
	passport.deserializeUser(function(id: string, done: Function) {
		User.findOne({ id: id }, '-salt -password -platforms', function(err, user) {
			done(err, user);
		});
	});

    // Load passport strategies
    localstrat.InitStrategy();
    jwtstrat.InitStrategy();
    steam.InitStrategy();

};