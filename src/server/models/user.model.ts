'use strict';

import * as mongoose from 'mongoose';
import * as	crypto from 'crypto';
let moment = require('moment-timezone');

export interface IPlatforms {
	steam?: {
		steamId: string;
		profileName?: string;
		username: string;
		steamguard: string;
		oAuthToken: string;
		lastSync?: Date;
	};
    xbl?: {
    	xblId: string;
		gamerTag: string;
	};
	psn?: {
		psnId: string;
		psnName: string;
	};
}

export interface ISettings {
	startDay: number;
	subscribedTo: {
		emailAvail: boolean; //allow emailing availability query/response
		emailAvailHour: number; //what hour (local time) to email
		emailAvailHourUTC: number; //what hour (UTC time) to email
		autoSuggestLevel: number; //0 - disable, 1 - based on games owned, 2 - based on your preferred games, 3 - only if during availability window
		directInvites: boolean;
		siteNews: boolean;
		promotions: boolean;
	};
}

export interface IOrgReq {
	orgId: string;
	token: string;
}

//https://gist.github.com/masahirompp/6cfdfd1e007187e61310

export interface IUser extends mongoose.Document {
    username: string;
    lowercaseUsername: string;
    password: string;
    email: string;
    timezone: string;
    salt: string;
    platforms: IPlatforms;
	settings: ISettings;
    roles: string[];
    joinDate: Date;
    expireDate: Date;
	isQuickJoin: boolean;
	pCode: string;

    /* For reset password */
    resetPasswordToken: string;
    resetPasswordExpires: number;

    /* For email verification */
    emailIsVerified: boolean;
    emailVerificationToken: string;
    emailVerificationExpires: Date;

	/* For groups requesting */
	orgsRequests: IOrgReq[];

    hashPassword(pass: string): string;
    authenticate(password: string): boolean;
}

//**** schemas ****

let Schema = mongoose.Schema;

let PlatformsSchema = new Schema({
	steam: {
		type: {
			steamId: String,
			profileName: String,
			username: String,
			steamguard: String,
			oAuthToken: String,
			lastSync: Date
		},
		default: {}
	},
    xbl: {
    	type: {
			xblId: String,
			gamerTag: String
		},
		default: {}
	},
	psn: {
		type: {
			psnId: String,
			psnName: String
		},
		default: {}
	}
});

let SettingsSchema = new Schema({
	startDay: Number,
	subscribedTo: {
		emailAvail: Boolean,
		emailAvailHour: Number,
		emailAvailHourUTC: Number,
		autoSuggestLevel: Number,
		directInvites: Boolean,
		siteNews: Boolean,
		promotions: Boolean
	}
});

let OrgRequestSchema = new Schema({
	orgId: {
		type: String,
		unique: 'User can request a permission to a group only once',
		sparse: 'true',
	},
	token: String
});

let UserSchema = new Schema({
	username: {
		type: String,
		unique: 'User Name must be unique',
		required: 'Please fill in an username',
		trim: true
	},
	lowercaseUsername: {
		type: String,
		trim: true,
	},
    email: {
		type: String,
		unique: 'Email address already in use',
		required: 'A valid email address is required',
		trim: true,
		match: [/.+\@.+\..+/, 'Please fill a valid email address']
	},
    timezone: {
		type: String,
		default: 'UTC',
		trim: true,
	},
	password: {
		type: String,
		default: '',
	},
	salt: {
		type: String
	},
	platforms: {
		type: PlatformsSchema,
		default: {}
	},
	settings: {
		type: SettingsSchema,
		default: {
			startDay: 17, //5pm
			subscribedTo: {
				emailAvail: true,
				emailAvailHour: 12,
				emailAvailHourUTC: 7,
				autoSuggestLevel: 1,
				directInvites: true,
				siteNews: true,
				promotions: true
			}
		}
	},
	roles: {
		type: [{
			type: String,
			enum: ['user', 'admin']
		}],
		default: ['user']
	},
	orgsRequests: [OrgRequestSchema],
	joinDate: {
		type: Date,
		default: new Date()
	},
	expireDate: {
		type: Date,
		default: (new Date()).setDate(new Date().getDate() + 30)
	},
	isQuickJoin: {
		type: Boolean
	},
	pCode: {
		type: String
	},
	/* For reset password */
	resetPasswordToken: {
		type: String
	},
	resetPasswordExpires: {
		type: Date
	},
	/* For email verification */
	emailIsVerified: {
		type: Boolean,
		default: false
	},
	emailVerificationToken: {
		type: String
	},
	emailVerificationExpires: {
		type: Date
	}
});

/**
 * Create instance method for hashing a password
 */
UserSchema.method('hashPassword',
    function(password: string) {
        if (this.salt && password) {
            return crypto.pbkdf2Sync(password, this.salt, 10000, 64, 'sha1').toString('base64');
        } else {
            return password;
        }
    }
);

/**
 * Create instance method for authenticating user
 */
UserSchema.method('authenticate',
    function(password: string) {
	   return this.password === this.hashPassword(password);
    }
);

/**
 * Find possible not used username
 */
UserSchema.static('findUniqueUsername',
    function(username: string, suffix: number, callback: Function) {
        let _this = this;
        let possibleUsername = username + (suffix || '');

        _this.findOne({
            username: possibleUsername
        }, function(err: Error, user: IUser) {
            if (!err) {
                if (!user) {
                    callback(possibleUsername);
                } else {
                    return _this.findUniqueUsername(username, (suffix || 0) + 1, callback);
                }
            } else {
                callback(null);
            }
        });
    }
);

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', function(next: Function) {

	if (this.isModified('username')) {
        this.lowercaseUsername = this.username.toLowerCase();
    }
	if (this.isModified('email')) {
        this.email = this.email.toLowerCase();
    }

    // only hash the password if it has been modified (or is new)
    if (this.isModified('password')) {
		if (this.password && this.password.length > 6) {
			this.salt = new Buffer(crypto.randomBytes(16).toString('base64'), 'base64');
			this.password = this.hashPassword(this.password);
		}
    }

	if (this.settings && this.settings.subscribedTo && this.settings.subscribedTo.emailAvailHour) {
		let offset: number = moment(new Date()).tz(this.timezone)._offset / 60;
		let result = this.settings.subscribedTo.emailAvailHour - offset;
		result = result >= 24 ? result - 24 : result;
		this.settings.subscribedTo.emailAvailHourUTC = result;
    }

	next();
});

/**
 * Extend the User Model to include static method
 */
export interface IUserModel extends mongoose.Model<IUser> {
    findUniqueUsername: (username: string, suffix: number, callback: Function) => void;
}

UserSchema.index({username: 1});
UserSchema.index({lowercaseUsername: 1});
UserSchema.index({email: 1});

export let User = <IUserModel>mongoose.model<IUser>('User', UserSchema);
