"use strict";

// TODO: Localization ?locale=pl or req.locale

var _ = require('lodash');
var async = require('async');
var i18n = require("i18n");

var Following = require('../models/Following');
var Notification = require('../models/Notification');
var Product = require('../models/Product');

var helper = require('../config/helper');
var lb = require('./lb');

var _getHTML = function(notification, locale, cb) {
  if(!locale) locale = 'en';

  var locales = {}

  locales.html = {
    avatar: '',
    image: '',
    url: '',
    messageHTML: '',
    messagePlain: '',
    createdAt: notification.createdAt
  }

  async.series({
    getAvatar: function(done) {
      locales.html.avatar = notification.author.gravatar();
      done();
    },
    getElement: function(done) {
      if(notification.elementType==1) {
        Product.findOne({_id: notification.elementObject}, function(err, element) {
          if(element) {
            locales.element = element
            locales.html.image = './uploads/s_' + element.imageFileName
            locales.html.url = '/product/' + element.permalink
            lb.getActiveAdsByProduct(element, function(ads) {
              locales.html.ads = ads
              done();
            })
          } else done();
        })
      } else {
        done()
      }
      // locales.html.image = notification.
    },
    composeMessageHTML: function(done) {
      if(notification.verb=='voted') {
        if(notification.elementType==1) {
          locales.html.messagePlain = notification.author.getName() + ' ' + i18n.__({phrase: 'voted for', locale: locale||'en'}) + ' ' + locales.element.title
          locales.html.messageHTML = '<a href="/' + notification.author.permalink + '">' + notification.author.getName() + '</a> ' + i18n.__({phrase: 'voted for', locale: locale||'en'}) + ' <a href="/' + locales.element.permalink + '">' + locales.element.title + '</a>'
        }
      }
      done();
    }
  }, function() {
    cb(locales.html)
  })
}

exports.list = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 12

  async.series({
    getFollowers: function(done) {
      Following.find({follower: req.query.user_id||req.user}, function(err, followers) {
        locales.followers = _.map(followers||[], function(follower) {return follower.followee});
        done();
      });
    },
    getNotifications: function(done) {
      criteria.author = {$in: locales.followers}
      // console.log(criteria)
      // if(req.query.section) criteria.section = req.query.section;
      // if(req.query.tags) criteria.tags = {$in: _.map(req.query.tags.toString().split(','), function(tag) {return tag.trim()})}

      Notification.paginate(criteria, page, limit, function(err, pages, notifications, total) {
        locales.notifications = [];
        async.forEachSeries(notifications, function(notification, cb) {
          _getHTML(notification, req.query.locale||req.getLocale(), function(output) {
            locales.notifications.push({notification: output})
            cb();
          })
        }, function() {
          done()
        })
      }, {populate: 'author', sortBy: { createdAt : -1 }})
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      notifications: locales.notifications
    });
  })
};

exports.index = function(req, res) {
  res.render('notification/index', {
    title: 'Notifications'
  });
};
