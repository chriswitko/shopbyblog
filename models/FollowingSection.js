"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
This document means that the Twitter user with numeric id 12345 has been followed by user 54321 since August 21. The last scan of user 12345, when user 54321 still showed up in the followers list, happened at 6am on August 23rd. At 7:50am that day, user 54321 was no longer following 12345. A document with no “end” field means that the “follower” is still following the “followee”.
 */

var followingSectionSchema = new mongoose.Schema({
  section: {type : Number},
  follower: {type : Schema.ObjectId, ref : 'User'},

  start: Date,
  last: Date,
  end: Date
});

/**
 * Hash the password for security.
 * "Pre" is a Mongoose middleware that executes before each save() call.
 */

followingSectionSchema.pre('save', function(next) {
  var following = this;

  return next();
});


module.exports = mongoose.model('FollowingSection', followingSectionSchema);
