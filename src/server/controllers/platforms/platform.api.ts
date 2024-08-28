'use strict';

import {IUser} from '../../models/user.model';
import {IGamer} from '../../models/gamer.model';
import {IPlatformApi} from './iplatform.api';
import {XboxLiveAPI} from './xbl.api';
import * as HttpRequest from './httprequest';
import * as express from 'express';
import * as log4js from 'log4js';
import * as http from 'http';
import * as Promise from 'bluebird';
import {ResultsHandler} from '../results.controller';
let _ = require('lodash/array');

export namespace PlatformApi {

    // platform factory
    function GetPlatform(platformId: string): IPlatformApi {
        switch (platformId) {
            case 'steam':
                return null;
            case 'xbl':
                return XboxLiveAPI;
            case 'psn':
                return null;
            case 'other':
                return null;
            default:
                return null;
        }
    }

    export function HasCredentials() {
		return function(req: express.Request, res: express.Response, next: () => express.Response) {
            let user: IUser = req.user;
            let platform = GetPlatform(req.params.platformId);

            if (platform.HasCredentials(user)) {
                return next();
            } else {
                return res.send({
                    message: 'user_platform_missing'
                });
            }
        };
	}

    export function GetUserPlatformAlias(gamer: IGamer, platformId: string) {
        let platforms: any = gamer.platforms;
        let alias = platforms[platformId + 'Name'];
        if (alias) {
            return alias;
        } else {
            return null;
        }
    }

    export function GetUserGames(req: express.Request, res: express.Response) {
		let user: IUser = req.user;
		let platformUserId: string = req.params.platformUserId;
        let platform = GetPlatform(req.params.platformId);

		return platform.GetUserGames(platformUserId).then((err: any) => { ResultsHandler(err, true, res); });
	}

    export function GetUserFriends(req: express.Request, res: express.Response) {
		let user: IUser = req.user;
        let platform = GetPlatform(req.params.platformId);
		let platformUserId = platform.GetPlatformUserId(user);

		return platform.GetUserFriends(platformUserId).then((err: any) => { ResultsHandler(err, true, res); });
	}

    export function GetProfiles(req: express.Request, res: express.Response) {
		let platformUserId: string = req.params.platformUserId;
        let platform = GetPlatform(req.params.platformId);

		return platform.GetProfiles([platformUserId]).then((err: any) => { ResultsHandler(err, true, res); });
	}

    export function GetPresences(req: express.Request, res: express.Response) {
		let platformUserId: string = req.params.platformUserId;
        let platform = GetPlatform(req.params.platformId);

		return platform.GetPresences([platformUserId]).then((err: any) => { ResultsHandler(err, true, res); });
	}

	export function AddFriend(req: express.Request, res: express.Response) {
		let user: IUser = req.user;
		let steamId: string = req.params.steamId;
        let platform = GetPlatform(req.params.platformId);

		return platform.AddFriend(user, steamId).then((err: any) => { ResultsHandler(err, true, res); });
	}

	export function SendMessage(req: express.Request, res: express.Response) {
		let user: IUser = req.user;
		let steamId: string = req.body.steamId;
		let message: string = req.body.message;
		let platform = GetPlatform(req.params.platformId);

		return platform.SendMessage(user, steamId, message).then((err: any) => { ResultsHandler(err, true, res); });
	}

}