'use strict';

import {IGamer, Gamer} from '../../models/gamer.model';
import {IOrg} from '../../models/org.model';
import {OrgsController} from '../orgs/orgs.controller';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';

export namespace GamerOrgsController {

    /* exposed CRUD members */
    // export function Update(req: express.Request, res: express.Response) {
    //     let id: string = req.params.gamerId || req.user.id;
    //     _Update(id, req.body, (err: Error, org: IOrg) => { ResultsHandler(err, null, res); });
    // }

    // export function Import(req: express.Request, res: express.Response) {
    //     let steamGroupName = req.params.groupname;
    //     _Import(req.user._id, steamGroupName, (err: Error, syncResults: any) => { ResultsHandler(err, syncResults, res); });
    // }

    /* inner CRUD members */
    // export function _Update(id: string, docs: [IOrg], callback: any) {
    //     Gamer.findOneAndUpdate( { _id: new mongoose.Types.ObjectId(id) }, { $set: {'orgs' : docs} }, callback);
    // }

}
