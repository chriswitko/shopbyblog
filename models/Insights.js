"use strict";

var _ = require('lodash');

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var monguurl = require('monguurl');
var timestamps = require("mongoose-times")
var mongoosePaginate = require('mongoose-paginate')

var helper = require("../config/helper")

var trafficSchema = new mongoose.Schema({
  action: String,
  ok: Number,
  createdAt: { type: Date, default: Date.now, index: { safe:true, expires: 900 } }
}, {autoIndex: true});

var productInsightSchema = new mongoose.Schema({
  year: Number, // 2014-12-12 00:00:00
  month: Number, // 2014-12-12 00:00:00
  day: Number, // 2014-12-12 00:00:00
  product: {type : Schema.ObjectId, ref : 'Product'},
  views: Number, // uniques only, the rest via GA
  clicks: Number, // blog, social networks
  comments: Number,
  upvotes: Number,
  campaigns: Number
});

var userInsightSchema = new mongoose.Schema({
  day: Date, // 2014-12-12 00:00:00
  user: {type : Schema.ObjectId, ref : 'User'},
  views: Number, // uniques only, the rest via GA
  clicks: [{source: {type : String}, clicks: {type: Number}}], // web, fb, twitter, instagram, youtube, pinterest etc.
  followers: Number,
  upvotes: Number,
  products: Number,
  campaigns: Number
});

var widgetInsightSchema = new mongoose.Schema({
  day: Date, // 2014-12-12 00:00:00
  widget: {type : Schema.ObjectId, ref : 'Widget'},
  views: Number, // uniques only, the rest via GA
  clicks: Number
});

var campaignInsightSchema = new mongoose.Schema({
  year: Number, // 2014-12-12 00:00:00
  month: Number, // 2014-12-12 00:00:00
  day: Number, // 2014-12-12 00:00:00
  campaign: {type : Schema.ObjectId, ref : 'Campaign'},
  views: Number, // uniques only, the rest via GA
  clicks: Number
});

// collectionSchema.plugin(mongoosePaginate)

module.exports = {
  Traffic: mongoose.model('Traffic', trafficSchema),
  ProductInsight: mongoose.model('ProductInsight', productInsightSchema),
  UserInsight: mongoose.model('UserInsight', userInsightSchema),
  WidgetInsight: mongoose.model('WidgetInsight', widgetInsightSchema),
  CampaignInsight: mongoose.model('CampaignInsight', campaignInsightSchema)
}

// module.exports = mongoose.model('Traffic', trafficSchema) = Traffic;
// module.exports = mongoose.model('ProductInsight', productInsightSchema) = ProductInsight;
// module.exports = mongoose.model('UserInsight', userInsightSchema) = UserInsight;
// module.exports = mongoose.model('WidgetInsight', widgetInsightSchema) = WidgetInsight;
// module.exports = mongoose.model('CampaignInsight', campaignInsightSchema) = CampaignInsight;
