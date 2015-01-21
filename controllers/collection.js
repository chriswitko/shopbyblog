"use strict";

var _ = require('lodash');
var async = require('async');
var util = require('util');
var multer  = require('multer');
var lwip = require('lwip');
var fs = require('fs');
var moment = require('moment');

var helper = require('../config/helper');

var Collection = require('../models/Collection');

exports.index = function(req, res) {
  var locales = {}

  async.series({
    getCollection: function(done) {
      Collection.findOne({permalink: req.params.permalink})
        // .populate({
          // path: 'author',
          // select: '_id username permalink profile email'
        // })
        .exec(function(err, collection) {
          if(collection) locales.collection = collection
          done()
        })
    }
  }, function() {
    if(!locales.collection) return res.redirect('/')
    res.render('collection', {
      title: locales.collection.title,
      collection: locales.collection
    });
  })
};

exports.add = function(req, res) {
  res.render('collection/edit', {
    title: 'Nowa kolekcja',
    collection: new Collection()
  });
};

exports.edit = function(req, res) {
  var locales = {}

  async.series({
    getCollection: function(done) {
      Collection.findOne({permalink: req.params.permalink})
        // .populate({
          // path: 'author',
          // select: '_id username permalink profile email'
        // })
        .exec(function(err, collection) {
          if(collection) locales.collection = collection
          done()
        })
    }
  }, function() {
    if(!locales.collection) return res.redirect('/')
    res.render('collection/edit', {
      title: 'Edycja kolekcji',
      collection: locales.collection
    });
  })
};

exports.post_add = function(req, res) {
  req.assert('title', 'Nazwa kolekcji jest wymagana').notEmpty();
  req.assert('body', 'Opis kolekcji jest wymagany').optional();
  req.assert('image_url', 'Zdjęcie jest wymagane').optional().isURL();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/add');
  }


  var locales = {}

  if(req.body.mode=='add'&&!req.files.filename) {
    if(!errors) errors = []
    errors.push({ param: 'filename', msg: 'Zdjęcie jest wymagane', value: undefined })
    req.flash('errors', errors);
    return res.redirect('/collection/add');
  }


  async.series({
    processImage: function(done) {
      if(!req.files.filename) return done()
      lwip.open(req.files.filename.path, function(err, image) {
        if (err) throw err;

        locales.image = image

        var o_height = image.height();
        var o_width = image.width();

        var max_size = 909

        if(o_height>o_width) {
          var n_height = 909;
          var percent = (((n_height * 100)/o_height)/100)
          var n_width =  Math.floor((o_width*percent))-1;
        } else {
          var n_width =  909;
          var percent = (((n_width * 100)/o_width)/100)
          var n_height = Math.floor((o_height*percent))-1;
        }

        locales.n_width = n_width
        locales.n_height = n_height

        var blank_size_x = Math.floor((910 - n_width - 1) / 2);
        if(blank_size_x<0) blank_size_x = 0;
        locales.blank_size_x = blank_size_x

        var blank_size_y = Math.floor((910 - n_height - 1) / 2);
        if(blank_size_y<0) blank_size_y = 0;
        locales.blank_size_y = blank_size_y

        locales.filename = req.files.filename.name;
        locales.path = req.files.filename.path;
        done();
      });
    },
    imageSizeOriginal: function(done) {
      if(!locales.path) return done();
      locales.image.resize(locales.n_width, locales.n_height, function(err, resized) {
        locales.resized = resized
        resized.writeFile('./public/uploads/o_'+locales.filename, function(err) {
          done();
        })
      })
    },
    imageSizeLarge: function(done) {
      if(!locales.path) return done();
      locales.resized.crop(0, 0, locales.n_width, locales.n_height, function(err, cropped) {
        lwip.create(910, 910, {r: 249, g: 249, b: 249, a: 100}, function(err, layer) {
          layer.paste(locales.blank_size_x, locales.blank_size_y, cropped, function(err, layer) {
            locales.large = layer
            done();
          })
        })
      })
    },
    imageSizeSmall: function(done) {
      if(!locales.path) return done();
      locales.large.resize(283, 283, function(err, resized) {
        resized.writeFile('./public/uploads/s_'+locales.filename, function(err) {
          done();
        })
      })
    },
    removeUpload: function(done) {
      if(!locales.path) return done();
      fs.unlink(locales.path, function() {
        done();
      })
    },
    uploadToCDN: function(done) {
      done();
    },
    loadCollection: function(done) {
      if(!req.body.id) return done();
      Collection.findOne({_id: req.body.id}, function(err, collection) {
        locales.collection = collection;
        done();
      })
    },
    saveToDb: function(done) {
      if(!locales.collection) locales.collection = new Collection()

      locales.collection.title = req.body.title,
      locales.collection.body = req.body.body,
      locales.collection.imageFileName = locales.filename?locales.filename:locales.collection.imageFileName,
      locales.collection.section = req.body.section,
      locales.collection.status = helper.productStatus.STATUS_PENDING,
      locales.collection.postedAt = req.user.role>=2?new Date():null

      locales.collection.factors.tags = req.body.tags

      locales.collection.save(function(err, saved) {
        locales.saved = saved
        done();
      })
    }
  }, function() {
    if(req.body.mode=='add')
      req.flash('success', { msg: 'Gratulacje! Kolekcja została utworzona.' });
    else
      req.flash('success', { msg: 'Gratulacje! Zmiany zostały zapisane.' });

    res.redirect('/collection/'+locales.saved.permalink)
  })

};


exports.list = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 24

  async.series({
    getCollections: function(done) {
      if(req.query.section) criteria.section = req.query.section;
      if(req.query.tags) criteria['factors.tags'] = {$in: _.map(req.query.tags.toString().split(','), function(tag) {return tag.trim()})}

      Collection.paginate(criteria, page, limit, function(err, pages, collections, total) {
        // .populate({
        //   path: 'author',
        //   select: '_id username permalink profile email'
        // })
        if(collections) locales.collections = _.map(collections, function(collection) {return {collection: collection}})
        done()
      }, {sortBy : { createdAt : -1 }})
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      collections: locales.collections
    });
  })
};