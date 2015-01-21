"use strict";

var _ = require('lodash');
var async = require('async');

var helper = require('../config/helper');

var FollowingSection = require('../models/FollowingSection');

exports.index = function(req, res) {
  var permalink = req.route.path.replace('/', '');

  var locales = {}

  locales.section = _.where(helper.sections({}), {permalink: permalink})[0]

  async.series({
    findFollowing: function(done) {
      if(req.user&&locales.section) {
        FollowingSection.findOne({section: locales.section.id, follower: req.user.id}, function(err, following) {
          if(following&&!following.end) locales.section.isFollowing = true;
          else locales.section.isFollowing = false;
          done();
        });
      } else {
        done();
      }
    }
  }, function() {
    res.render('section', {
      title: locales.section.name,
      navUrl: permalink,
      section: locales.section
    });
  })
};

exports.deals = function(req, res) {
  var permalink = req.route.path.replace('/', '');

  res.render('deals', {
    title: "Oferty dnia",
    navUrl: permalink,
    section: {section: {permalink: 'deals'}}
  });
};

exports.subscriptions = function(req, res) {
  var permalink = req.route.path.replace('/', '');

  res.render('subscriptions', {
    title: "Moje subskrypcje",
    navUrl: permalink,
    section: {section: {permalink: 'subscriptions'}}
  });
};

exports.favorites = function(req, res) {
  var permalink = req.route.path.replace('/', '');

  res.render('favorites', {
    title: "Ulubione",
    navUrl: permalink,
    section: {section: {permalink: 'favorites'}}
  });
};

exports.search = function(req, res) {
  res.render('search', {
    q: req.query.q||'',
    title: (req.query.q?'Wynik szukania: ' + req.query.q:'Szukaj produktów i blogerów...'),
    section: {section: {name: 'search'}},
    showSearchBox: true
  });
};

exports.list = function(req, res) {
  var locales = {}

  async.series({
    getSections: function(done) {
      locales.sections = _.map(helper.sections({locale: req.getLocale()}), function(section) {return {section: section}});
      done();
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      sections: locales.sections
    });
  })
};

exports.follow = function(req, res) {
  var locales = {}

  async.series({
    findFollowing: function(done) {
      FollowingSection.findOne({section: req.query.section, follower: req.query.follower}, function(err, following) {
        locales.following = following||new FollowingSection();
        done();
      });
    },
    updateFollowing: function(done) {
      locales.following.section =  req.query.section;
      locales.following.follower =  req.query.follower;
      locales.following.end = undefined;

      if(!locales.following.start) locales.following.start = new Date();
      locales.following.last = new Date();

      locales.following.save(function() {
        done();
      });
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      following: true
    })
  })
}

exports.unfollow = function(req, res) {
  var locales = {}

  async.series({
    findFollowing: function(done) {
      FollowingSection.findOne({section: req.query.section, follower: req.query.follower}, function(err, following) {
        locales.following = following||new FollowingSection();
        done();
      });
    },
    updateFollowing: function(done) {
      locales.following.section =  req.query.section;
      locales.following.follower =  req.query.follower;
      locales.following.end = new Date();

      if(!locales.following.start) locales.following.start = new Date();
      locales.following.last = new Date();

      locales.following.save(function() {
        done();
      });
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      following: false
    })
  })
}