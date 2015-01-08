"use strict";

var _ = require('lodash');
var async = require('async');

exports.for_bloggers = function(req, res) {
  res.render('static/for-bloggers', {
    title: 'For Bloggers',
    hideSubscriptionBox: true
    // bg: true
  });
};

exports.sell_products = function(req, res) {
  res.render('static/sell-products', {
    title: 'Sell Products',
    hideSubscriptionBox: true
  });
};

exports.widget_demo = function(req, res) {
  res.render('static/widget-demo', {
    title: 'Widget Demo',
    hideSubscriptionBox: true
  });
};
