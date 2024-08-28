'use strict';

import * as crypto from 'crypto';
import _ = require('lodash');
let glob = require('glob');

export function ConcatSubArrays(arr: any[], propName: string) {
    let subArr: any[] = [];
    arr.forEach(element => {
        subArr.push(element[propName]);
    });

    return subArr;
}

export function CalcTimeInc15(time: Date) {
	return (time.getUTCHours() * 4) + Math.floor(time.getMinutes() / 15);
}

export function CalcTimeInc30(time: Date) {
	return (time.getUTCHours() * 2) + Math.floor(time.getMinutes() / 30);
}

export function MakeId(length: number = 5) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXY0123456789';

    for ( let i = 0; i < length; i++ ) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

    return text;
}

export function GenerateRandomToken (done: Function) {
    return crypto.randomBytes(20, function(err: Error, buffer: Buffer) {
        let newToken = buffer.toString('hex');
        done(err, newToken);
    });
}

/**
 * Get files by glob patterns
 */
export function getGlobbedFiles(globPatterns: any, removeRoot?: boolean) {
	// For context switching
	let _this = this;

	// URL paths regex
	let urlRegex = new RegExp('^(?:[a-z]+:)?\/\/', 'i');

	// The output array
	let output: any[] = [];

	// If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
	if (_.isArray(globPatterns)) {
		// globPatterns.forEach(function(globPattern: string) {
		// 	output = _.union(output, _this.getGlobbedFiles(globPattern, removeRoot));
		// });
	} else if (_.isString(globPatterns)) {
		if (urlRegex.test(globPatterns)) {
			output.push(globPatterns);
		} else {
			glob(globPatterns, {
				sync: true
			}, function(err: Error, files: any[]) {
				if (removeRoot) {
					files = files.map(function(file) {
						return file.replace(removeRoot, '');
					});
				}

				output = _.union(output, files);
			});
		}
	}

	return output;
};