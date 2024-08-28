// /**
//  * Creates and manages the Mongo connection pool
//  * obtained and modified from:
//  * https://github.com/toymachiner62/mongo-factory
//  * @type {exports}
//  */
// 
// import * as mongodb from 'mongodb';
// import _ = require('lodash');
// var MongoClient = mongodb.MongoClient;
// var promise = require('bluebird');
// 
// class Connection{
//     connectionString: string
//     db: mongodb.Db
// }
// 
// // Store all instantiated connections.
// var connections: Connection[] = [];
// 
// 
// module.exports = function() {
//   return {
// 
//     /**
//      * Gets a Mongo connection from the pool.
//      *
//      * If the connection pool has not been instantiated yet, it is first
//      * instantiated and a connection is returned.
//      *
//      * @returns {Promise|Db} - A promise object that resolves to a Mongo db object.
//      */
//     getConnection: function getConnection(connectionString: string) {
// 
//       return new Promise(function(resolve: any, reject: any) {
//         // If connectionString is null or undefined, return an error.
//         if (!connectionString) {
//           return reject('getConnection must be called with a mongo connection string');
//         }
// 
//         // Check if a connection already exists for the provided connectionString.
//         var pool = _.find(connections, { connectionString: connectionString });
// 
//         // If a connection pool was found, resolve the promise with it.
//         if (pool) {
//           return resolve(pool.db);
//         }
// 
//         // If the connection pool has not been instantiated,
//         // instantiate it and return the connection.
//         MongoClient.connect(connectionString, function(err: mongodb.MongoError, database: mongodb.Db) {
//           if (err) {
//             return reject(err);
//           }
// 
//           // Store the connection in the connections array.
//           connections.push({
//             connectionString: connectionString,
//             db: database
//           });
// 
//           return resolve(database);
//         });
//       });
//     },
// 
//     /**
//      * Exposes Mongo ObjectID function.
//      *
//      * @returns {Function} - Mongo ObjectID function
//      */
//     ObjectID: function() {
//       return new mongodb.ObjectID();
//     }
//   };
// }();
// 
