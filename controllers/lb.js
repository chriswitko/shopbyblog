"use strict";

// Load Balancer, Counters

var env = process.env.NODE_ENV || 'development';

var _ = require('lodash');
var async = require('async');
var og = require('open-graph-scraper');
var request = require('request');
var cheerio = require('cheerio');
var util = require('util');
var path = require('path');
var multer  = require('multer');
var lwip = require('lwip');
var fs = require('fs');
var moment = require('moment');
var nodemailer = require('nodemailer');
var secrets = require('../config/secrets')[env];

var jf = require('jsonfile')

var emailTemplates = require('email-templates');

var oxr = require('open-exchange-rates');
    oxr.set({ app_id: '8434471851a74a84a694099d1509e5c4' })

var fx = require('money');
var accounting = require('accounting');

var knox = require('knox');

var helper = require('../config/helper');

var Product = require('../models/Product');
var Vote = require('../models/Vote');
var User = require('../models/User');
var Comment = require('../models/Comment');
var Following = require('../models/Following');
var Campaign = require('../models/Campaign');
var Notification = require('../models/Notification');

var followUser = function(followee, follower, cb) {
  var locales = {}
  // console.log('fe', followee)
  // console.log('fr', follower)

  async.series({
    findFollowing: function(done) {
      Following.findOne({followee: followee, follower: follower}, function(err, following) {
        locales.following = following||new Following();
        done();
      });
    },
    updateFollowing: function(done) {
      locales.following.followee = followee;
      locales.following.follower = follower;
      locales.following.end = undefined;

      if(!locales.following.start) locales.following.start = new Date();
      locales.following.last = new Date();

      locales.following.save(function() {
        done();
      });
    },
    getFollowee: function(done) {
      User.findOne({_id: followee}, function(err, followee) {
        // console.log('followee', followee._id)
        locales.followee = followee
        done();
      })
    },
    updateCountersForFollowee: function(done) {
      updateCountersForUser(locales.followee, function() {
        done();
      })
    },
    getFollower: function(done) {
      // console.log('follower', follower._id)
      User.findOne({_id: follower}, function(err, follower) {
        locales.follower = follower
        done();
      })
    },
    updateCountersForFollower: function(done) {
      updateCountersForUser(locales.follower, function() {
        done();
      })
    }
  }, function() {
    cb({
      code: 200,
      status: 'success',
      following: true
    })
  })
}

var refreshJsonFile = function(profile, cb) {
  if(!profile) return cb(false);

  var locales = {};
      locales.profile = profile;
      locales.output = [];

  async.series({
    getAddedProducts: function(done) {
      var criteria = {};
      locales.products = [];

      if(!locales.profile) return cb(false);
      if(locales.profile) criteria.publisher = locales.profile._id;
      criteria.isHidden = false;
      Product.find(criteria).sort({createdAt: -1}).exec(function(err, products) {
        if(products) locales.products = locales.products.concat(_.map(products, function(product) {return {title: product.title, imageFileName: product.imageFileName, permalink: product.permalink, id: product._id, _id: product._id, createdAt: product.createdAt, votes: product.meta.votes}}));
        done()
      })
    },
    assignAds: function(done) {
      async.forEachSeries(locales.products, function(product, cb) {
        getActiveAdsByProduct(product, function(ads) {
          product.isPromoted = ads.length?true:false;
          locales.output.push({product: product});
          cb();
        })
      }, function() {
        done();
      })
    },
    saveFile: function(done) {
      var output = {
        profile: {id: locales.profile._id, permalink: locales.profile.permalink, username: locales.profile.username, followers: locales.profile.meta.followers},
        products: locales.output
      }
      var file = path.join(__dirname, '/../public/js/widget/data/u_' + locales.profile._id + '.json')
      // console.log('file', file)

      jf.writeFile(file, output, function(err) {
        // console.log('err json', err);
        done();
      })
    }
  }, function() {
    return cb({
      status: 'success'
    });
  })
};

