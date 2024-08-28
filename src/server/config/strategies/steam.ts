'use strict';

/**
 * Module dependencies.
 */
import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {UsersController} from '../../controllers/users/users.controller';
import * as passport from 'passport';
import {Config} from '../config';
import {PlatformConfig} from '../platforms/platform';

let SteamStrategy = require('passport-steam').Strategy;

export function InitStrategy() {

    passport.use(new SteamStrategy({
        returnURL: Config.app.realm + '/auth/steamreturn',
        realm: Config.app.realm,
        apiKey: PlatformConfig.Steam.key
    },
    function(steamprofile: string, profile: any, done: Function) {
        //only return profile data to caller to figure out what to do with it
        done(null, steamprofile, profile);
    }));

}

// function UpdateSteamProfile(user: IUser, steamProfile: any, callback: any) {
//     //lookup the gamer

//     Gamer.findOne( {_id: user._id}, (err: Error, gamer: IGamer) => {
//         let isUpdated = false;

//         if (gamer.avatarUrlMd !== steamProfile.photos[1].value ) {
//             gamer.avatarUrlSm = steamProfile.photos[0].value;
//             gamer.avatarUrlMd = steamProfile.photos[1].value;
//             gamer.avatarUrlLg = steamProfile.photos[2].value;
//             isUpdated = true;
//         }
//         if (!gamer.platforms.steamId) {
//             gamer.platforms.steamId = steamProfile.id;
//             gamer.platforms.steamName = steamProfile.displayName;
//             isUpdated = true;
//         }

//         if (isUpdated) {
//             gamer.save(callback);
//         } else {
//             callback(null, user);
//         }
//     });
// }