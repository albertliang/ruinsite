'use strict';

import * as mongoose from 'mongoose';

//**** interfaces ****
export interface IAvailabilityQueue extends mongoose.Document {
    _id: mongoose.Types.ObjectId; //same as gamerId!!!
	gamer: mongoose.Types.ObjectId;
	email: String;
	timezone: String;
	dayIndex: number;
	emailAvailHourUtc: number;
}

//**** schemas ****

let Schema = mongoose.Schema;

let AvailabilityQueueSchema = new Schema({
	gamer : {
		type: Schema.Types.ObjectId,
		ref: 'Gamer'
	},
	email: String,
	timezone: String,
	dayIndex: Number,
	emailAvailHourUtc: Number
});

export let AvailabilityQueue = mongoose.model<IAvailabilityQueue>('AvailabilityQueue', AvailabilityQueueSchema);