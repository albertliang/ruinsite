'use strict';

import {PlatformConfig} from '../../config/platforms/platform';
import {IGame, Game} from '../../models/game.model';
import {IPlatform, Platform} from '../../models/platform.model';
import * as log4js from 'log4js';
import Axios from 'axios';
import moment = require('moment');

let igdbApi: any = null;

let _ = require('lodash');
let logger = log4js.getLogger();

const secondsInYear = 31622400;
const secondsInWeek = 604800;
const getYearsWorthOfGames = 5;
const getGamesWithinWeeksOfRelease = 3;
const baseimgUrl = 'https://images.igdb.com/igdb/image/upload/';

// tslint:disable-next-line:class-name
class _IGDBImportAPI {

    // gets all games from igdb since the last sync
    async SyncGamesList() {
        let startDateCutoff: number;
        let endDateCutoff: number;

        //load all platforms we accept and put in dictionary
        let platformDict: Record<number, string> = {};
        const platforms: IPlatform[] = await Platform.find({}).exec();
        platforms.forEach( platform => {
            platformDict[platform.platformId] = platform.slug;
        });

        //set new bearer token from twitch
        await this._SetAuthToken();

        //get the latest releaseDate we have on record
        return Game.findOne({}).sort({'releaseDate': -1 }).limit(1).exec()
            .then( (game: IGame) => {
                //don't get games part releasedates we already have in the db, or past n years
                startDateCutoff = (game && game.releaseDate) ? game.releaseDate : moment().unix() - (secondsInYear * getYearsWorthOfGames);
                //get a game if it's within a n weeks of release
                endDateCutoff = moment().unix() + (secondsInWeek * getGamesWithinWeeksOfRelease);

                logger.info(`importing igdb games from ${moment.unix(startDateCutoff).toDate()} to ${moment.unix(endDateCutoff).toDate()}`);
                return this._ProcessBatch(startDateCutoff, endDateCutoff, platformDict);
            });
            // .catch( (err: any) => {
            //     logger.error('Error occurred importing games from IGDB: ' + err.message, err);
            // });
    }

    async SyncSingleGame(gameName: string) {

        //set new bearer token from twitch
        await this._SetAuthToken();
        
        //get first game returned that matches IGDB
        let sourceGames = (await this._GetGame(gameName));
        let sourceGame = sourceGames[0];

        //load all platforms we accept and put in dictionary
        let platformDict: Record<number, string> = {};
        const platformsLookup: IPlatform[] = await Platform.find({}).exec();
        platformsLookup.forEach( platform => {
            platformDict[platform.platformId] = platform.slug;
        });

        //convert platform ids to descriptions
        let platforms: String[] = [];

        sourceGame.platforms.forEach((platform: number) => {
            let platformStr = platformDict[platform];
            if (platformStr) {
                platforms.push(platformStr);
            }
        });

        //create a IGamer obj
        let game: any = {
            _id: sourceGame.id,
            gameId: sourceGame.id,
            name: sourceGame.name,
            platforms: platforms,
            platformId: platforms[0], //deprecated but keeping to avoid breakeage
            releaseDate: sourceGame.first_release_date,
            iconSm: (sourceGame.cover ? baseimgUrl + 't_cover_small/' + sourceGame.cover.image_id + '.jpg' : null),
            iconLg: (sourceGame.cover ? baseimgUrl + 't_cover_big/' + sourceGame.cover.image_id + '.jpg' : null),
            imageId: sourceGame.cover.image_id
        };

        Game.create(game, (err: Error, res: any) => {
            if (err) {
                logger.error(`game already exists: ${game.name}`);
            } else {
                logger.info(`game added: ${game.name}`);
            }
        });

    }

