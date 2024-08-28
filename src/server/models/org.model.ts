'use strict';

import * as mongoose from 'mongoose';
import {IGamer} from './gamer.model';
import {IRoom} from './room.model';
import {IGame} from './game.model';

let Schema = mongoose.Schema;

export interface IComment {
    username: string;
    gamer: mongoose.Types.ObjectId;
    comment: string;
    ts: Date;
}

export interface IOrg extends mongoose.Document {
		_id: mongoose.Types.ObjectId;
		name: string;
		description: string;
		url: string[];
		isOpen: boolean;
		members: mongoose.Types.ObjectId[];
		admins: mongoose.Types.ObjectId[];
		rooms: mongoose.Types.ObjectId[];
		games: string[];
		comments: IComment[];
		abbreviation: string;
}

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

let OrgSchema = new Schema({
		name: {
		type: String,
		unique: 'Group name already taken'
	},
		description: String,
		url: [String],
		isOpen: Boolean,
		members: [{
			type: Schema.Types.ObjectId,
			ref: 'Gamer'
		}],
		admins: [{
			type: Schema.Types.ObjectId,
			ref: 'Gamer'
		}],
		rooms: [{
			type: Schema.Types.ObjectId,
			ref: 'Room'
		}],
		games: [{
			type: String,
			ref: 'Game'
		}],
        comments : [ CommentSchema ],
		abbreviation: {
			type: String,
			unique: 'Group abbreviation already taken',
			sparse: true
		}

});

OrgSchema.index({name: 1});

export let Org = mongoose.model<IOrg>('Org', OrgSchema);