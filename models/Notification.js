"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Helper = require('../config/helper');

var timestamps = require("mongoose-times")
var mongoosePaginate = require('mongoose-paginate')

var ET_PRODUCT = 1, ET_USER = 2, ET_COLLECTION = 3;

var notificationSchema = new mongoose.Schema({
  author: {type : Schema.ObjectId, ref : 'User'},
  elementType: { type: Number, default: ET_PRODUCT },
  elementObject: {type : Schema.ObjectId},
  elementId: {type : String}, // for sections etc.
  url: {type : String}, // for sections etc.
  message: {type : String}, // for sections etc.
  verb: {type: String, enum: ['posted', 'followed', 'voted'] },
  isGlobal: { type: Boolean, default: false }, // only for "New collection 'Shoes' has been created."
});

notificationSchema.pre('save', function(next) {
  var notification = this;

  return next();
});



notificationSchema.plugin(timestamps, { created: 'createdAt', lastUpdated: 'updatedAt' })
notificationSchema.plugin(mongoosePaginate)

module.exports = mongoose.model('Notification', notificationSchema);
