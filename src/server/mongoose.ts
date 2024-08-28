'use strict';

import * as mongoose from 'mongoose';

module.exports = function(dbUri: string) {
  mongoose.connect(dbUri);
  let db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error...'));
  db.once('openUri', function callback() {
    console.log('db opened for mongoose');
  });
  db.once('close', function callback() {
    console.log('db closed for mongoose');
  });
};