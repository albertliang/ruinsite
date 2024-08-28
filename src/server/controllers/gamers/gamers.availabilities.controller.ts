'use strict';

import {IGamer, Gamer} from '../../models/gamer.model';
import {IUser, User} from '../../models/user.model';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {ResultsHandler} from '../results.controller';
import * as tzUtil from '../../util/timezone';
import * as moment from 'moment';
import * as path from 'path';

export namespace GamerAvailabilitiesController {

    /* exposed CRUD members */
    export function AddAvail(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        let dayOfWeek: number = parseInt(req.params.dayOfWeek);
        let timeInc30: number = parseInt(req.params.timeInc30);

        //convert to UTC time
        let offset = tzUtil.Local30AvailToUTC(req.user.timezone, dayOfWeek, timeInc30);
        _AddAvail(id, offset.dayOfWeek, offset.timeInc30, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer, res); });
    }

    export function GetAvail(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        Gamer.findById(id, {'availsArr': 1}, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer, res); });
    }

    export function RemoveAvail(req: express.Request, res: express.Response) {
        let id: string = req.params.gamerId || req.user.id;
        let dayOfWeek: number = parseInt(req.params.dayOfWeek);
        let timeInc30: number = parseInt(req.params.timeInc30);

        //convert to UTC time
        let offset = tzUtil.Local30AvailToUTC(req.user.timezone, dayOfWeek, timeInc30);
        _RemoveAvail(id, offset.dayOfWeek, offset.timeInc30, (err: Error, gamer: IGamer) => { ResultsHandler(err, gamer, res); });
    }

    // export function GetAvail(req: express.Request, res:express.Response){
    //     console.log("Getting availabilities!")
    //     let id:string = req.params.gamerId || req.user.id;
    //     let j = Gamer.findById(id);
    //     res.json(j)
    // }

    /* inner CRUD members */
    export function _AddAvail(id: string, dayIndex: number, timeInc30: number, callback: any) {
        let update: any = {};

        update['avails.' + dayIndex + '.' + timeInc30] = true;
        update['hasAvail'] = true;
        Gamer.findByIdAndUpdate( id, { $set: update, $addToSet: {'availsArr': (dayIndex * 48 + timeInc30)} }, {new: true}, (err: Error, newGamer: IGamer) => {
            return callback(err, newGamer);
        });
    }

    export function _RemoveAvail(id: string, dayIndex: number, timeInc30: number, callback: any) {
        let update: any = {};
        update['avails.' + dayIndex + '.' + timeInc30] = true;
        Gamer.findByIdAndUpdate( id, { $unset: update, $pull: {'availsArr': (dayIndex * 48 + timeInc30)} }, {new: true}, (err: Error, newGamer: IGamer) => {
            return callback(err, newGamer);
        });
    }
}
