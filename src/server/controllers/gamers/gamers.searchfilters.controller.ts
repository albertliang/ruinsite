'use strict';

import {IGamer, ISearchFilter} from '../../models/gamer.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';

export namespace GamerSearchFiltersController {

    let Gamer = mongoose.model<IGamer>('Gamer');

    /* exposed CRUD members */
    export function Update(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        _Update(id, req.body, (err: Error, gamer: IGamer) => { ResultsHandler(err, null, res); });
    }

    /* inner CRUD members */
    export function _Update(id: string, doc: ISearchFilter, callback: any) {
        Gamer.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, { $set: {'searchFilters' : doc} }, callback);
    }

}
