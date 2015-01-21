#!/usr/bin/env node

/*
  Migrating data from GA
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
var GA = require('../../vendor_modules/ga/ga.js');

var lb = require('../../controllers/lb.js');

var User = require('../../models/User');
var Campaign = require('../../models/Campaign');

console.log('Connecting to DB: ' + secrets.db);
mongoose.connect(secrets.db, function() {})

console.log('Updating blogger data...');

var total = 0;
var progress = 0;

var locales = {};
    locales.daily = [];
    locales.campaign_ids = [];

// moment.locale('en-US');
// var nowNow = new Date()
var hour = moment().format('HH');
// var hour = 00;
var nowNow = hour<1?moment().subtract(1, 'days').format('YYYY-MM-DD'):moment().format('YYYY-MM-DD');

var ga_config = {
  "user": secrets.gaEmail,
  "password": secrets.gaPassword
},
ga = new GA.GA(ga_config);

async.series({
  signInToGA: function(done) {
    console.log('Signing in to Google Analytics', nowNow);
    ga.login(function(err, token) {
      done();
    });
  },
  getCampaignMetrics: function(done) {
    console.log('getCampaignMetrics');

    var options = {
        'ids': 'ga:96169939',//50484734
        'start-date': nowNow,
        'end-date': nowNow,
        'filters': 'ga:eventLabel=~^campaign_.*',
        'metrics': 'ga:totalEvents,ga:uniqueEvents',
        'dimensions': 'ga:date,ga:eventLabel,ga:eventAction',
        'sort': '-ga:totalEvents'
    };

    ga.get(options, function(err, entries) {
      locales.entries = _.map(entries, function(entry) {
        entry.dimensions = _.map(entry.dimensions, function(dimension) {
          dimension['ga:date'] = moment(dimension['ga:date'], "YYYY-MM-DD").format('YYYY-MM-DD');
          dimension['ga:eventLabel'] = dimension['ga:eventLabel'].replace('campaign_','');
          locales.daily.push({total: entry.metrics[0]['ga:uniqueEvents'], _id: dimension['ga:eventLabel'], dimension: dimension['ga:eventAction'], day: dimension['ga:date'].toString()});
          return dimension;
        });
        return entry;
      });
      done();
    });
  },
  updateCampaignDaily: function(done) {
    async.forEachSeries(locales.daily, function(daily, cb) {
      locales.campaign_ids.push(daily._id);
      Campaign.update({
        _id : daily._id,
        'daily': {$elemMatch: {'day' : daily.day, 'dimension' : daily.dimension}},
      }, {
        $set : {
          "daily.$.total" : daily.total
        }
      }).exec(function(err, inserted) {
        if(!inserted) {
          Campaign.update({
            _id : daily._id,
          },
          {
            $push : { daily: {
              'day' : daily.day,
              'dimension' : daily.dimension,
              'total' : daily.total
              }
            }
          }
          ).exec(function(err, updated) {
            cb();
          });
        } else cb()
        // cb();
      });
    }, function() {
      done();
    })
  },
  updateCampaign: function(done) {
    var campaign_ids = _.uniq(locales.campaign_ids, function(id) {return id});
    Campaign.find({_id: {$in: campaign_ids}}, function(err, campaigns) {
      if(!campaigns) return done();
      async.forEachSeries(campaigns, function(campaign, cb) {
        locales.totalViews = 0;
        locales.totalClicks = 0;
        _.map(campaign.daily, function(entry) {
          if(entry.dimension=='View') locales.totalViews += parseFloat(entry.total);
          if(entry.dimension=='Click') locales.totalClicks += parseFloat(entry.total);
          return true;
        });
        var ctr = parseFloat(((locales.totalClicks/locales.totalViews)*100).toFixed(2));
        var cpc = parseFloat((campaign.price.totalPrice / locales.totalClicks).toFixed(2));
        Campaign.update({_id : campaign._id}, {$set: {lastUpdatedAt: new Date(), 'meta.views': locales.totalViews, 'meta.clicks': locales.totalClicks, 'meta.ctr': ctr, 'meta.cpc': cpc}}).exec(function(err, updated) {
          cb();
        })
      }, function() {
        done();
      })
    })
  }
}, function() {
  console.log('Finished.');
  process.exit(0);
})


