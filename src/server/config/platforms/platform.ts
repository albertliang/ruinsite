'use strict';

class PlatformsConfig {
    Steam: IPlatformApiConfig = require('./steam').Steam;
    XBL: IPlatformApiConfig = require('./xbl').XBL;
    PSN: IPlatformApiConfig = null;
    IGDB: IPlatformApiConfig = require('./igdb').IGDB;
}

export interface IPlatformApiConfig {
    key: string;
    token?: string;
}

export let PlatformConfig = new PlatformsConfig();

