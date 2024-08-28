'use strict';

import {IGamer, IPlatforms} from '../../models/gamer.model';
import {IUser} from '../../models/user.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as async from 'async';
import * as moment from 'moment';
import * as Promise from 'bluebird';
import {ResultsHandler} from '../results.controller';

export namespace GamerPlatformsController {

    let Gamer = mongoose.model<IGamer>('Gamer');

    /* exposed CRUD members */
    export function Update(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Update(id, req.body, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    /* inner CRUD members */
    export function _Update(id: string, docs: IPlatforms, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, { $set: {'platforms' : docs} }, callback);
    }

}
