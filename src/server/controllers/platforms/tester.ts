'use strict';

import * as Promise from 'bluebird';
import * as mongoose from 'mongoose';
let async = require('async');

function RunMe() {

    // async.parallel({
    //     func1: (callback: Function) => { callback(null, 1); },
    //     func2: (callback: Function) => { callback(null, 2); },
    //     func3: (callback: Function) => {
    //         return new Promise<any>((resolve, reject) => { callback(null, 3); });
    //     },
    //     func4: (callback: Function) => {
    //         return new Promise<any>((resolve, reject) => { callback(null, 4); });
    //     },
    // }, (err: Error, results: any) => {
    //     console.log(err);
    //     console.log(results.func1);
    //     console.log(results.func2);
    //     console.log(results.func3);
    //     console.log(results.func4);
    // });

};

RunMe();