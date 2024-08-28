'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as moment from 'moment';
import * as _ from 'lodash';
import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IGame, Game} from '../../models/game.model';
import {IRoom, Room} from '../../models/room.model';
import {Authentication} from '../../controllers/users/users.controller.authentication';
import * as cleanup from '../test/testcleanup';

let	app: express.Express = require('../../server');
let request = require('supertest');
let agent = request.agent(app);

/**
 * Globals
 */
let today = moment().startOf('day');
let credentials: any = {
    username: 'username',
    password: 'password'
};
let _user: any = {
    email: 'test@test.com',
    timezone: 'EST',
    roles: ['user', 'admin'],
    username: credentials.username,
    password: credentials.password,
    provider: 'local'
};
let _game: any = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Game1',
    platformId: 'steam',
    gameId: '1'
};
let _room: any = {
    _id: new mongoose.Types.ObjectId(),
    game: _game._id,
    org: new mongoose.Types.ObjectId(),
    host: new mongoose.Types.ObjectId(),
    gameMode: 'Classic',
    description: 'room Typed',
    hostUsername : 'bob',
    startTime: today.toDate(),
    startTimeInc30: 0, //12:00am
    players: []
};
let authHeaders: any = {'Content-Type': 'application/json'};

/**
 * room routes tests
 */
describe('User Controller Authentication Tests', function() {

    this.timeout(0);

	before((done) => {
        cleanup.ClearCollections( () => {
            let game = new Game(_game);
            game.save(done);
        });
    });

    it('should signup correctly, create a user, and produce a duplicate gamer record', function(done) {
        agent.post('/auth/signup')
            .send(_user)
            .expect(200)
            .end(function(signupErr: Error, res: any) {
                let token = res.body;
                let userId: string = '';
                if (token.user._id) { userId = token.user._id; }

                expect(token.user, 'token value should have a user attached');

                Gamer.find({username: credentials.username}, (err: Error, gamers: IGamer[]) => {
                    expect(gamers[0].id, 'gamer record with matching id should exist').to.equal(userId);
                    done();
                });
            });
    });

	it('should be able to save a room if logged in', function(done) {

		agent.post('/auth/signin')
			.send(credentials)
			.expect(200)
			.end(function(signinErr: Error, signinRes: express.Response) {
				if (signinErr) { done(signinErr); }

                // Create JWT and stick it in the auth headers
                let res: any = signinRes;
                if (res.body.token) {
                    authHeaders['authorization'] = 'JWT ' + res.body.token;
                }

				// Save a new room
				agent.post('/api/rooms')
                    .set(authHeaders)
					.send(_room)
					.expect(200)
					.end(function(roomSaveErr: Error, res: express.Response) {
						if (roomSaveErr) { done(roomSaveErr); }

						// Get a list of rooms and verify it's there
						agent.get('/api/rooms/' + _room._id.toString())
                            .set(authHeaders)
							.end(function(roomsGetErr: Error, roomGetRes: any) {
								// Handle room save error
								if (roomsGetErr) { done(roomsGetErr); };

								let room = roomGetRes.body;
								expect(room.description).equals('room Typed');
                                done();
							});
					});
			});
	});

    it('should be see own profile if logged in', function(done) {

		agent.post('/auth/signin')
			.send(credentials)
			.expect(200)
			.end(function(signinErr: Error, signinRes: express.Response) {
				if (signinErr) { done(signinErr); }

                // Create JWT and stick it in the auth headers
                let res: any = signinRes;
                if (res.body.token) {
                    authHeaders['authorization'] = 'JWT ' + res.body.token;
                }

				// get own profile
				agent.get('/api/users/me')
                    .set(authHeaders)
					.expect(200)
					.end(function(err: Error, res: any) {
                        expect(res.body.username).equals('Full', 'expecting to get user profile back but name does not match');
                        done();
					});
			});
	});

	it('should NOT be able to save room instance if not logged in', function(done) {
		agent.post('/api/rooms')
			.send(_room)
			.expect(401)
            .end(function(roomSaveErr: Error, res: express.Response) {
				// Call the assertion callback
				done(roomSaveErr);
			});
	});

    it('should not regen salt/password if doing an update', function(done) {
        _user.username = 'bob2';
        let user = new User(_user);
		user.save(function(err: Error, user1: IUser){
            if (err) { done(err); }

            let oldPwd = user1.password;
            //let oldFirstName = user.firstName;
            expect(user1.username).to.equal('bob2', 'first save should work');
            //user.firstName = 'kebab';

            //save a 2nd time
            user.save(function(err: Error, user2: IUser){
                if (err) { done(err); }
                //expect(user2.firstName).to.not.equal(oldFirstName, 'second save should have changed firstName value');
                expect(user2.password).to.equal(oldPwd, 'second save password should be unchanged');
                done();
            });
        });

	});

    it('should fail to authenticate an invalid token', function(done) {
        // Create JWT and stick it in the auth headers
        authHeaders['authorization'] = 'JWT ' + 'junk';

        // get list of rooms
        agent.get('/api/rooms')
            .set(authHeaders)
            .expect(401)
            .end(function(err: Error, res: express.Response) {
                if (err) { done(err); }
                done();
            });
	});

    it('should fail to authenticate expired token', function(done) {
        let token = Authentication.CreateJwtToken(_user.id, -1); //create expired token

        // Create JWT and stick it in the auth headers
        authHeaders['authorization'] = 'JWT ' + token;

        // get list of rooms
        agent.get('/api/rooms')
            .set(authHeaders)
            .expect(401)
            .end(function(err: Error, res: express.Response) {
                if (err) { done(err); }
                done();
            });
    });

});

// function addJwtTokenToHeader(req: express.Request) {

//     let valid_jwt : {
//          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMzQ1Njc4OTAsIm5hbWUiOiJKb2huIERvZSIsImlzcyI6ImV4YW1wbGVzb2Z0LmNvbSIsImV4cCI6Ijk5OTk5OTk5OTkifQ.CbpI0TNI-FYXe6p3PgM__jwlz6aCT1qpUBsTVCfWuBM',
//          payload : {
//              'sub': '1234567890',
//              'name': 'John Doe',
//              'iss': 'examplesoft.com',
//              'exp': '9999999999'
//          },
//          secret: 'secret'
//      };

//     req.headers['authorization'] = 'JWT ' + valid_jwt.token;
// }
