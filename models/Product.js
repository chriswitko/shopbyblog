"use strict";

var _ = require('lodash');

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var url = require('url');

var monguurl = require('monguurl');
var timestamps = require("mongoose-times")
var mongoosePaginate = require('mongoose-paginate')
var searchPlugin = require('mongoose-search-plugin')

var helper = require("../config/helper")

var productSchema = new mongoose.Schema({
  postUrl: String,
  url: String,
  permalink: { type: String, unique: true, index: { unique: true } },
  title: String,
  body: String,
  imageFileName: String, // s=w:283:h:283, m=w:612:h:612, l=w:800:h:800, o=w:800:h:auto, bg=white
  section: { type: Number, default: helper.section.SECTION_FORHIM },
  typos: [],

  // inspiredBy: {type : Schema.ObjectId, ref : 'Blog'},

  meta: {
    comments: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }, // from sponsored area = find more & buy now
    upvotes: { type: Number, default: 0 },
    lastCommentedAt: { type: Date }
  },

  isHidden: { type: Boolean, default: false },
  isInactive: { type: Boolean, default: false },
  baseScore: { type: Number, default: 0 },
  score: { type: Number, default: 0 },

  tags: [],

  // commenters: { type: Number, default: 0 },
  // upvoters: { type: Number, default: 0 },

  status: { type: Number, default: helper.productStatus.STATUS_PENDING },
  sticky: { type: Boolean, default: false },

  author: {type : Schema.ObjectId, ref : 'User'},
  publisher : {type : Schema.ObjectId, ref : 'User'},

  postedAt: Date
});

/**
 * Hash the password for security.
 * "Pre" is a Mongoose middleware that executes before each save() call.
 */

productSchema.pre('save', function(next) {
  var product = this;

  // console.log(product._keywords);

  if(product.postUrl.indexOf('http')!=0) product.postUrl = 'http://' + product.postUrl

  if(product.tags) this.tags = _.map(product.tags.toString().split(','), function(tag) {return tag.trim()})

  return next();
});

productSchema.methods.getOpenGraph = function() {
  return {
    title: '',
    description: '',
    url: '',
    image: ''
  }
}

productSchema.methods.getLeadUrl = function(action, source) {
  source = !source?'web':source;

  return '/click?v=product&s=' + source + '&lid=' + this._id;
}

productSchema.methods.getDomainUrl = function() {
  return this.postUrl?url.parse(this.postUrl).hostname:'';
}

productSchema.methods.getTags = function() {
  return this.tags.join(', ')
}


productSchema.methods.image = function(size) {
  if (!size) size = 'l';

  return '/uploads/' + size + '_' + this.imageFileName;
};

productSchema.plugin(monguurl({source: 'title', target: 'permalink'}));
productSchema.plugin(timestamps, { created: 'createdAt', lastUpdated: 'updatedAt' })
productSchema.plugin(mongoosePaginate)
productSchema.plugin(searchPlugin, {fields: ['title', 'body', 'tags', 'typos']});

module.exports = mongoose.model('Product', productSchema);
