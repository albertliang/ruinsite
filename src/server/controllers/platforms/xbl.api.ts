'use strict';

import {PlatformConfig} from '../../config/platforms/platform';
import {IPlatformApi} from './iplatform.api';
import {User, IUser} from '../../models/user.model';
import {IGamer} from '../../models/gamer.model';
import * as HttpRequest from './httprequest';
import * as express from 'express';
import * as log4js from 'log4js';
import * as https from 'https';
import * as Promise from 'bluebird';
import {ResultsHandler} from '../results.controller';
let _ = require('lodash/array');

let logger = log4js.getLogger();

//export namespace SteamAPI {
class _XboxLiveAPI implements IPlatformApi {

	/*******************
	 * IPlatformApi public methods
	 *******************/
	HasCredentials(user: IUser) {
		if (user.platforms &&
			user.platforms.xbl &&
			user.platforms.xbl.xblId) {
			return true;
		} else {
			return false;
		}
	}

	GetPlatformUserId(user: IUser) {
		if (user.platforms && user.platforms.xbl) {
			return user.platforms.xbl.xblId;
		} else {
			return null;
		}
	}

	GetPlatformAlias(gamer: IGamer) {
		if (gamer.platforms) {
			return gamer.platforms.xblName;
		} else {
			return null;
		}
	}

	GetUserGames(xblId: string): Promise<Object> {
        let path = '/v2/' + xblId + '/xboxonegames';
        return HttpRequest.SubmitRequestAsync(this._GetRequestOptions(path));
    }

    GetUserFriends(xblId: string): Promise<Object> {
        let path = '/v2/' + xblId + '/friends';
        return HttpRequest.SubmitRequestAsync(this._GetRequestOptions(path));
    }

	GetProfiles(xblIds: string[]): Promise<Object> {
		let calls: Promise<Object>[] = [];
		xblIds.forEach( xblId => {
        	let path = '/v2/' + xblId + '/profile';
			calls.push(
        		HttpRequest.SubmitRequestAsync(this._GetRequestOptions(path))
			);
		});

		return Promise.all(calls).then( (results: any[]) => {
			let profiles: any[] = [];
			results.forEach( (item) => {
				profiles.push( { id: item.id, gamerTag: item.Gamertag, avatarImg: item.GameDisplayPicRaw } );
			});
			return profiles;
		});
    }

	GetPresences(xblIds: string[]): Promise<Object> {
        let calls: Promise<Object>[] = [];
		xblIds.forEach( xblId => {
        	let path = '/v2/' + xblId + '/presence';
			calls.push(
        		HttpRequest.SubmitRequestAsync(this._GetRequestOptions(path))
			);
		});

		return Promise.all([calls]).then( (results: any[]) => {
			let profiles: any[] = [];
			results.forEach( (item) => {
				profiles.push( { id: item.id, gamerTag: item.Gamertag, avatarImg: item.GameDisplayPicRaw } );
			});
			return profiles;
		});
    }

	SendMessage(user: IUser, recipientSteamId: string, message: string): Promise<Object> {
		return new Promise<any>((resolve, reject) => {
			return null;
		});
	}

	AddFriend(user: IUser, friendSteamId: string) {
		return new Promise<any>((resolve, reject) => {
			return null;
		});
	}

	/*******************
	 * internal methods
	 *******************/
	_GetRequestOptions(path: string): https.RequestOptions {
        let options: https.RequestOptions = {
            hostname: 'xboxapi.com',
            path: path,
            method: 'GET',
            headers: { accept: 'application/json', 'x-auth': PlatformConfig.XBL.key }
        };

        return options;
    }

}

export let XboxLiveAPI = new _XboxLiveAPI();