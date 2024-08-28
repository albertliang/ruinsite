'use strict';

/**
 * Module dependencies.
 */
import {expect} from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';
import * as express from 'express';
import {IUser, User, IUserModel} from '../../models/user.model';
import {UsersController} from './users.controller';
import * as cleanup from '../test/testcleanup';

let	app: express.Express = require('../../server');
let request = require('supertest');
let agent = request.agent(app);

/**
 * Globals
 */
let _user: any = {
    email: 'test@test.com',
    timezone: 'EST',
    roles: ['user', 'admin'],
    username: 'username',
    password: 'password',
    orgsRequests: []
};
let user2: IUser;

/**
 * Unit tests
 */
describe('User Controller Tests', function() {

    this.timeout(0);

    before((done) => {
        cleanup.ClearCollections(done);
    });

	describe('Method Save', function() {
		it('should begin with no users', function(done) {
			User.find({}, function(err: Error, users: IUser[]) {
				expect(users.length).to.equal(0, 'there should be no existing users');
				done();
			});
		});

		it('should be able to save without problems', function(done) {
            let user = new User(_user);
			user.save(done);
		});

		it('should fail to save an existing user again', function(done) {
            let user = new User(_user);
			user.save((err: Error, doc: IUser) => {
                let user2 = new User(_user); //save a diff user but with the same data
                user2.save(function(err) {
                    expect(err).not.equals(null);
                    done();
			    });
            });
		});

		it('should throw a validation error if required field is missing', function(done) {
            let user = new User(_user);
			user.username = '';
			user.save(function(err: Error, doc: IUser) {
				expect(err).not.equals(null);
				done();
			});
		});
	});

    describe('Test Schema Methods', function() {
        it('findUniqueUsername should find unique user on first try', function(done) {
			User.findUniqueUsername('UniqueDude', 0, function(username: string) {
				expect(username).to.equal('UniqueDude');
				done();
			});
		});

        it('findUniqueUsername should increment non-unique user', function(done) {
            User.findUniqueUsername('username', 0, function(username: string) {
                expect(username).to.equal('username1');
                done();
            });
		});

    });

    describe('Test Schema Statics', function() {
        it('hashPassword should work', function(done) {
            let user = new User(_user);
			let pwd = user.hashPassword('password');
            expect(pwd.length).to.be.greaterThan(0);
            done();
		});
    });

    describe('Test Schema Hooks', function() {
        it('lowercaseUsername should work', function(done) {
            _user.username = "UserName";
            let user = new User(_user);
            user.save(function(err: Error, doc: IUser) {
                expect(doc.lowercaseUsername).to.equal('username');
                done();
            });
        });
    });

});
