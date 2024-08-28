'use strict';

import {ISiteConfig} from '../config';

class SiteConfig implements ISiteConfig {
    db = 'mongodb://localhost/ruin-test';
    port = 3001;
    app = {
        title: 'RUIn - Test Environment',
        realm: 'http://localhost:3001'
    };
    jwt = {
        secret: 'secrettest',
        expires: 30,
        issuer: 'accounts.ru-in.com',
        audience: 'ru-in.com'
    };
    sendGrid = {
		from: 'noreply@ruingaming.io',
		apikey: '**************************',
        adminEmail: 'admin@ruingaming.io',
        templates: {
            onboarding: '0dd18131-dd64-4360-80b2-493ab3c831ec'
        }
    };
    amazonAWS = {
        accessKeyId: '********************',
        secretAccessKey: '************************',
        bucketName: 'ruingaming-roomlink',
        cloudFrontDomain: 'd90b7j8wcmcte.cloudfront.net'
    };
    public_folder = 'public';
    logConfig = {
       /* appenders: [
            { type: 'console' },
            { type: 'file', filename: 'logs/test.log' }
        ],
        replaceConsole: true*/
        appenders: {
            out: { type: 'console' },
            app: { type: 'file', filename: 'logs/test.log' }
            },
        categories: {
            default: { appenders: [ 'out', 'app' ], level: 'debug' }
        }
    };
    logLevel = 'DEBUG';
    emailIfNewUser = false;
    emailIfNewRoom = false;
}

module.exports = new SiteConfig();
