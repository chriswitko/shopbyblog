"use strict";

var _ = require('lodash');
var async = require('async');
var helper = require("../config/helper")

exports.for_bloggers = function(req, res) {
  res.render('static/for-bloggers', {
    title: 'Dla blogerów',
    hideSubscriptionBox: true
    // bg: true
  });
};

exports.sell_products = function(req, res) {
  res.render('static/sell-products', {
    title: 'Dla sklepów',
    hideSubscriptionBox: true
  });
};

exports.privacy = function(req, res) {
  res.render('static/privacy', {
    title: 'Polityka prywatności',
    hideSubscriptionBox: true
  });
};

exports.help = function(req, res) {
  res.render('help/index', {
    hideNav: false,
    title: 'Pomoc',
    links: helper.help_links[req.getLocale()]?helper.help_links[req.getLocale()]:{},
    hideSubscriptionBox: true
  });
};


exports.terms = function(req, res) {
  res.render('help/index', {
    title: 'Pomoc',
    hideSubscriptionBox: true
  });
};

exports.terms_publisher = function(req, res) {
  res.render('static/terms-publisher', {
    title: 'Regulamin Wydawcy',
    hideSubscriptionBox: true
  });
};

exports.widget_demo = function(req, res) {
  res.render('static/widget-demo', {
    title: 'Widget Demo',
    hideSubscriptionBox: true
  });
};
