"use strict";

var _ = require('lodash');
var async = require('async');

exports.index = function(req, res) {
  res.render('invite/index', {
    title: 'Invites'
  });
};

