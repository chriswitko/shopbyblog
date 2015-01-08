"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schemal

var SECTION_FORHIM = 1, SECTION_FORHER = 2, SECTION_HOMEDESIGN = 3;

var blogSchema = new mongoose.Schema({
  title: String,
  description: String,
  url: String,
  website: String,
  twitterScreenName: String,
  facebookUsername: String,
  language: String,
  imageFileName: String, // s, m, l, o
  section: { type: Number, default: SECTION_FORHIM },

  curated: { type: Boolean, default: false },
  inactive: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },

  owner: {type : Schema.ObjectId, ref : 'User'},
  moderators: [{type : Schema.ObjectId, ref : 'User'}],

  createdAt: Date,
  claimedAt: Date
});

/**
 * Hash the password for security.
 * "Pre" is a Mongoose middleware that executes before each save() call.
 */

blogSchema.pre('save', function(next) {
  var blog = this;

  return next();
});

/**
 * Get Image Url.
 */

blogSchema.methods.image = function(size) {
  if (!size) size = 'l';

  return '/uploads/' + size + '_' + this.imageFileName;
};

module.exports = mongoose.model('Blog', blogSchema);
