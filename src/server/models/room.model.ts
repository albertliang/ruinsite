'use strict';

import * as mongoose from 'mongoose';
import {IGamer} from './gamer.model';
import {IGame} from './game.model';
import {IOrg} from './org.model';
import * as util from '../util/util';
let moment = require('moment-timezone');

//**** interfaces ****
export interface IComment {
    username: string;
    gamer: mongoose.Types.ObjectId;
    comment: string;
    ts: Date;
}

export interface IPlayer {
    username: string;
    gamer: mongoose.Types.ObjectId;
	platformAlias?: string;
	avatarIcon?: string;
    isCommitted: boolean; //True-Yes, False-Maybe
}

export interface IRepeat {
	occursOnDays: number[]; // 0-Sunday, 1-Monday, ... 7-Saturday, [3, 6] //means Wed and Saturdays
	occursOnDaysComp: number[]; // hybrid of daysOfWeek + startInc30, used for dashboard filtering
	startsOn: Date;
	endsOn: Date;
	excludes: Date[];
}

export interface IRoom extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
	game: string;
	platformId: string;
    org: mongoose.Types.ObjectId; //org affiliation (optional)
	orgName: string;
	host: mongoose.Types.ObjectId;
    description: string;
    hostUsername: string;
    hostTimezone: string;
    joinServer: string;
    comments: IComment[];
    password: string;
    isLocked: boolean;
    privacyLevel: number; //0 - none, 1 - invite only, 2 - friends only, 3 - org only, 4 - friends or org, 5 - any
    startTime: Date; //Date and Time in UTC when the room is scheduled to start
    startTimeInc30: number; //used for grouping rooms on dashboard, represents 30min increments from midnight, ie: 0=12am, 2=1am, 5=2:30am, 24=12pm, 47=11:30pm
    duration: number;
    maxPlayers: number;
    players: IPlayer[];
    gameMode: string;
	isRepeat: boolean;
	repeatConfig: IRepeat;
	repeatParentId: mongoose.Types.ObjectId; // if this room is an occurrance of a series, this is the parent room Id
	roomCategory: string;
}

//**** schemas ****

let Schema = mongoose.Schema;

let CommentSchema = {
    username: String,
	gamer : {
		type: Schema.Types.ObjectId,
		ref: 'Gamer'
	},
	comment: {
		type : String,
		required : 'comment: comment text required'
	},
	ts : {
		type : Date,
		required : 'comment: timestamp (ts) required'
	}
};

let PlayerSchema = {
    _id: false,
    username: String,
	gamer : {
		type: Schema.Types.ObjectId,
		ref: 'Gamer'
	},
	platformAlias: String,
	avatarIcon: String,
	isCommitted: {
		type : Boolean
	}
};

let RepeatSchema = {
	occursOnDays: [Number], // 0-Sunday, 1-Monday, ... 7-Saturday, [3, 6] //means Wed and Saturdays
	occursOnDaysComp: [Number], // hybrid of daysOfWeek + startInc30, used for dashboard filtering
	startsOn: Date,
	endsOn: Date,
	excludes: [Date]
};

let RoomSchema = new Schema({
	game : {
		type: String,
		ref: 'Game',
		required: 'Game is required'
	},
	platformId : String,
    org : {
		type: Schema.Types.ObjectId,
		ref: 'Org'
	},
	orgName : String,
	host : {
		type: Schema.Types.ObjectId,
		ref: 'Gamer',
		required: 'Host is required'
	},
	gameMode: {
        type: String,
		required: 'Game Mode is required',
        maxlength: 50
    },
	description : {
		type: String,
	},
	hostUsername : String,
	hostTimezone : String,
	joinServer : String,
	comments : [ CommentSchema ],
	password : { type : String },
	isLocked : Boolean,
	privacyLevel : Number, //0 - none, 1 - invite only, 2 - friends only, 3 - org only, 4 - friends or org, 5 - any
    startTime : Date, //Date and Time in UTC when the room is scheduled to start
	startTimeInc30 : Number, //used for grouping rooms on dashboard, represents 30min increments from midnight, ie: 0=12am, 2=1am, 5=2:30am, 24=12pm, 47=11:30pm
    duration : Number,
	maxPlayers : Number,
    players: [PlayerSchema],
	isRepeat: Boolean,
	repeatConfig: RepeatSchema,
	repeatParentId: Schema.Types.ObjectId,
	roomCategory: String
}, { minimize: true });

RoomSchema.pre('save', function (next: Function) {
	this.startTime = moment(this.get('startTime')).tz('UTC').toDate();
    this.startTimeInc30 = util.CalcTimeInc30(this.get('startTime'));
    next();
});

RoomSchema.index({startTime: 1});

export let Room = mongoose.model<IRoom>('Room', RoomSchema);