// /// <reference path="../../../typings/mongodb/mongodb.d.ts" />
// /// <reference path="../../../typings/lodash/lodash.d.ts" />
// /// <reference path="../../../typings/bluebird/bluebird.d.ts" />
// 
// 'use strict';
// 
// /*
// Populates gamers collection with test database
// Uses the native mongodb driver since mongoose doesn't seem to support bulk insert
// */
// 
// import * as mongodb from 'mongodb';
// import * as mongoose from 'mongoose'
// import * as express from 'express'
// import * as _ from 'lodash'
// import {IGamer} from '../models/gamer.model'
// var promise = require('bluebird');
// 
// //Promise.promisifyAll(require("mongoose"));
// 
// //returns collection of randomly assigned friends given a list of userIds
// function getRandomFriends(userIds: mongodb.ObjectID[], num: number){
//     var friends: mongodb.ObjectID[] = [];
//     
// 	for (var i = 0; i < num; i++) {
//         var rand = _.random(0, userIds.length);
//         friends.push(userIds[rand]);
//     }
//     return friends;    
// }
// 
// function createFakeIds(numUsers: number, numFriends: number)
// {
//     var userIds: mongodb.ObjectID[] = [];
//     var copyUserIds: mongodb.ObjectID[];
//     var friends: mongodb.ObjectID[];
//     var rooms: mongodb.ObjectID[];
// 	var result: any[] = [];
//     
// 	for (var i = 0; i < numUsers; i++) {
//         userIds.push(new mongodb.ObjectID);
//     }   
//     
//     copyUserIds = _.clone(userIds); 
//     
//     //create pseudo-user object
//     //and assign x random friends
//     //and assign y random rooms
// 	while (userIds.length > 0) {
//         friends = getRandomFriends(copyUserIds, numFriends);
//         //rooms = getRandomFriends(copyUserIds, numFriends);
// 		result.push({"_id": userIds.pop(), "friends":friends});
// 	};
//     
//     //TODO: add reciprical friends??? ie: if I'm your friend, you must be my friend
// 
// 	return result;
// }
// 
// function addTestRooms(db: mongodb.Db, users: any[], numRooms: number)
// {
//     return new Promise(function(resolve: any, reject: any) {
//         //clear out the rooms collection
//         var rooms = db.collection("rooms");
//         rooms.remove({});
//         
//         var beginTS = Date.now();
//         
//         var bulk = rooms.initializeOrderedBulkOp();
//         
//         for (var i=0;i<numRooms;i++)
//         {
//             var startDate = new Date();
//             startDate.setHours(_.random(1,13));
// 
//             //randomly assign 2-8 users to each room
//             var players: mongodb.ObjectID[] = [];
//             var playerHostname: string = "bob";
//             var numPlayers = _.random(2,8);
//             
//             for (var j=0;j<numPlayers;j++) {
//                 var index = _.random(0,users.length);
//                 players.push(users[index]._id);
//                 //if (_.isEmpty(playerHostname)) {playerHostname = users[index].username};
//             }
//             
//             //TODO: unless they already have something scheduled
//             
//             bulk.insert({
//                 "_id": new mongodb.ObjectID,
//                 "gameId":new mongodb.ObjectID,
//                 "description":"room description",
//                 "hostUsername":playerHostname,
//                 "joinServer":"www.someserver.com",
//                 "comments":[],
//                 "isLocked":false,
//                 "privacyLevel":_.random(1,5), //0 - none, 1 - invite only, 2 - friends only, 3 - orgs only, 4 - friends or orgs, 5 - any
//                 "startTs":startDate,
//                 "duration":1,
//                 "minPlayers":2,
//                 "maxPlayers":8,
//                 "players":players
//             });
//         }
//         
//         return resolve(bulk.execute());
//         
//         rooms.createIndex({"hostUsername":1});
//         console.log('Room Inserts Done. time taken (ms): ' + (Date.now() - beginTS));
//     })
// }
// 
// function addTestUsers(db: mongodb.Db, users: any[], numUsers: number, numFriendsPerUser: number)
// {
//     return new Promise(function(resolve: any, reject: any) {
//     
//         //clear out the gamers collection
//         var gamers = db.collection("gamers");
//         gamers.remove({});
//         
//         var beginTS = Date.now();
// 
//         //init bulk insert (I know typescript complains, but trust me, it works)
//         var bulk = gamers.initializeOrderedBulkOp();
// 
//         for (var i=0;i<numUsers;i++)
//         {
//             var g1 = _.random(1,10);
//             var g2 = _.random(1,10);
// 
//             var startDate = new Date();
//             startDate.setHours(_.random(1,13));
//             var endDate = new Date();
//             endDate.setHours(startDate.getHours()+2);
// 
//             var user = users.pop();
//             
//             bulk.insert({
//                 "_id": user._id,
//                 "username":"randomGuy"+i,
//                 "platforms":[{"X1":"randomGuy"+i+"_Alias"}],
//                 "games":[g1, g2],
//                 "orgs":[1],
//                 "friends":user.friends,
//                 "rooms":[],
//                 "avail":{"specific":[{"startDate":startDate,"endDate":endDate}]},
//                 "updateTS":startDate});
//         }
//         
//         resolve(bulk.execute());
// 
//         gamers.createIndex({"userName":1});
//         console.log('Gamers Inserts Done. time taken (ms): ' + (Date.now() - beginTS));
//     });
// }
// 
// var numUsers = 10000;
// var numRooms = 1000;
// var numFriendsPerUser = 50;  
// var dbname = "mongodb://localhost:27017/ruin-test";  
// 
// var fakeIds = createFakeIds(numUsers, numFriendsPerUser);
// 
// //add gamers
// mongodb.MongoClient.connect(dbname, (err: Error, db: mongodb.Db)=>{
//     var current = addTestUsers(db,_.clone(fakeIds),numUsers,numFriendsPerUser)
//     current
//         .then(addTestRooms(db,_.clone(fakeIds),numRooms))
//         .then(console.log("hi"));
// });
// 
// // //add rooms
// // mongodb.MongoClient.connect(dbname, (err: Error, db: mongodb.Db)=>{
// //     addTestRooms(db,_.clone(fakeIds),numRooms);
// //     
// //     //update gamers with roomIds
// //     console.log(db.collection("gamers").find({}).length());
// // });
