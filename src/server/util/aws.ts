'use strict';

import {Config} from '../config/config';
let AWS = require('aws-sdk');

AWS.config.update({
    accessKeyId: Config.amazonAWS.accessKeyId,
    secretAccessKey: Config.amazonAWS.secretAccessKey
});

export function UploadFile(host: string, roomId: string, image: string, callback: Function) {
    let imagebuf = new Buffer(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    this.UploadFileBuffer(host, roomId, imagebuf, callback);
}

export function UploadFileBuffer(host: string, roomId: string, imagebuf: Buffer, callback: Function) {

    let s3bucket = new AWS.S3({ params: { Bucket: Config.amazonAWS.bucketName } });
    let filename = host + '/' + roomId + '.jpg';
    let params = {
        Key: filename,
        Body: imagebuf,
        ContentEncoding: 'base64',
        ContentType: 'image/jpeg'
    };

    s3bucket.putObject(params, function (err: Error, data: any) {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
}

export function DeleteFile(host: any, roomId: string, callback: Function) {

    let s3 = new AWS.S3();
    let filename = host + '/' + roomId;
    let params = {
        Bucket: Config.amazonAWS.bucketName,
        Key: filename
    };

    s3.deleteObject(params, function (err: Error, data: any) {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });

}