'use strict';

import * as mongoose from 'mongoose';

let Schema = mongoose.Schema;

export interface IPromo extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    pcode: string;
    addToOrg: mongoose.Types.ObjectId;
    addGame: mongoose.Types.ObjectId;
    extendBy: number; //days
}

let PromoSchema = new Schema({
    pcode: {
		type: String,
		unique: 'Invite code already taken'
	},
    addToOrg: Schema.Types.ObjectId,
    addGame: Schema.Types.ObjectId,
    extendBy: Number //days
});

export let Promo = mongoose.model<IPromo>('Promo', PromoSchema);