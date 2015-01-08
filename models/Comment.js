"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var timestamps = require("mongoose-times")
var mongoosePaginate = require('mongoose-paginate')

var commentSchema = new mongoose.Schema({
  product: {type : Schema.ObjectId, ref : 'Product'},
  user: {type : Schema.ObjectId, ref : 'User'},
  body: {type : String}
});

commentSchema.pre('save', function(next) {
  var comment = this;

  return next();
});

commentSchema.plugin(timestamps, { created: 'createdAt', lastUpdated: 'updatedAt' })
commentSchema.plugin(mongoosePaginate)

module.exports = mongoose.model('Comment', commentSchema);
