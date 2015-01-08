"use strict";

var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var passport = require('passport');
var secrets = require('../config/secrets');

var moment = require('moment');

var User = require('../models/User');
var Product = require('../models/Product');
var Comment = require('../models/Comment');

var lb = require('./lb');


exports.delete = function(req, res) {
  var locales = {}

  async.series({
    findComment: function(done) {
      Comment.findOne({_id: req.body.comment_id})
        .exec(function(err, comment) {
          locales.comment = comment;
          done();
        });
    },
    findProduct: function(done) {
      Product.findOne({_id: locales.comment.product})
        .exec(function(err, product) {
          locales.product = product;
          done();
        });
    },
    removeComment: function(done) {
      Comment.remove({_id: req.body.comment_id})
        .exec(function(err, product) {
          done();
        });
    },
    updateMetasForProduct: function(done) {
      if(!locales.product) return done();
      lb.updateCountersForProduct(locales.product, function(total) {
        locales.totalVotes = total.totalVotes;
        locales.totalComments = total.totalComments;
        done();
      });
    },
    findUser: function(done) {
      User.findOne({_id: locales.comment.user})
        .exec(function(err, user) {
          locales.user = user;
          done();
        });
    },
    updateMetasForUser: function(done) {
      if(!locales.user) return done();
      lb.updateCountersForUser(locales.user, function(total) {
        done();
      });
    },
  }, function() {
    res.json({
      code: 200,
      status: 'success'
    })
  })
}

exports.postCreate = function(req, res) {
  var locales = {}

  async.series({
    findProduct: function(done) {
      if(!req.user) return done();
      Product.findOne({_id: req.body.product})
        .populate({
          path: 'author',
        })
        .exec(function(err, product) {
          locales.product = product;
          done();
        });
    },
    createComment: function(done) {
      locales.comment = new Comment();
      locales.comment.user =  req.body.user;
      locales.comment.product =  req.body.product;
      locales.comment.body = req.body.body;

      locales.comment.save(function() {
        done();
      });
    },
    updateMetasForProduct: function(done) {
      lb.updateCountersForProduct(locales.product, function(total) {
        locales.totalVotes = total.totalVotes;
        locales.totalComments = total.totalComments;
        done();
      });
    },
    updateMetasForUser: function(done) {
      lb.updateCountersForUser(req.user, function(total) {
        done();
      });
    },
    // updateProduct: function(done) {
      // Product.update({_id: req.body.product}, {$inc: {'meta.comments': 1}}).exec(function() {
        // return done();
      // })
    // }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      comment_id: locales.comment._id
    })
  })
}

exports.list = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 12

  async.series({
    getComment: function(done) {
      if(req.query.product_id) criteria.product = req.query.product_id;

      Comment.paginate(criteria, page, limit, function(err, pages, comments, total) {
        // .sort({postedAt: -1})
        // .populate({
        //   path: 'author',
        //   select: '_id username permalink profile email'
        // })
        locales.total = total;
        locales.pages = pages;
        if(comments) locales.comments = _.map(comments, function(comment) {
          comment = comment.toJSON();
          comment.fromNow = moment(comment.createdAt).fromNow()
          return {comment: comment}
        })
        done()
      }, {populate: ['user','product'], sortBy: { createdAt : -1 }})
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      comments: locales.comments,
      paginate: {
        total: locales.total,
        pages: locales.pages
      }
    });
  })
};