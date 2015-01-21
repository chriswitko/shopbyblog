"use strict";

var _ = require('lodash');
var async = require('async');

var lb = require('./lb');

var User = require('../models/User');

exports.index = function(req, res) {
  res.render('invite/index', {
    title: 'Zaproszenia'
  });
};

exports.postIndex = function(req, res) {
  var locales = {};

  req.assert('email', 'Email nie jest poprawny').isEmail();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/invites');
  }

  async.series({
    findUser: function(done) {
      User.findOne({_id: req.user._id}, function(err, user) {
        locales.user = user;
        done();
      });
    },
    sendInviteEmail: function(done) {
      if(!locales.user.meta.emailInvitesLeft) return done();
      lb.sendHtmlEmail({to: req.body.email, user: locales.user, subject: 'shopbyblog.com - Zaproszenie od ' + req.user.getName(), templateName: 'user-invite'}, function(output) {
        done();
      });
    },
    minusInvite: function(done) {
      if(!locales.user.meta.emailInvitesLeft) return done();
      var change = locales.user.meta.emailInvitesLeft<=1?5:-1;
      User.update({_id: req.user._id}, {$inc: {'meta.emailInvitesLeft': change}}).exec(function() {
        done();
      });
    }
  }, function() {
    if(!locales.user.meta.emailInvitesLeft) return res.redirect('/invites');
    req.flash('success', { msg: 'Zaproszenie zostało wysłane.' });
    res.redirect('/invites');
  })
};

