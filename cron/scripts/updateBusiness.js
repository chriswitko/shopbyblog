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

console.log('Updating blogger data...');

var total = 0;
var progress = 0;

var locales = {};

// moment.locale('en-US');
var nowNow = new Date()

var stream = User.find({isVerified: true}).stream()

stream.on('data', function (user) {
  locales.user = user;
  locales.estimated = {};
  locales.alreadyPaid = {};
  locales.finished = {};

  console.log('Blogger:', user.permalink);

  this.pause()

  progress++
  if(!(progress%5)) console.log('Already %d items processed', progress)

  var self = this

  async.series({
    estimated: function(done) {
      Campaign.aggregate([
        { $match: {blogger: locales.user._id, $or: [{'price.isPaid': true, 'price.bloggerIsPaid': false, end: {$gte: nowNow}}, {'price.isPaid': true, isLive: true}]} },
        {
          $group: {
            _id: '$blogger',
            total_pln: {$sum:'$price.bloggerEstimatedRevenue'},
            total_euro: {$sum:'$price.euro.bloggerEstimatedRevenue'},
            total_usd: {$sum:'$price.usd.bloggerEstimatedRevenue'},
            count: { $sum: 1 }
          },
        }
      ], function(err, output) {
        console.log(err);
        console.log('total', output);
        if(output) locales.estimated = output[0];
        done();
      });
    },
    finished: function(done) {
      Campaign.aggregate([
        { $match: {blogger: locales.user._id, 'price.isPaid': true, 'price.bloggerIsPaid': false, end: {$lte: nowNow}} },
        {
          $group: {
            _id: '$blogger',
            total_pln: {$sum:'$price.bloggerRevenue'},
            total_euro: {$sum:'$price.euro.bloggerRevenue'},
            total_usd: {$sum:'$price.usd.bloggerRevenue'},
            count: { $sum: 1 }
          },
        }
      ], function(err, output) {
        if(output) locales.finished = output[0];
        done();
      });
    },
    alreadyPaid: function(done) {
      Campaign.aggregate([
        { $match: {blogger: locales.user._id, 'price.isPaid': true, 'price.bloggerIsPaid': true} },
        {
          $group: {
            _id: '$blogger',
            total_pln: {$sum:'$price.bloggerRevenue'},
            total_euro: {$sum:'$price.euro.bloggerRevenue'},
            total_usd: {$sum:'$price.usd.bloggerRevenue'},
            count: { $sum: 1 }
          },
        }
      ], function(err, output) {
        if(output) locales.alreadyPaid = output[0];
        done();
      });
    },
    updateBlogger: function(done) {
      if(!locales.finished) locales.finished = {total_pln: 0, total_euro: 0, total_usd: 0};
      if(!locales.alreadyPaid) locales.alreadyPaid = {total_pln: 0, total_euro: 0, total_usd: 0};
      if(!locales.estimated) locales.estimated = {total_pln: 0, total_euro: 0, total_usd: 0};

      User.update({_id: locales.user._id}, {$set: {
        lastRefreshRevenueAt: new Date(),
        'business.totalRevenue': locales.finished.total_pln,
        'business.euro.totalRevenue': locales.finished.total_euro,
        'business.usd.totalRevenue': locales.finished.total_usd,
        'business.totalEstimatedRevenue': locales.estimated.total_pln,
        'business.euro.totalEstimatedRevenue': locales.estimated.total_euro,
        'business.usd.totalEstimatedRevenue': locales.estimated.total_usd,
        'business.totalPaid': locales.alreadyPaid.total_pln,
        'business.euro.totalPaid': locales.alreadyPaid.total_euro,
        'business.usd.totalPaid': locales.alreadyPaid.total_usd
        }
      }).exec(function() {
        done()
      })
    },
    updateMetasForProductAuthor: function(done) {
      lb.updateCountersForUser(locales.user, function(total) {
        done();
      });
    },
  }, function() {
    self.resume()
  })
}).on('error', function (err) {
  console.log('Error:', err)
}).on('close', function () {
  console.log('End.')
  process.exit(0)
});