var uploadProductImagesToCDN = function(filename, cb) {
  if(!filename) return cb(false);
  async.parallel({
    s: function(doneParallel) {
      uploadToS3('./public/uploads/s_'+filename, 'images', 's_'+filename, function() {
        doneParallel();
      });
    },
    // m: function(doneParallel) {
    //   uploadToS3('./public/uploads/m_'+filename, 'images', 'm_'+filename, function() {
    //     doneParallel();
    //   });
    // },
    l: function(doneParallel) {
      uploadToS3('./public/uploads/l_'+filename, 'images', 'l_'+filename, function() {
        doneParallel();
      });
    },
    // o: function(doneParallel) {
    //   uploadToS3('./public/uploads/o_'+filename, 'images', 'o_'+filename, function() {
    //     doneParallel();
    //   });
    // }
  }, function() {
    cb(true);
  });
}


var uploadToS3 = function(file, folder, filename, cb) {
  var s3 = knox.createClient({
      key: 'AKIAIGVSLQ2TDWZXLOJA'
    , secret: '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'
    , bucket: 'shopbyblog.images'
  });

  s3.putFile(file, '/' + folder + '/' + filename, function(err, output){
    cb({
      // url: output.client._httpMessage.url,
      err: err
    })
  });
}


var sendPlainEmail = function(options, cb) {
  if(!options||!options.to) return cb(false);

  var transporter = nodemailer.createTransport({
    service: 'SendGrid',
    auth: {
      user: secrets.sendgrid.user,
      pass: secrets.sendgrid.password
    }
  });

  var mailOptions = {
    to: options.to,
    from: options.from||secrets.gaEmail,
    subject: options.subject,
    text: options.text//'Hello,\n\n' + 'This is a confirmation that the password for your account ' + options.user.email + ' has just been changed.\n'
  };

  transporter.sendMail(mailOptions, function(err) {
    // console.log('SENDING OPTIONS:', mailOptions);
    // console.log('SENDING:', err);
    cb(true);
  });
}

var sendHtmlEmail = function(options, cb) {
  if(!options||!options.to) return cb(false);

  var mailingTemplatesDir   = path.join(__dirname, '/../views/mailing/pl');
  // console.log('dir', mailingTemplatesDir);
  emailTemplates(mailingTemplatesDir, function(err, template) {
    if (err) {
      // console.log('err4', err);
      return cb(false);
    } else {

      var transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: secrets.sendgrid.user,
          pass: secrets.sendgrid.password
        }
      });

      options.sbb = secrets.sbbConfig;
      options.moment = moment;

      template(options.templateName, options, function(err, html, text) {
        if (err) {
          // console.log('err1', err);
          return cb(false);
        } else {
          var mailOptions = {
            to: options.to,
            from: secrets.sendgrid.fromname + '<' + options.from||secrets.gaEmail + '>',
            subject: options.subject,
            generateTextFromHTML: true,
            html: html,
            text: text//'Hello,\n\n' + 'This is a confirmation that the password for your account ' + options.user.email + ' has just been changed.\n'
          };

          transporter.sendMail(mailOptions
          // {
            // from: 'Spicy Meatball <spicy.meatball@spaghetti.com>',
            // to: locals.email,
            // subject: 'Mangia gli spaghetti con polpette!',
            // html: html,
            // generateTextFromHTML: true,
            // text: text}
          , function(err, responseStatus) {
            if (err) {
              // console.log('err2', err);
              return cb(false);
            } else {
              // console.log('err3', responseStatus.message);
              return cb(true);
            }
          });
        }
      });
    }

  });
}

