"use strict";

var _ = require('lodash');
var async = require('async');
// var formidable = require('formidable');
var util = require('util');

var User = require('../models/User');
var Campaign = require('../models/Campaign');
var Product = require('../models/Product');

var lb = require('./lb');

exports.index = function(req, res) {
  res.render('dashboard/index', {
    title: 'Dashboard'
  });
};

exports.sectionsIndex = function(req, res) {
  res.render('dashboard/sections.index.jade', {
    title: 'Dashboard'
  });
};

exports.usersActionWelcomeBlogger = function(req, res) {
  var locales = {}

  async.series({
    getUser: function(done) {
      User.findOne({_id: req.params.user_id}, function(err, user) {
        locales.user = user
        done(err, user);
      })
    },
    sendMail: function(done) {
      if(!locales.user.isVerified) return done();
      lb.sendHtmlEmail({to: locales.user.email, user: locales.user, subject: 'Twoje konto blogera zostało aktywowane', templateName: 'blogger-verified'}, function(output) {
        done();
      });
    }
  }, function(err) {
    if(!locales.user.isVerified) return res.redirect('/dashboard/users');
    req.flash('success', { msg: 'Welcome message to ' + locales.user.email + ' have been sent' });
    res.redirect('/dashboard/users');
  })
}

exports.productsActionUploadToS3 = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.findOne({_id: req.params.product_id}, function(err, product) {
        locales.product = product
        done(err, product);
      })
    },
    upload: function(done) {
      lb.uploadProductImagesToCDN(locales.product.imageFileName, function() {
        done();
      })
    }
  }, function(err) {
    req.flash('success', { msg: 'Images for ' + locales.product.title + ' have been uploaded to S3' });
    res.redirect('/dashboard/products');
  })
}

exports.productsActionSticked = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.update({_id: req.params.product_id}, {$set: {sticky: true}}).exec(function() {
        done();
      })
    },
  }, function(err) {
    req.flash('success', { msg: 'Product have been sticked' });
    res.redirect('/dashboard/products');
  })
}

exports.productsActionUnsticked = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.update({_id: req.params.product_id}, {$set: {sticky: false}}).exec(function() {
        done();
      })
    },
  }, function(err) {
    req.flash('success', { msg: 'Product have been sticked' });
    res.redirect('/dashboard/products');
  })
}

exports.productsIndex = function(req, res) {
  var locales = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 50

  async.series({
    getCampaigns: function(done) {
      Product.paginate({}, page, limit, function(err, pages, products, total) {
        locales.products = products
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        done(err, products);
      }, {populate: ['author','publisher'], sortBy: { createdAt : -1 }})
    }
  }, function(err) {
    res.render('dashboard/products.index.jade', {
      title: 'Dashboard',
      products: locales.products,
      pagination: locales.pagination
    });
  });
};

exports.usersIndex = function(req, res) {
  var locales = {}
  var page = parseInt(req.query.page) || 1
  var limit = req.query.limit || 10

  async.series({
    getUsers: function(done) {
      User.paginate({}, page, limit, function(err, pages, users, total) {
        locales.users = users
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        done(err, users);
      }, {sortBy: { isVerified: -1, createdAt: -1 }})
    }
  }, function(err) {
    res.render('dashboard/users.index.jade', {
      title: 'Dashboard',
      users: locales.users,
      pagination: locales.pagination
    });
  })
};

exports.usersRead = function(req, res) {
  var locales = {}
  var lib = require("../vendor_modules/country-list/nodejs.countryList.js");
  var defaultCountry = 'Poland';

  async.series({
    getUser: function(done) {
      User.findOne({_id: req.params.profile_id}, function(err, user) {
        locales.user = user
        locales.cl = lib.countryList(user.profile.country||'');
        done(err, user);
      })
    }
  }, function(err) {
    res.render('dashboard/users.edit.jade', {
      title: 'Dashboard',
      profile: locales.user,
      citiesInHTML: locales.cl
    });
  })
};

exports.usersUpdate = function(req, res, next) {
  User.findById(req.params.profile_id, function(err, user) {
    if (err) return next(err);
    if(req.body.role) user.role = req.body.role;
    user.isGhost = req.body.isGhost
    user.isVerified = req.body.isVerified
    user.isPending = req.body.isPending
    user.isHidden = req.body.isHidden
    user.isRemoved = req.body.isRemoved

    user.permalink = req.body.permalink

    user.profile.country = req.body.country || '';

    if(req.body.business&&req.body.business.baseShare) user.business.baseShare = req.body.business.baseShare;
    if(req.body.business&&req.body.business.baseCurrency) user.business.baseCurrency = req.body.business.baseCurrency;

    if(req.body.links&&req.body.links.rss) user.links.rss = lb.repairUrl(req.body.links.rss || '');

    if(req.body.blogger&&req.body.blogger.platform) user.blogger.platform = req.body.blogger.platform || '';
    if(req.body.blogger&&req.body.blogger.feedlyId) user.blogger.feedlyId = req.body.blogger.feedlyId || '';
    if(req.body.blogger&&req.body.blogger.section) user.blogger.section = req.body.blogger.section || '';
    if(req.body.blogger&&req.body.blogger.locale) user.blogger.locale = req.body.blogger.locale || '';
    if(req.body.blogger&&req.body.blogger.last12mPageUniqueViews) user.blogger.last12mPageUniqueViews = req.body.blogger.last12mPageUniqueViews || '';
    if(req.body.blogger&&req.body.blogger.last12mPageUniqueUsers) user.blogger.last12mPageUniqueUsers = req.body.blogger.last12mPageUniqueUsers || '';

    user.save(function(err) {
      if (err) return next(err);
      req.flash('success', { msg: 'Profile information updated.' });
      res.redirect('/dashboard/users/edit/' + user._id);

      // res.render('dashboard/users.edit.jade', {
      //   title: 'Dashboard',
      //   profile: user
      // });
    });
  });
};

exports.campaignsIndex = function(req, res) {
  var locales = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 50

  async.series({
    getCampaigns: function(done) {
      Campaign.paginate({}, page, limit, function(err, pages, campaigns, total) {
        locales.campaigns = campaigns
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        done(err, campaigns);
      }, {populate: ['user','blogger','product']})
    }
  }, function(err) {
    res.render('dashboard/campaigns.index.jade', {
      title: 'Dashboard',
      campaigns: locales.campaigns,
      pagination: locales.pagination
    });
  })
};
