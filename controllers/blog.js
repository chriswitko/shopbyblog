"use strict";

var _ = require('lodash');
var async = require('async');
var request = require('request');
var util = require('util');
var rest = require('restler');

exports.search = function(req, res) {
  var locales = {}
  locales.output = []

  if(!req.query.q) return res.json({code: 200, status: 'error'});

  rest.get('http://cloud.feedly.com/v3/search/feeds/?count=24&query=' + req.query.q).on('complete', function(data) {
    async.forEachSeries(data.results, function(blog, cb) {
      if(blog.visualUrl) {
        // console.log(blog);
        locales.output.push(blog)
      }
      cb()
    }, function() {
      res.json({
        results: locales.output
      })
    })
  });
};
