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

exports.customize = function(req, res) {
  res.render('widget/' + req.params.variant, {
    title: 'Widgets',
    variant: req.params.variant,
    eid: req.query.eid || req.user._id
  });
};

