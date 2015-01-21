#!/usr/bin/env node

var program = require('commander');

var http = require('http-get')
    , fs = require('fs')
    , pack = require('./package')
    , colors = require('colors')
    , env = process.env.NODE_ENV || 'development'
    , config = require('./config/config')[env]
    , mongoose = require('mongoose')
    , Table = require('cli-table')
    , fx = require('accounting')
    , moment = require('moment-timezone')
    , async = require('async')
    , elasticsearch = require('elasticsearch')
    , Q = require('q')
    , Imager = require('imager')
    , imagerConfig = require('./config/imager.js')
    , url = require('url')
    , XmlStream = require('xml-stream')
    , uuid = require('node-uuid')
    , inspect = require('eyespect').inspector()
    , temp = require('temp')
    , filed = require('filed')
    , request = require('request')
    , _ = require('underscore')
    , S = require('string')
    , select = require('mongoose-json-select').select

var username = process.argv[2]||0

var start_from = process.argv[3]||0

var start_to = process.argv[4]||10000

console.log('Connecting to DB: ' + config.db);
mongoose.connect(config.db, function() {})

var models_path = __dirname + '/models'
fs.readdirSync(models_path).forEach(function (file) {
  if (~file.indexOf('.js')) require(models_path + '/' + file)
})

var Store = mongoose.model('Store')
var Deal = mongoose.model('Deal')
var Category = mongoose.model('Category')
var CategoryBase = mongoose.model('CategoryBase')
var Wish = mongoose.model('Wish')

console.log(['env']);
console.log('APP: ' + config.app.name.green);
console.log('ENV: ' + env.green);

console.log('Downloading images for products...');

var totalNew = 0
var totalUpdated = 0
var progress = 0

var download = function(uri, filename){
  var deferred = Q.defer();
  http.get(uri, filename, function (error, result) {
    deferred.resolve(result)
  });
  return deferred.promise;
};

var upload = function(filename) {
  console.log('inside upload', filename)
  var deferred = Q.defer();
  var imager = new Imager(imagerConfig, 'S3')
  imager.upload(filename, function (err, cdnUri, files) {
    deferred.resolve({ cdnUri : config.s3_uri, files : files })
  }, 'wish')
  return deferred.promise
}


var locales = {}

var stream = Wish.find({$or: [{isImageReady: false}, {isImageReady: {$exists: false}}] }).sort({createdAt: -1}).limit(50).stream()//vanityUrl: '10-100-100-100-54'//.limit(20)

// var stream = Wish.find({_id: {$in: ['541ad6c467a7daf54f36036f']}, $or: [{isImageReady: false}, {isImageReady: {$exists: false}}] }).stream()//vanityUrl: '10-100-100-100-54'//.limit(20)
// var stream = Wish.find({isImageReady: false}).limit(100).stream()//vanityUrl: '10-100-100-100-54'//.limit(20)
stream.on('data', function (wish) {
  console.log('wish', wish._id + ':' + wish.pictureUrl)
  var isOK = true

  if(!wish.pictureUrl) isOK = false

  this.pause()
  progress++
  if(!(progress%5)) console.log('Already %d items', progress)

  var self = this

  if(isOK) {
    async.series({
      downloadAndUpload: function(callback) {
        locales.downloadPath = temp.path({prefix: 'avatar', suffix: '.jpg'});

        locales.image_url = wish.pictureUrl

        if(locales.image_url.indexOf('http:')<0&&locales.image_url.indexOf('https:')<0) locales.image_url = 'http:' + locales.image_url

          callback()
      },
      downloadImage: function(callback) {
        http.get(locales.image_url, locales.downloadPath, function (error, result) {
          callback()
        });
      },
      uploadToS3: function(callback) {
        if (fs.existsSync(locales.downloadPath)) {
          var imager = new Imager(imagerConfig, 'S3')
          imager.upload(locales.downloadPath, function (err, cdnUri, files) {
            locales.picture = { cdnUri : config.s3_uri, files : files }
            callback()
          }, 'wish')
        } else {
          callback()
        }
      },
      updateWishPicture: function(callback) {
        if (fs.existsSync(locales.downloadPath)) {
          console.log('updated', wish._id)
          Wish.update({_id: wish._id}, {$set: {'picture': locales.picture, isImageReady: true}}).exec(function(err, item) {
            console.log('err', err)
            callback()
          })
        } else {
          Wish.update({_id: wish._id}, {$set: {'isImageReady': true}}).exec(function(err, item) {
            console.log('err', err)
            callback()
          })
        }
      },
    }, function() {
      self.resume()
    })
  } else {
    self.resume()
  }

}).on('error', function (err) {
  console.log('err:', err)
}).on('close', function () {

console.log('Finito.')
process.exit(0)

});

