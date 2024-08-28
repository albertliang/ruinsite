'use strict';

import * as mongoose from 'mongoose';

let Schema = mongoose.Schema;

export interface IValet extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    token: string;
    expiredBy: Date;
}

let ValetSchema = new Schema({
    user: {
		type: Schema.Types.ObjectId,
		ref: 'User'
	},
    token: String,
    expiredBy: Date
});

export let Valet = mongoose.model<IValet>('Valet', ValetSchema);