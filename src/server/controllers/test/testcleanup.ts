'use strict';

import {Game} from '../../models/game.model';
import {Gamer} from '../../models/gamer.model';
import {Org} from '../../models/org.model';
import {Room} from '../../models/room.model';
import {User} from '../../models/user.model';
import {CommentQueue} from '../../models/commentqueue.model';
import {AvailabilityQueue} from '../../models/availabilityqueue.model';
let async = require('async');

/**
 * Clears all the collections
 * used for wiping data in between tests (never use on production!)
 */
export function ClearCollections(callback: Function) {
    async.parallel([
        (cb: any) => {Game.remove({}, cb); },
        (cb: any) => {Gamer.remove({}, cb); },
        (cb: any) => {Org.remove({}, cb); },
        (cb: any) => {Room.remove({}, cb); },
        (cb: any) => {User.remove({}, cb); },
        (cb: any) => {CommentQueue.remove({}, cb); }
        //(cb: any) => {AvailabilityQueue.remove({}, cb); }
    ], (err: Error, results: any) => {
        callback(err);
    });
};