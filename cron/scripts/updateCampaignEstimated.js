#!/usr/bin/env node

/*
  Updating campaigns

  1. Select active campaign or isLive=true
  2. Calculate estimated revenue for blogger
  3. Calculate estimated revenue for sbb and update Fusion
  4. Calculate already paid amount
  5. Update meta:campaigns/ads per blogger in total (only paid)
  6. Update views / clicks from GA
  7. Switch off campaign if finished

 */

var env = process.env.NODE_ENV || 'development';

var _ = require('lodash');
var async = require('async');
var util = require('util');
var path = require('path');
var fs = require('fs');
var moment = require('moment');
var nodemailer = require('nodemailer');
var secrets = require('../../config/secrets')[env];
var jf = require('jsonfile')
var mongoose = require('mongoose');

var lb = require('../../controllers/lb.js');

var User = require('../../models/User');
var Campaign = require('../../models/Campaign');

console.log('Connecting to DB: ' + secrets.db);
mongoose.connect(secrets.db, function() {})

console.log('Updating campaigns data...');

var total = 0;
var progress = 0;

var locales = {};

// moment.locale('en-US');
var nowNow = new Date();

var stream = Campaign.find({'price.isPaid': true, end: {$gte: nowNow}, isLive: true}).stream()

stream.on('data', function (campaign) {
  locales.campaign = campaign;
  locales.revenue = {euro: {}, usd: {}};

  console.log('Campaign:', campaign._id)

  this.pause()

  progress++
  if(!(progress%5)) console.log('Already %d items processed', progress)

  var self = this

  async.series({
    estimatedRevenuePerCampaign: function(done) {
      locales.revenue.bloggerRevenue = parseFloat((locales.campaign.price.nettoPrice * locales.campaign.price.bloggerShare).toFixed(2));
      locales.revenue.sbbRevenue = parseFloat((locales.campaign.price.nettoPrice - locales.revenue.bloggerRevenue).toFixed(2));

      locales.revenue.euro.bloggerRevenue = parseFloat((locales.campaign.price.euro.totalNetto * locales.campaign.price.bloggerShare).toFixed(2));
      locales.revenue.euro.sbbRevenue = parseFloat((locales.campaign.price.euro.totalNetto - locales.revenue.euro.bloggerRevenue).toFixed(2));

      locales.revenue.usd.bloggerRevenue = parseFloat((locales.campaign.price.usd.totalNetto * locales.campaign.price.bloggerShare).toFixed(2));
      locales.revenue.usd.sbbRevenue = parseFloat((locales.campaign.price.usd.totalNetto - locales.revenue.usd.bloggerRevenue).toFixed(2));
      done();
    },
    updateCampaign: function(done) {
      Campaign.update({_id: campaign._id}, {$set: {'price.bloggerEstimatedRevenue': locales.revenue.bloggerRevenue, 'price.sbbEstimatedRevenue': locales.revenue.sbbRevenue, 'price.euro.bloggerEstimatedRevenue': locales.revenue.euro.bloggerRevenue, 'price.euro.sbbEstimatedRevenue': locales.revenue.euro.sbbRevenue, 'price.usd.bloggerEstimatedRevenue': locales.revenue.usd.bloggerRevenue, 'price.usd.sbbEstimatedRevenue': locales.revenue.usd.sbbRevenue}}).exec(function() {
        done();
      });
    },
  }, function() {
    console.log(locales.revenue);
    self.resume()
  })
}).on('error', function (err) {
  console.log('Error:', err)
}).on('close', function () {
  console.log('End.')
  process.exit(0)
});

