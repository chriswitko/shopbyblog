"use strict";

var _ = require('lodash');
var async = require('async');
var satelize = require('satelize');

var helper = require('../config/helper');

var User = require('../models/User');

/**
 * GET /
 * Home page.
 */

exports.index = function(req, res) {
  var locales = {};

  async.series({
    getUserByPermalink: function(done) {
      if(!req.user) return done();
      User.findOne({_id: req.user._id}, function(err, profile) {
        if(!err&&profile) locales.profile = profile;
        done();
      })
    },
  }, function() {
    if(!req.user) {
      res.render('home', {
        title: '',
        bg: false,
        hideSubscriptionBox: true,
        showSearchBox: true
      });
    } else {
      if(locales.profile.isVerified) return res.redirect('/'+locales.profile.permalink);
      else return res.redirect('/claim');
    }
  })
};

exports.indexOld = function(req, res) {
  // res.cookie('sbblang', 'pl');
  if(req.user) {
    res.render('home', {
      title: '',
      bg: false,
      hideSubscriptionBox: true,
      showSearchBox: true
    });
  } else {
    // if(!req.cookies.sbblang) {
      // satelize.satelize({}, function(err, geoData) {
        // if(!err&&geoData) {
          // var geo = JSON.parse(geoData);
          // if(geo.country_code) {
            // if(geo.country_code=='PL') res.cookie('sbblang', 'pl');
            // else res.cookie('sbblang', 'en');
          // }
        // }
        // res.render('home', {
          // title: '',
          // bg: false,
          // hideSubscriptionBox: true,
          // showSearchBox: false
        // });
      // });
    // } else {
      res.render('home', {
        title: '',
        bg: false,
        hideSubscriptionBox: true,
        showSearchBox: true
      });
    // }
  }
};

exports.about = function(req, res) {
  res.render('static/about', {
    title: 'O ShopByBlog',
    hideSubscriptionBox: true
  });
};

exports.langPolish = function(req, res) {
  async.series({
    updateUser: function(done) {
      if(!req.user) return done();
      User.update({_id: req.user._id}, {$set: {'profile.locale': 'pl'}}).exec(function(err, updated) {
        return done();
      })
    }
  }, function() {
    res.cookie('sbblang', 'pl');
    res.redirect(req.header('Referrer')||'/');
  })
};

exports.langEnglish = function(req, res) {
  async.series({
    updateUser: function(done) {
      if(!req.user) return done();
      User.update({_id: req.user._id}, {$set: {'profile.locale': 'en'}}).exec(function(err, updated) {
        return done();
      })
    }
  }, function() {
    res.cookie('sbblang', 'en');
    res.redirect(req.header('Referrer')||'/');
  })
};

