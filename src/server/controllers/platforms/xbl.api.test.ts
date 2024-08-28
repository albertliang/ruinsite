
'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as express from 'express';
import {User, IUser} from '../../models/user.model';
import {XboxLiveAPI} from '../../controllers/platforms/xbl.api';
import * as cleanup from '../test/testcleanup';
let ReadLine = require('readline');

let rl = ReadLine.createInterface({
	'input': process.stdin,
	'output': process.stdout
});

let req: express.Request;
let res: express.Response;
let user: IUser = new User({
    email: 'test@test.com',
    timezone: 'EST',
    roles: ['user', 'admin'],
    username: 'username',
    password: 'password',
    platforms: { xbl: {xblId : '2596271570898986', gamerTag : 'Dakhath'}},
    orgsRequests: []
});


describe('Testing xbl Platform API Controllers', function() {

    this.timeout(0); //remove timeout for debugging purposes

    // it.skip('test oauth login and send message', function(done) {
    //     //get user from previous saved instance
    //     User.findOne({username: user.username}, (err: Error, authUser: IUser) => {
    //         if (!authUser) {
    //             expect.fail(true, false, 'authorized user doesn\'t exist');
    //             done();
    //         }
    //         let message = 'this a test message from RUIn';
    //         XboxLiveAPI.SendMessage(authUser, '76561198294006375', message).then((err: Error) => {
    //             expect(err).to.equal(null);
    //             done();
    //         });
    //     });
    // });

    it('test user should have more than 1 friend', function(done) {
        XboxLiveAPI.GetUserFriends(user.platforms.xbl.xblId).then((results: any) => {
            expect(results.length).to.be.greaterThan(0, 'user should have more than one xbl friend');
            done();
        });
    });

    it('test user should have more than 1 game', function(done) {
        XboxLiveAPI.GetUserGames(user.platforms.xbl.xblId).then((results: any) => {
            expect(results.titles.length).to.be.greaterThan(0, 'user should have more than one xbl game');
            done();
        });
    });

    it('test user should have a valid profile', function(done) {
        XboxLiveAPI.GetProfiles([user.platforms.xbl.xblId]).then((results: any) => {
            expect(results[0].gamerTag).to.be.equal('Dakhath', 'expected username from xbl should be Dakhath');
            done();
        });
    });

    // it.skip('find other friends that have the same game', function(done) {
    //     // game is FTL
    //     XboxLiveAPI.GetFriendsThatPlay(user, '212680', (err: Error, results: any) => {
    //        // expect(results.response.players[0].personaname).to.be.equal('Dakhath', 'expected username from xbl should be Dakhath');
    //         done();
    //     });
    // });

});
