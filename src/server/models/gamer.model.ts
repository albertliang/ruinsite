'use strict';

import * as mongoose from 'mongoose';
import {IGame} from './game.model';
import {IOrg} from './org.model';
import {IUser} from './user.model';
import {IRoom} from './room.model';

let Schema = mongoose.Schema;

//**** interfaces ****
export interface IPlatforms {
	steam: string;
    xbl: string;
    psn: string;
	nintendo: string;
	gog: string;
	epic: string;
	origin: string;
	uplay: string;
}

export interface ISearchFilter {
    overlapDuration: number;
    sortBy: string;
}

export interface IGamer extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    username: string;
	avatarUrlSm: string;
	avatarUrlLg: string;
	avatarIcon: string;
    platforms: IPlatforms;
    games: string[]; //games owned
    gamesPreferred: string[]; //preferred games to filter by
    orgs: mongoose.Types.ObjectId[];
    friends: mongoose.Types.ObjectId[];
    rooms: mongoose.Types.ObjectId[];
	avails: any[];
	availsArr: number[];
	hasAvail: boolean;
    searchFilters: ISearchFilter;
    zipCode: string;
    updateTS: Date;
    user: mongoose.Types.ObjectId;
	availCalc: any;
	isFriend: boolean;
	isOrg: boolean;
}

//**** schemas ****
let PlatformsSchema = {
    steam: String,
    xbl: String,
    psn: String,
	nintendo: String,
	gog: String,
	epic: String,
	origin: String,
	uplay: String
};

let GamerSchema = new Schema({
	username: {
		type: String,
		unique: 'Username already taken'
	},
	avatarUrlSm: String,
	avatarUrlLg: String,
	avatarIcon: String,
	platforms: PlatformsSchema,
	games: [{
		type: String,
		ref: 'Game'
	}],
    gamesPreferred: [{
		type: String,
		ref: 'Game'
	}],
	orgs: [{
		type: Schema.Types.ObjectId,
		ref: 'Org'
	}],
	friends: [{
		type: Schema.Types.ObjectId,
		ref: 'Gamer'
	}],
    rooms: [{
		type: Schema.Types.ObjectId,
		ref: 'Room'
	}],
	avails: {
		type: Array,
		default: [{}, {}, {}, {}, {}, {}, {}]
	},
	availsArr: {
		type: Array,
		default: []
	},
	hasAvail: Boolean,
	//searchFilters: SearchFilterSchema,
	zipCode: String,
	updateTS: Date,
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User'
	},
	availCalc: Object,
	isFriend: Boolean,
	isOrg: Boolean
}, { strict: false, minimize: false });

GamerSchema.index({ username: 1 });
GamerSchema.index({ 'availsArr': 1 }, { sparse: true });

export let Gamer = mongoose.model<IGamer>('Gamer', GamerSchema);