    /**
     * Get Games, Filter them, and save to db
     * import a page of results
     *      get a page of game results
     *      process those results and filter for:
     *          game_modes contains 2
     *          release_dates contains
     *              platform contains 6, 49, 48, 41, 130
     *      push filtered results into array and save each one
     *          if release date is older than the largest release date, stop
     */
    async _ProcessBatch(startDateCutoff: number, endDateCutoff: number, platformDict: Record<number, string>): Promise<String[]> {

        let isProcessNextBatch: boolean = true;
        let gamesSaved: String[] = [];
        let pageOffset: number = 0;

        while (isProcessNextBatch == true) {

            try {
                let gamesToSave: IGame[] = [];
                let sourceGames = await this._GetGames(pageOffset, startDateCutoff, endDateCutoff, platformDict);

                //if there are no results, we've gone over the deep end. Just stop.
                if (!sourceGames || !sourceGames.length || sourceGames.length < 500 ) {
                    isProcessNextBatch = false;
                }

                //create a IGamer obj for each
                // sourceGames.forEach((sourcegame: any) => {
                for (const sourcegame of sourceGames) {

                    //convert platform ids to descriptions
                    let platforms: string[] = [];
                    sourcegame.platforms.forEach((platform: number) => {
                        let platformStr = platformDict[platform];
                        if (platformStr) {
                            platforms.push(platformStr);
                        }
                    });
                    let game: IGame = {
                        _id: sourcegame.id,
                        gameId: sourcegame.id,
                        name: sourcegame.name,
                        platforms: platforms,
                        releaseDate: sourcegame.first_release_date,
                        iconSm: (sourcegame.cover ? baseimgUrl + 't_cover_small/' + sourcegame.cover.image_id + '.jpg' : null),
                        iconLg: (sourcegame.cover ? baseimgUrl + 't_cover_big/' + sourcegame.cover.image_id + '.jpg' : null),
                        imageId: (sourcegame.cover ? sourcegame.cover.image_id : null)
                    };
                    gamesSaved.push( game.gameId + ': ' + game.name);
                    gamesToSave.push(game);
                }

                await Game.insertMany(gamesToSave, {ordered: false});

                pageOffset++;
            }
            catch (err) {
                logger.error(`something went horribly wrong: ${err}`);
            }
        }

        return gamesSaved;
    }

    async SaveGames(gamesToSave: IGame[]){
        const saveGameCalls: any[] = [];

        //now save the games
        gamesToSave.forEach((gameToSave: IGame) => {
            saveGameCalls.push( Game.create(gameToSave, (err: Error, res: any) => {
                if (err) {
                    logger.error(`game already exists: ${gameToSave.name}`);
                } else {
                    logger.info(`game added: ${gameToSave.name}`);
                }
            }) );
        });
        await Promise.all(saveGameCalls);
    }

    /**
     * Gets games list from igdb.com
     * pageOffset - there's a results cap of 500 so we can't get everything in one shot
     */
    async _GetGames(pageOffset: number, startDateCutoff: number, endDateCutoff: number, platformDict: Record<number, string>) {

        //platforms filter
        const platformFilter = Object.keys(platformDict).map(Number).join();
        const query = `fields id,name,cover.image_id,game_modes,platforms,first_release_date;
            where game_modes = (2)
            & cover != null
            & first_release_date >= ${startDateCutoff}
            & first_release_date <= ${endDateCutoff}
            & total_rating > 60
            & platforms = (${platformFilter})
            & version_parent = null;
        sort first_release_date asc;
        limit 500;
        offset ${pageOffset * 500};`
        
        //game mode is multiplayer, has cover art, reviewed ok or better, is the standard edition
        let response = await igdbApi.post('games', query );

        return response.data;

    }

    async _GetGame(gameName: string) {

        //game mode is multiplayer, has cover art, reviewed ok or better, is the standard edition
        let response = await igdbApi.post('games',
            `fields id,name,cover.image_id,game_modes,platforms,first_release_date;
                where cover != null
                & name ~ *"${gameName}"*;`
        );

        return response.data;
    }

    async _SetAuthToken() {
        var secret = "iqe1u0g2ako68lmmb74u8yhv9ze0f3";
        var request = Axios.create({
            baseURL: `https://id.twitch.tv/oauth2/`,
            headers: { 'Content-Type': 'application/json'}
        });
        var response = await request.post(`token?client_id=${PlatformConfig.IGDB.key}&client_secret=${secret}&grant_type=client_credentials`);

        igdbApi = Axios.create({
            baseURL: `https://api.igdb.com/v4`,
            headers: { 'Content-Type': 'application/json', 'Client-ID': PlatformConfig.IGDB.key, 'Authorization': "Bearer " + response.data["access_token"] }
        });

    }

}

export let IGDBImportAPI = new _IGDBImportAPI();