var campaignPrice = function(params, cb) {
  var results = []
  var locales = {}

  var days = [5, 10, 15, 20, 25, 30];

  async.series({
    getCurrencyRate: function(done) {
      oxr.latest(function() {
        // Apply exchange rates and base rate to `fx` library object:
        fx.rates = oxr.rates;
        fx.base = oxr.base;
        done();
      })
    },
    basePrice: function(done) {
      async.forEachSeries(days, function(day, callback) {
        locales = {}
        locales.pricePerFollower = 0.01;
        locales.pricePerUU = 0.003;
        locales.uniqeUsersPer5days = parseFloat((params.last12mPageUniqueUsers / 12 / 6).toFixed(0));
        params.days = day
        locales.days = params.days;

        if(params.last12mPageUniqueUsers<=30000&&params.last12mPageUniqueUsers>1000) locales.basePrice = 1.5 // 25 zł
        else if(params.last12mPageUniqueUsers>30000&&params.last12mPageUniqueUsers<=60000) locales.basePrice = 3.5
        else if(params.last12mPageUniqueUsers>60000) locales.basePrice = 5.5
        else locales.basePrice = 0

        // locales.basePrice = locales.basePrice  // min. 3 links per product

        locales.totalNetto = parseFloat(locales.basePrice) * params.days
        // price per ordered days
        // locales.totalNetto = locales.totalNetto * (parseFloat(params.days) / 5)
        // brutto, to pay + 23% VAT
        locales.totalBrutto = parseFloat((locales.totalNetto * 1.23).toFixed(2))
        // per day
        locales.totalPerDay = parseFloat((locales.totalBrutto/params.days).toFixed(2))
        // formatted
        locales.totalBruttoFormatted = accounting.formatMoney(locales.totalBrutto, "zł", 2, ".", ",", "%v %s")
        locales.totalPerDayFormatted = accounting.formatMoney(locales.totalPerDay, "zł", 2, ".", ",", "%v %s")


        var euroRate = (fx(1).from('PLN').to('EUR')).toFixed(2);
        var euroTotalNetto = (fx(locales.totalNetto).from('PLN').to('EUR')).toFixed(2);
        var euroTotalBrutto = (fx(locales.totalBrutto).from('PLN').to('EUR')).toFixed(2);
        var euroTotalPerDay = (fx(locales.totalPerDay).from('PLN').to('EUR')).toFixed(2);

        locales.euro = {
          rate: euroRate,
          totalNetto: parseFloat(euroTotalNetto),
          totalBrutto: parseFloat(euroTotalBrutto),
          totalPerDay: parseFloat(euroTotalPerDay),
          totalBruttoFormatted: accounting.formatMoney(euroTotalBrutto, "EUR", 2, ".", ",", "%v %s"),
          totalPerDayFormatted: accounting.formatMoney(euroTotalPerDay, "EUR", 2, ".", ",", "%v %s")
        }

        var usdRate = (fx(1).from('PLN').to('USD')).toFixed(2);
        var usdTotalNetto = (fx(locales.totalNetto).from('PLN').to('USD')).toFixed(2);
        var usdTotalBrutto = (fx(locales.totalBrutto).from('PLN').to('USD')).toFixed(2);
        var usdTotalPerDay = (fx(locales.totalPerDay).from('PLN').to('USD')).toFixed(2);

        locales.usd = {
          rate: usdRate,
          totalNetto: parseFloat(usdTotalNetto),
          totalBrutto: parseFloat(usdTotalBrutto),
          totalPerDay: parseFloat(usdTotalPerDay),
          totalBruttoFormatted: accounting.formatMoney(usdTotalBrutto, {symbol: '$'}),
          totalPerDayFormatted: accounting.formatMoney(usdTotalPerDay, {symbol: '$'})
        }

        // console.log(locales);
        results.push(locales);
        callback();

      }, function() {
        done();
      })

    },
  }, function() {
    cb(results);
  })
}

