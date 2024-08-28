// 'use strict';

// /*
//  * Module dependencies.
//  */
// let moment = require('moment-timezone');

// let abbrs: any = {
//     EST : 'Eastern Standard Time',
//     EDT : 'Eastern Daylight Time',
//     CST : 'Central Standard Time',
//     CDT : 'Central Daylight Time',
//     MST : 'Mountain Standard Time',
//     MDT : 'Mountain Daylight Time',
//     PST : 'Pacific Standard Time',
//     PDT : 'Pacific Daylight Time',
// };

// //override
// moment.fn.zoneName = function () {
//     let abbr = this.zoneAbbr();
//     return abbrs[abbr] || abbr;
// };

// moment.tz.setDefault('UTC');