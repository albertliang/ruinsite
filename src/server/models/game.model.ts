'use strict';

import * as mongoose from 'mongoose';

let Schema = mongoose.Schema;

export interface IGame extends mongoose.Document {
    _id: string;
    gameId: string;
    platformId?: string;
    platforms: string[];
    name: string;
    iconSm: string;
    iconLg: string;
    imageId: string;
    releaseDate: number;
    usrRequest?: boolean;
}

let GameSchema = new Schema({
    _id: String,
    gameId: String,
    platformId: String,
    platforms: [String],
    name: String,
    iconSm: String,
    iconLg: String,
    imageId: String,
    releaseDate: Number,
    usrRequest: Boolean
});

GameSchema.index({name: 1});
GameSchema.index({gameId: 1}, { unique: true });

export let Game = mongoose.model<IGame>('Game', GameSchema);