var campaignPriceOld2 = function(params, cb) {
  var results = []
  var locales = {}

  var days = [5, 10, 15, 20, 25, 30];

  async.series({
    getCurrencyRate: function(done) {
      oxr.latest(function() {
        // Apply exchange rates and base rate to `fx` library object:
        fx.rates = oxr.rates;
        fx.base = oxr.base;
        done();
      })
    },
    basePrice: function(done) {
      async.forEachSeries(days, function(day, callback) {
        locales = {}
        locales.pricePerFollower = 0.01;
        locales.pricePerUU = 0.003;
        locales.uniqeUsersPer5days = parseFloat((params.last12mPageUniqueUsers / 12 / 6).toFixed(0));
        params.days = day
        locales.days = params.days;

        if(params.last12mPageUniqueUsers<=30000) locales.basePrice = 1.5 // 25 zł
        else if(params.last12mPageUniqueUsers>30000&&params.last12mPageUniqueUsers<=60000) locales.basePrice = 3.5
        else locales.basePrice = 5.5

        // locales.basePrice = locales.basePrice  // min. 3 links per product

        locales.totalNetto = parseFloat(locales.basePrice) * params.days
        // price per ordered days
        // locales.totalNetto = locales.totalNetto * (parseFloat(params.days) / 5)
        // brutto, to pay + 23% VAT
        locales.totalBrutto = parseFloat((locales.totalNetto * 1.23).toFixed(2))
        // per day
        locales.totalPerDay = parseFloat((locales.totalBrutto/params.days).toFixed(2))
        // formatted
        locales.totalBruttoFormatted = accounting.formatMoney(locales.totalBrutto, "zł", 2, ".", ",", "%v %s")
        locales.totalPerDayFormatted = accounting.formatMoney(locales.totalPerDay, "zł", 2, ".", ",", "%v %s")


        var euroRate = (fx(1).from('PLN').to('EUR')).toFixed(2);
        var euroTotalNetto = (fx(locales.totalNetto).from('PLN').to('EUR')).toFixed(2);
        var euroTotalBrutto = (fx(locales.totalBrutto).from('PLN').to('EUR')).toFixed(2);
        var euroTotalPerDay = (fx(locales.totalPerDay).from('PLN').to('EUR')).toFixed(2);

        locales.euro = {
          rate: euroRate,
          totalNetto: parseFloat(euroTotalNetto),
          totalBrutto: parseFloat(euroTotalBrutto),
          totalPerDay: parseFloat(euroTotalPerDay),
          totalBruttoFormatted: accounting.formatMoney(euroTotalBrutto, "EUR", 2, ".", ",", "%v %s"),
          totalPerDayFormatted: accounting.formatMoney(euroTotalPerDay, "EUR", 2, ".", ",", "%v %s")
        }

        var usdRate = (fx(1).from('PLN').to('USD')).toFixed(2);
        var usdTotalNetto = (fx(locales.totalNetto).from('PLN').to('USD')).toFixed(2);
        var usdTotalBrutto = (fx(locales.totalBrutto).from('PLN').to('USD')).toFixed(2);
        var usdTotalPerDay = (fx(locales.totalPerDay).from('PLN').to('USD')).toFixed(2);

        locales.usd = {
          rate: usdRate,
          totalNetto: parseFloat(usdTotalNetto),
          totalBrutto: parseFloat(usdTotalBrutto),
          totalPerDay: parseFloat(usdTotalPerDay),
          totalBruttoFormatted: accounting.formatMoney(usdTotalBrutto, {symbol: '$'}),
          totalPerDayFormatted: accounting.formatMoney(usdTotalPerDay, {symbol: '$'})
        }

        // console.log(locales);
        results.push(locales);
        callback();

      }, function() {
        done();
      })

    },
  }, function() {
    cb(results);
  })
}

