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

var Algolia = require('algolia-search');
var client = new Algolia('DY6CRRRG54', 'aa405ae3231c428007b1b6d2cbdf5280');

var lb = require('../../controllers/lb.js');

var Product = require('../../models/Product');
var User = require('../../models/User');

console.log('Connecting to DB: ' + secrets.db);
mongoose.connect(secrets.db, function() {})

console.log('Updating search engine...');

var total = 0;
var progress = 0;

var locales = {};

var ts = Math.floor(new Date() / 1000);
console.log('ts', ts);
var file = '../../_storage/products.json';

async.series({
  getVerifiedUsersOnly: function(done) {
    locales.blogger_ids = [];
    User.find({isVerified: true}, function(err, bloggers) {//, isHidden: {$ne: true}
      locales.blogger_ids = _.map(bloggers, function(blogger) {return blogger._id});
      done();
    })
  },
  generateJsonFileWithProducts: function(done) {
    Product.find({publisher: {$in:locales.blogger_ids}, isHidden: false})
    .populate({
      path: 'publisher',
      select: 'profile.name isHidden isVerified'
    })
    .select('_id permalink title body imageFileName meta publisher isHidden sticky').exec(function(err, products) {
      if(!products) return done();

      var data = _.map(products, function(product) {
        product = product.toJSON();
        product.objectID = product._id;
        return product;
      });

      jf.writeFile(file, data, function(err) {
        done();
      })
    })
  },
  uploadToAlgolia: function(done) {
    var index = client.initIndex('products');
    var fileJSON = require(file);
    index.addObjects(fileJSON, function(error, content) {
      if (error) console.error("SEARCH ERROR: %s", content.message);
      done();
    });
  }
}, function() {
  console.log('End.')
  process.exit(0)
});