'use strict';

import {expect} from 'chai';
import {User, IUser} from '../../models/user.model';
import {Gamer, IGamer} from '../../models/gamer.model';
import {CommentQueue, ICommentQueue, } from '../../models/commentqueue.model';
import {Message} from './message';
import {Config} from '../../config/config';
import {TestData} from '../test/testdata';
import * as cleanup from '../test/testcleanup';

let user: IUser;
let commentQueue: ICommentQueue;

describe('Message Tests', function() {

    this.timeout(0);

    before((done: any) => {
        TestData.ClearAndCreateTestData((err: Error, testdata: any) => {
            if (err) {
                return done(err);
            }
            user = testdata.user1[0];
            commentQueue = new CommentQueue({
                hostUsername: 'Dakhath',
                gameName: 'Awesome Game',
                comments : [
                    {
                        username: 'SomeDude',
                        gamer: user._id,
                        comment: 'hey',
                        ts: new Date()
                    }, {
                        username: 'SomeDude',
                        gamer: user._id,
                        comment: 'hey again',
                        ts: new Date()
                    }
                ],
                players: [ {
                    username: 'SomeDude',
                    gamer: user._id,
                    avatarUrlSm: ''
                }
            ]
            });
            commentQueue.save(done);
        });
    });

    it('should process new comment queue records', function(done: any) {
        Message._SendNewCommentsEmail().then((results: any) => {
            done();
        });
    });


});