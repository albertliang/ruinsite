'use strict';

import * as mongoose from 'mongoose';
import {IRoom} from '../../models/room.model';
import {IGame} from '../../models/game.model';
import {IGamer} from '../../models/gamer.model';
import * as _ from 'lodash';

export class DashboardWeekRooms {
    gamerId: mongoose.Types.ObjectId;
    gamer: any;
    games: IGame[];
    dayRoomGroups: Record<string, IRoom[]>;
    timeInc30Offset: number;

    //output matching room results in converted local TimeInc30
    toJSON() {
        let jsonResult: any = {};
        jsonResult.gamerId = this.gamerId;
        jsonResult.gamer = this.gamer;
        jsonResult.games = {};
        this.games.forEach(game => {
            jsonResult.games[game.gameId] = game;
        });
        jsonResult.rooms = this.dayRoomGroups;

        return jsonResult;
    }
}
