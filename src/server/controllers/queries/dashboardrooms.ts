'use strict';

import * as mongoose from 'mongoose';
import {IRoom} from '../../models/room.model';
import {IGame} from '../../models/game.model';
import {IGamer} from '../../models/gamer.model';
import * as _ from 'lodash';

export class DashboardRooms {
    gamerId: mongoose.Types.ObjectId;
    gamer: any;
    games: IGame[];
    avail: any;
    availOthers: any;
    roomGroups: DashboardRoomGroup[] = [];
    timeInc30Offset: number;

    //output matching room results in converted local TimeInc30
    toJSON() {
        let jsonResult: any = {};
        jsonResult.gamerId = this.gamerId;
        jsonResult.gamer = this.gamer;
        jsonResult.games = {};
        this.games.forEach(game => {
            jsonResult.games[game.id] = game;
        });
        jsonResult.avail = this.avail;
        jsonResult.availOthers = this.availOthers;
        jsonResult.rooms = {};
        this.roomGroups.forEach(roomGroup => {
            let timeInc = roomGroup.startTimeInc30 + this.timeInc30Offset;
            if (timeInc < 0) {
                timeInc += 48;
            } else if (timeInc > 47) {
                timeInc -= 48;
            }
            jsonResult.rooms[ (timeInc).toString()] = {
               'userRooms' : _GroupByGame(roomGroup.userRooms),
               'friendRooms': _GroupByGame(roomGroup.friendRooms),
               'orgRooms': _GroupByGame(roomGroup.orgRooms),
               'pubRooms': _GroupByGame(roomGroup.pubRooms)
            };
        });
        return jsonResult;
    }
}

export class DashboardRoomGroup {
    startTimeInc30: number;
    userRooms: IRoom[] = [];
    friendRooms: IRoom[] = [];
    orgRooms: IRoom[] = [];
    pubRooms: IRoom[] = [];

    constructor(startTimeInc30: number) {
        this.startTimeInc30 = startTimeInc30;
    }
}

function _GroupByGame (rooms: IRoom[]) {

    let roomStore: any = {};
    let values: any[] = [];

    rooms.forEach((room: IRoom) => {
        let item = roomStore[room.game.toString()];
        if (item) {
            roomStore[room.game.toString()].rooms.push(room);
        } else {
            roomStore[room.game.toString()] = {gameId: room.game, rooms: [room]};
        }
    });

    return _.values(roomStore);
}
