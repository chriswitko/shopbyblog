"use strict";

var _ = require('lodash');

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var monguurl = require('monguurl');
var timestamps = require("mongoose-times")
var mongoosePaginate = require('mongoose-paginate')

var helper = require("../config/helper")

var collectionSchema = new mongoose.Schema({
  permalink: { type: String, unique: true, index: { unique: true } },
  title: String,
  body: String,
  imageFileName: String, // s=w:283:h:283, o=w:910:h:auto, bg=white
  section: { type: Number, default: helper.section.SECTION_FORHIM },

  factors: {
    tags: [],
    dateFrom: { type: Date },
    dateTo: { type: Date },
    user: {type : Schema.ObjectId, ref : 'User'}
  },

  status: { type: Number, default: helper.collectionStatus.STATUS_PENDING },
  sticky: { type: Boolean, default: false },
  inactive: { type: Boolean, default: false },

  postedAt: Date
});

/**
 * Hash the password for security.
 * "Pre" is a Mongoose middleware that executes before each save() call.
 */

collectionSchema.pre('save', function(next) {
  var collection = this;

  if(collection.factors.tags) this.factors.tags = _.map(collection.factors.tags.toString().split(','), function(tag) {return tag.trim()})

  return next();
});

/**
 * Get Image Url.
 */


collectionSchema.methods.getTags = function() {
  return this.factors.tags.join(', ')
}

collectionSchema.methods.image = function(size) {
  if (!size) size = 'l';

  return '/uploads/' + size + '_' + this.imageFileName;
};

collectionSchema.plugin(monguurl({source: 'title', target: 'permalink'}));
collectionSchema.plugin(timestamps, { created: 'createdAt', lastUpdated: 'updatedAt' })
collectionSchema.plugin(mongoosePaginate)

module.exports = mongoose.model('Collection', collectionSchema);
