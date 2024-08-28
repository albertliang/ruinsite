'use strict';

import * as mongoose from 'mongoose';

let Schema = mongoose.Schema;

export interface IPlatform extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    platformId: number;
    abbreviation: string;
    slug: string;
    platform: string;
    url: string;
}

let PlatformSchema = new Schema({
    platformId: Number,
    abbreviation: String,
    slug: String,
    platform: String,
    url: String
});

PlatformSchema.index({platformId: 1});

export let Platform = mongoose.model<IPlatform>('Platform', PlatformSchema);