var campaignPriceOld = function(params, cb) {
  var results = []
  var locales = {}

  var days = [5, 10, 15, 20, 25, 30];

  async.series({
    getCurrencyRate: function(done) {
      oxr.latest(function() {
        // Apply exchange rates and base rate to `fx` library object:
        fx.rates = oxr.rates;
        fx.base = oxr.base;
        done();
      })
    },
    basePrice: function(done) {
      async.forEachSeries(days, function(day, callback) {
        locales = {}
        locales.pricePerFollower = 0.01;
        locales.pricePerUU = 0.003;
        locales.uniqeUsersPer5days = parseFloat((params.last12mPageUniqueUsers / 12 / 6).toFixed(0));
        params.days = day
        locales.days = params.days;

        if(params.lang=='pl') {
          if(params.last12mPageUniqueUsers<=30000) locales.basePrice = 25 // 25 zł
          else if(params.last12mPageUniqueUsers>30000&&params.last12mPageUniqueUsers<=90000) locales.basePrice = 35
          else locales.basePrice = 50
        } else {
          // global
          if(params.last12mPageUniqueUsers<=30000) locales.basePrice = 75 // 25 zł
          else if(params.last12mPageUniqueUsers>30000&&params.last12mPageUniqueUsers<=90000) locales.basePrice = 105
          else locales.basePrice = 150
        }

        // price per 5 days
        locales.totalNetto = (parseFloat(params.followers) * locales.pricePerFollower) + (locales.uniqeUsersPer5days * locales.pricePerUU)
        // console.log(locales.totalNetto)
        // price per ordered days
        locales.totalNetto = locales.totalNetto * (parseFloat(params.days) / 5)
        // discounts by length 10d = 10% etc.
        if(params.days > 5) {
          locales.totalNetto = locales.totalNetto - (locales.totalNetto * (parseFloat(params.days)/100))
          locales.discountOnDays = parseFloat(params.days)/100
        }
        // final netto
        locales.totalNetto = parseFloat((locales.totalNetto + parseFloat(locales.basePrice)).toFixed(2))
        // if active campaigns > 1 + 10%
        if(params.numberOfActiveAds>0) {
          locales.totalNetto = locales.totalNetto + (locales.totalNetto * 0.1);
          locales.extraChargeTooMuchAds = 0.1
        }
        // brutto, to pay + 23% VAT
        locales.totalBrutto = parseFloat((locales.totalNetto * 1.23).toFixed(2))
        // per day
        locales.totalPerDay = parseFloat((locales.totalBrutto / parseFloat(params.days)).toFixed(2))
        // formatted
        locales.totalBruttoFormatted = accounting.formatMoney(locales.totalBrutto, "zł", 2, ".", ",", "%v %s")
        locales.totalPerDayFormatted = accounting.formatMoney(locales.totalPerDay, "zł", 2, ".", ",", "%v %s")


        var euroRate = (fx(1).from('PLN').to('EUR')).toFixed(2);
        var euroTotalNetto = (fx(locales.totalNetto).from('PLN').to('EUR')).toFixed(2);
        var euroTotalBrutto = (fx(locales.totalBrutto).from('PLN').to('EUR')).toFixed(2);
        var euroTotalPerDay = (fx(locales.totalPerDay).from('PLN').to('EUR')).toFixed(2);

        locales.euro = {
          rate: euroRate,
          totalNetto: parseFloat(euroTotalNetto),
          totalBrutto: parseFloat(euroTotalBrutto),
          totalPerDay: parseFloat(euroTotalPerDay),
          totalBruttoFormatted: accounting.formatMoney(euroTotalBrutto, "EUR", 2, ".", ",", "%v %s"),
          totalPerDayFormatted: accounting.formatMoney(euroTotalPerDay, "EUR", 2, ".", ",", "%v %s")
        }

        var usdRate = (fx(1).from('PLN').to('USD')).toFixed(2);
        var usdTotalNetto = (fx(locales.totalNetto).from('PLN').to('USD')).toFixed(2);
        var usdTotalBrutto = (fx(locales.totalBrutto).from('PLN').to('USD')).toFixed(2);
        var usdTotalPerDay = (fx(locales.totalPerDay).from('PLN').to('USD')).toFixed(2);

        locales.usd = {
          rate: usdRate,
          totalNetto: parseFloat(usdTotalNetto),
          totalBrutto: parseFloat(usdTotalBrutto),
          totalPerDay: parseFloat(usdTotalPerDay),
          totalBruttoFormatted: accounting.formatMoney(usdTotalBrutto, {symbol: '$'}),
          totalPerDayFormatted: accounting.formatMoney(usdTotalPerDay, {symbol: '$'})
        }

        // console.log(locales);
        results.push(locales);
        callback();

      }, function() {
        done();
      })

    },
  }, function() {
    cb(results);
  })
}

var setScore = function(product, forceUpdate, cb) {
  var item = product;

  // console.log(item)

  // Status Check

  // if (!!item.status && item.status !=2) // if item has a status and is not approved, don't update its score
    // return 0;

  // Age Check

  // If for some reason item doesn't have a "postedAt" property, abort
  if (!item.createdAt)
    return cb(0)

  var postedAt = item.createdAt.valueOf();
  var now = new Date().getTime();
  var age = now - postedAt;
  var ageInHours = age / (60 * 60 * 1000);

  if (postedAt > now) // if post has been scheduled in the future, don't update its score
    return cb(0);

  // For performance reasons, the database is only updated if the difference between the old score and the new score
  // is meaningful enough. To find out, we calculate the "power" of a single vote after n days.
  // We assume that after n days, a single vote will not be powerful enough to affect posts' ranking order.
  // Note: sites whose posts regularly get a lot of votes can afford to use a lower n.

  // n =  number of days after which a single vote will not have a big enough effect to trigger a score update
  //      and posts can become inactive
  var n = 30;
  // x = score increase amount of a single vote after n days (for n=100, x=0.000040295)
  var x = 1/Math.pow(n*24+2,1.3);
  // time decay factor
  var f = 1.3;

  // use baseScore if defined, if not just use the number of votes
  // note: for transition period, also use votes if there are more votes than baseScore
  if(!item.score)
    var baseScore = Math.max(item.meta.upvotes || 0, item.meta.clicks || 0);
  else
    var baseScore = item.score;

  // HN algorithm
  var newScore = baseScore / Math.pow(ageInHours + 2, f);

  // console.log(now)
  // console.log(age)
  // console.log(ageInHours)
  // console.log(baseScore)
  // console.log(newScore)

  // Note: before the first time updateScore runs on a new item, its score will be at 0
  var scoreDiff = Math.abs(item.score - newScore);

  // only update database if difference is larger than x to avoid unnecessary updates
  if (forceUpdate || scoreDiff > x){
    Product.update({_id: item._id}, {$set: {score: newScore, isInactive: false}}).exec(function(err, updated) {
      return cb(1)
    });
  }else if(ageInHours > n*24){
    // only set a post as inactive if it's older than n days
    Product.update({_id: item._id}, {$set: {isInactive: true}}).exec(function() {
      return cb(0);
    });
  } else return cb(0);

}

