'use strict';

export interface ISiteConfig{
    db: string;
    port: number;
    app: {
        title: string,
        realm: string
    };
    jwt: {
        secret: string;
        expires: number;
        issuer: string;
        audience: string;
    };
    sendGrid: {
		from: string,
		apikey: string,
        adminEmail: string,
        templates: {
            onboarding: string
        }
    };
    amazonAWS: {
        accessKeyId: string,
        secretAccessKey: string,
        bucketName: string,
        cloudFrontDomain: string
    };
    public_folder: string;
    logConfig: any;
    logLevel: string;
    emailIfNewUser: boolean;
    emailIfNewRoom: boolean;
}

export var Config: ISiteConfig = require('./env/' + (process.env.NODE_ENV || 'development'));

