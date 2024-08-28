'use strict';

import * as http from 'http';
import * as https from 'https';
import * as Promise from 'bluebird';
import * as xml2js from 'xml2js';
import * as log4js from 'log4js';

let parser = new xml2js.Parser({explicitArray: false});
let logger = log4js.getLogger();

export function SubmitRequestAsync(options: https.RequestOptions): Promise<Object> {
    return new Promise<any>((resolve, reject) => {
        let req = https.request(options, (res: http.IncomingMessage) => {
            let body: string = '';
            res.on('data', (chunk: any) => {
                body += chunk;
            });
            res.on('end', function () {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    logger.error('httprequest_error', body);
                    reject('httprequest_error');
                }
            });
        } );
        req.on('error', (e: Error) => {
            logger.error('httprequest_error', e);
            reject(e.message);
        });
        req.end();
    });
}

export function SubmitRequestXmlAsync(options: http.RequestOptions): Promise<Object> {
    return new Promise<any>((resolve, reject) => {
        let req = http.request(options, (res: http.IncomingMessage) => {
            let body: string = '';
            res.on('data', (chunk: any) => {
                body += chunk;
            });
            res.on('end', function () {
                parser.parseString(body, (err: Error, json: any) => {
                    if (err) {
                        logger.error('httprequest_error', err, body);
                        reject(err.message);
                    }
                    resolve(json);
                });
            });
        } );
        req.on('error', (err: Error) => {
            logger.error('httprequest_error', err);
            reject(err.message);
        });
        req.end();
    });
}