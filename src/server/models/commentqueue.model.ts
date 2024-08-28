'use strict';

import * as mongoose from 'mongoose';
import {IGamer} from './gamer.model';

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
}

export interface ICommentQueue extends mongoose.Document {
    _id: mongoose.Types.ObjectId; //same as roomId!!!
	isRoomComment: boolean;
	groupName?: string;
	hostUsername: string;
    comments: IComment[];
    players: IPlayer[];
}

//**** schemas ****

let Schema = mongoose.Schema;

let CommentSchema = {
    _id: false,
    username: String,
	gamer : {
		type: Schema.Types.ObjectId,
		ref: 'Gamer'
	},
	comment: String,
	ts: Date,
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

let CommentQueueSchema = new Schema({
	hostUsername: String,
	isRoomComment: Boolean,
	groupName: String,
	gameName: String,
	comments : [ CommentSchema ],
    players: [ PlayerSchema ]
});

export let CommentQueue = mongoose.model<ICommentQueue>('CommentQueue', CommentQueueSchema);