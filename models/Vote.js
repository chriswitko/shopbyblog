"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
This document means that the user with numeric id 12345
has been followed by user 54321 since August 21.
The last scan of user 12345, when user 54321 still showed up
in the followers list, happened at 6am on August 23rd.
At 7:50am that day, user 54321 was no longer following 12345.
A document with no “end” field means that the “follower” is still following the “followee”.
 */

var voteSchema = new mongoose.Schema({
  product: {type : Schema.ObjectId, ref : 'Product'},
  follower: {type : Schema.ObjectId, ref : 'User'},

  start: Date,
  last: Date,
  end: Date
});

voteSchema.pre('save', function(next) {
  var vote = this;

  return next();
});


module.exports = mongoose.model('Vote', voteSchema);
