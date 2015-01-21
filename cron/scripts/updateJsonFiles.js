#!/usr/bin/env node

/*
  Updateing json files for widget and run s3-upload to refresh CDNs.

  1. Select all users with pleaseRefreshJson=true
  2. Generate simple json files about user, added products and active campaigns
  3. Send it to S3 - external process s3-upload

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

console.log('Connecting to DB: ' + secrets.db);
mongoose.connect(secrets.db, function() {})

console.log('Generating JSON files...');

var total = 0;
var progress = 0;

var locales = {};

var stream = User.find({isVerified: true}).stream()

stream.on('data', function (user) {
  console.log('User:', user.permalink)

  this.pause()

  progress++
  if(!(progress%5)) console.log('Already %d items processed', progress)

  var self = this

  async.series({
    generateFiles: function(done) {
      lb.refreshJsonFile(user, function() {
        done();
      })
    },
    updateUser: function(done) {
      User.update({_id: user._id}, {$set: {'pleaseRefreshJson': false}}).exec(function() {
        done()
      })
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