var createNotification = function(params, cb) {
  var notification = new Notification();

  notification.author = params.author;
  notification.elementType = params.elementType;
  notification.elementObject = params.elementObject;
  notification.elementId = params.elementId;
  notification.verb = params.verb;
  notification.message = params.message;
  notification.url = params.url;
  notification.isGlobal = params.isGlobal;
  notification.save(function(err, saved) {
    return cb(saved);
  })
};

var updateCountersForProduct = function(product, cb) {
  var locales = {};

  async.parallel({
    updateProductVotes: function(done) {
      Vote.aggregate([
        { $match: {product: product._id, end: null} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalVotes = totalOutput[0].count;
        Product.update({_id: product._id}, {$set: {'meta.upvotes': totalOutput[0].count}}).exec(function() {
          done()
        });
      });
    },
    updateProductComments: function(done) {
      Comment.aggregate([
        { $match: {product: product._id} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalComments = totalOutput[0].count;
        Product.update({_id: product._id}, {$set: {'meta.comments': totalOutput[0].count}}).exec(function() {
          done()
        });
      });
    },
  }, function() {
    return cb(locales);
  })
}

var updateCountersForProductCOUNT = function(product, cb) {
  var locales = {};

  async.parallel({
    updateProductVotes: function(done) {
      Vote.count({product: product._id, end: null}, function(err, totalCount) {
        locales.totalVotes = totalCount;
        Product.update({_id: product._id}, {$set: {'meta.upvotes': totalCount}}).exec(function() {
          done()
        });
      })
    },
    updateProductComments: function(done) {
      Comment.count({product: product._id}, function(err, totalCount) {
        locales.totalComments = totalCount;
        Product.update({_id: product._id}, {$set: {'meta.comments': totalCount}}).exec(function() {
          done()
        });
      })
    },
  }, function() {
    return cb(locales);
  })
}

var updateCountersForUser = function(user, cb) {
  var locales = {};
  var params = {};

  moment.locale('en-US');
  var nowNow = moment().zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');

  async.parallel({
    updateUserCampaigns: function(done) {
      Campaign.aggregate([
        { $match: {'price.isPaid': true, blogger: user._id} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalCampaigns = totalOutput[0].count;
        params['meta.campaigns'] = totalOutput[0].count;
        done()
      });
    },
    updateUserActiveCampaigns: function(done) {
      Campaign.aggregate([
        { $match: {'price.isPaid': true, isLive: true, blogger: user._id} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalCampaigns = totalOutput[0].count;
        params['meta.activeCampaigns'] = totalOutput[0].count;
        done()
      });
    },
    updateUserProducts: function(done) {
      Product.aggregate([
        { $match: {author: user._id, isHidden: false} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalProducts = totalOutput[0].count;
        params['meta.products'] = totalOutput[0].count;
        done()
      });
    },
    updateUserVotes: function(done) {
      Vote.aggregate([
        { $match: {follower: user._id, end: null} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalVotes = totalOutput[0].count;
        params['meta.upvotes'] = totalOutput[0].count;
        done()
      });
    },
    updateUserComments: function(done) {
      Comment.aggregate([
        { $match: {user: user._id} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalComments = totalOutput[0].count;
        params['meta.comments'] = totalOutput[0].count;
        done()
      });
    },
    updateUserFollowing: function(done) {
      Following.aggregate([
        { $match: {follower: user._id, end: undefined} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalFollowing = totalOutput[0].count;
        params['meta.following'] = totalOutput[0].count;
        done()
      });
    },
    updateUserFollowers: function(done) {
      Following.aggregate([
        { $match: {followee: user._id, end: undefined} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        if(!totalOutput||!totalOutput[0]) return done();
        locales.totalFollowers = totalOutput[0].count;
        params['meta.followers'] = totalOutput[0].count;
        done()
      });
    },
  }, function() {
    User.update({_id: user._id}, {$set: params}).exec(function() {
      return cb(locales);
    });
  })
}

var updateCountersForUserCOUNT = function(user, cb) {
  var locales = {};

  async.parallel({
    testAggr: function(done) {
      Product.aggregate([
        { $match: {author: user._id, isHidden: false} },
        { $group: {_id: null, count: { $sum: 1 } } }
      ], function(err, totalOutput) {
        // console.log('output', totalOutput)
        // console.log('output', totalOutput[0]?totalOutput[0].count:'none')
        done();
      });
    },
    updateUserProducts: function(done) {
      Product.count({author: user._id}, function(err, totalCount) {
        locales.totalProducts = totalCount;
        User.update({_id: user._id}, {$set: {'meta.products': totalCount}}).exec(function() {
          done()
        });
      })
    },
    updateUserVotes: function(done) {
      Vote.count({follower: user._id, end: null}, function(err, totalCount) {
        locales.totalVotes = totalCount;
        User.update({_id: user._id}, {$set: {'meta.upvotes': totalCount}}).exec(function() {
          done()
        });
      })
    },
    updateUserComments: function(done) {
      Comment.count({user: user._id}, function(err, totalCount) {
        locales.totalComments = totalCount;
        User.update({_id: user._id}, {$set: {'meta.comments': totalCount}}).exec(function() {
          done()
        });
      })
    },
    updateUserFollowing: function(done) {
      Following.count({follower: user._id, end: undefined}, function(err, totalCount) {
        locales.totalFollowing = totalCount;
        User.update({_id: user._id}, {$set: {'meta.following': totalCount}}).exec(function() {
          done()
        });
      })
    },
    updateUserFollowers: function(done) {
      Following.count({followee: user._id, end: undefined}, function(err, totalCount) {
        locales.totalFollowers = totalCount;
        User.update({_id: user._id}, {$set: {'meta.followers': totalCount}}).exec(function() {
          done()
        });
      })
    },
  }, function() {
    // TODO: Multiple User.update into one here
    return cb(locales);
  })
}

var getActiveAdsByProduct = function(product, cb) {
  var locales = {}
  moment.locale('en-US');
  var nowNow = moment().zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
  // console.log('fromnow', nowNow);
  // console.log('ad params', {'price.isPaid': true, product: product._id, start: {$lte: nowNow}, end: {$gte: nowNow}})
  Campaign.find({'price.isPaid': true, product: product._id, start: {$lte: nowNow}, end: {$gte: nowNow}})
    .populate({
      path: 'user'
    })
    .sort({createdAt:-1})
    .exec(function(err, ads) {
      if(ads) locales.ads = _.map(ads, function(ad) {return {ad: ad}});
      cb(locales.ads);
    });
}

var repairUrl = function(url) {
  if(url) {
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
      return 'http://' + url;
    } else {
      return url
    }
  } else {
    return url
  }
}

// var updateCounters = function(product, cb) {
//   var locales = {};

//   async.parallel({
//     updateProductVotes: function(done) {
//       Vote.count({product: product._id, end: null}, function(err, totalCount) {
//         locales.totalVotes = totalCount;
//         Product.update({_id: product._id}, {$set: {'meta.upvotes': totalCount}}).exec(done());
//       })
//     },
//     updateProductComments: function(done) {
//       Comment.count({product: product._id}, function(err, totalCount) {
//         locales.totalComments = totalCount;
//         Product.update({_id: product._id}, {$set: {'meta.comments': totalCount}}).exec(done());
//       })
//     },
//     updateUserVotes: function(done) {
//       done();
//     }
//   }, function() {
//     return cb(locales);
//   })
// }


exports.getActiveAdsByProduct = getActiveAdsByProduct;
exports.updateCountersForProduct = updateCountersForProduct;
exports.updateCountersForUser = updateCountersForUser;
exports.createNotification = createNotification;
exports.setScore = setScore;
exports.campaignPrice = campaignPrice;
exports.repairUrl = repairUrl;
exports.sendPlainEmail = sendPlainEmail;
exports.sendHtmlEmail = sendHtmlEmail;
exports.uploadToS3 = uploadToS3;
exports.uploadProductImagesToCDN = uploadProductImagesToCDN;
exports.refreshJsonFile = refreshJsonFile;
exports.followUser = followUser;