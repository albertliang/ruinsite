'use strict';

import * as express from 'express';
import {ResultsHandler} from '../results.controller';
import { Platform, IPlatform } from '../../models/platform.model';
import { RoomsController } from '../rooms/rooms.controller';
import { IRoom } from '../../models/room.model';
import { Gamer, IGamer } from '../../models/gamer.model';
import _ = require('lodash');

export namespace PlatformsController {

    //static variable
    let platformData: IPlatform[];

    /* exposed CRUD members */

    export function GetPlayerAliases(req: express.Request, res: express.Response) {
        const roomId = req.params.roomId;
        const platform = req.params.platform;
        _GetPlayerAliases(roomId, platform, (err: Error, aliasResults: any) => { ResultsHandler(err, aliasResults, res); });
    }

    /* inner CRUD members */

    /**
     * Look up a room's players and what their assoc gamertags are for that platform
     */
    export async function _GetPlayerAliases(roomId: string, platform: string, callback: any) {

        const platforms = await _GetPlatforms();
        const foundPlatform = _.find(platforms, (p => p.slug === platform));

        if (foundPlatform == null)
            return callback(null, null);

        // get the room's players
        RoomsController._Read(roomId, (err: Error, room: IRoom) => {
            if (room && room.players) {

                const gamerIds = room.players.map( p => p.gamer);

                // and look up their gamertags for the specified platform
                Gamer.find({_id: {$in : gamerIds}}, 'platforms username', (err: Error, gamers: IGamer[]) => {
                    let players = gamers.map(gamer => {
                        const gamerPlatforms: any = gamer.platforms;
                        return { gamerId: gamer._id, alias: gamerPlatforms[foundPlatform.platform] };
                    });

                    const result = {url: foundPlatform.url, platform: foundPlatform.platform, players: players};
                    callback(null, result);
                });
            }
        });

    }

    async function _GetPlatforms() {
        if (!platformData) {
            platformData = await Platform.find({platform : {$ne: null}}, 'abbreviation slug platform url').exec();
        }

        return platformData;
    }

}
