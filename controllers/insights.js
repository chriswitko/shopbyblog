"use strict";

var _ = require('lodash');
var async = require('async');
var og = require('open-graph-scraper');
var request = require('request');
var cheerio = require('cheerio');
var util = require('util');
var multer  = require('multer');
var lwip = require('lwip');
var fs = require('fs');
var moment = require('moment');

var helper = require('../config/helper');
var lb = require('./lb');

var Product = require('../models/Product');
var Vote = require('../models/Vote');
var User = require('../models/User');
var Comment = require('../models/Comment');
var Following = require('../models/Following');
var Campaign = require('../models/Campaign');
var Notification = require('../models/Notification');
var Insights = require('../models/Insights');

exports.go = function(req, res) {
  var locales = {}
      locales.url = '/';
  async.series({
    getProduct: function(done) {
      Product.findOne({_id: req.params.product_id})
        .populate({
          path: 'author',
          select: '_id username permalink profile email blogger meta picture imageFileName'
        })
        .exec(function(err, product) {
          if(product) {
            locales.product = product
            locales.url = '/product/' + locales.product.permalink;
          }
          done()
        })
    },
    getAds: function(done) {
      locales.ad = []
      if(locales.product) {
        lb.getActiveAdsByProduct(locales.product, function(ads) {
          if(!ads) return done();
          locales.ad = _.shuffle(ads).splice(0, 1)
          done();
        })
      } else {
        done();
      }
    },
  }, function() {
    // if(locales.ad.length) res.redirect('/track/' + locales.ad[0].ad._id + '?intent=true');
    // else res.redirect(locales.url);
    res.redirect(locales.url);
  })
}


var clickCampaign = function(params, cb) {
  var locales = {}
  async.series({
    getCampaign: function(done) {
      Campaign.findOne({_id: params.campaign_id})
        .exec(function(err, campaign) {
          if(!campaign) locales.redirect_url = '/'
          locales.campaign = campaign
          locales.redirect_url = campaign.url
          return done();
        })
    },
    checkIfUnique: function(done) {
      var criteria = {}

      criteria.action = 'user_' + (params.request.user?params.request.user._id:params.request.ip) + '_' + params.variant + '_' + params.campaign_id  + '_click'

      Insights.Traffic.update(criteria, {createdAt: new Date(), $inc: {'ok': 1}}, {upsert: true}, function(err, updated, details) {
        locales.isUnique = details.updatedExisting
        return done();
      })
    },
    updateInsights: function(done) {
      if(!locales.isUnique) return done();
      Insights.CampaignInsight.update({campaign: params.campaign_id}, {$inc: {'clicks': 1}}, {upsert: true}, function(err, updated) {
        return done();
      })
    },
    updateMeta: function(done) {
      if(!locales.isUnique) return done();
      //
      return done()
    }
  }, function() {
    return cb({
      campaign: locales.campaign,
      redirect_url: locales.redirect_url
    })
  })
}

exports.click = function(req, res) {
  clickCampaign({variant: req.query.v, campaign_id: req.params.campaign_id, source: req.query.source||'web', request: req}, function(output) {
    res.render('static/click', {
      title: '',
      bg: false,
      hideSubscriptionBox: true,
      hideNav: true,
      hideFooter: true,
      campaign: output.campaign,
      redirect_url: output.redirect_url,
      intent: req.query.intent?true:false
    });
  })
}