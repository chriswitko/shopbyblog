"use strict";

var env = process.env.NODE_ENV || 'development';

var secrets = require('../config/secrets')[env];

var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var oxr = require('open-exchange-rates');
    oxr.set({ app_id: '8434471851a74a84a694099d1509e5c4' })

var fx = require('money');
var md5 = require('MD5');

var lb = require('./lb');

var Campaign = require('../models/Campaign');
var Product = require('../models/Product');
var User = require('../models/User');

exports.testGoogleAnal2 = function(req, res) {
  var Report = require('ga-report');

  var report = new Report(secrets.gaEmail, secrets.gaPassword);
  report.once('ready', function() {
    var options = {
      'ids': 'ga:96166364-UA',
      'start-date': '2015-01-10',
      'end-date': '2015-01-10',
      'metrics': 'ga:totalEvents,ga:uniqueEvents'
    };
    report.get(options, function(err, data) {
      // if (err) console.error(err);
      res.json(data);
    });
  });
}

exports.testGoogleAnal3 = function(req, res) {
  var GA = require('../vendor_modules/ga/ga.js'),
      util = require('util'),
      config = {
          "user": secrets.gaEmail,
          "password": secrets.gaPassword
      },
      ga = new GA.GA(config);

  // console.log('converted time', moment('20150110', "YYYY-MM-DD").toDate());

  ga.login(function(err, token) {
    // console.log(err);
      var options = {
          'ids': 'ga:96166364',//50484734
          'start-date': '2015-01-09',
          'end-date': '2015-01-11',
          'filters': 'ga:eventLabel==user_543fc3a7041cd6d445b17d0e',
          // 'metrics': 'ga:users',
          // 'demensions': 'ga:referralPath,ga:fullReferrer',
          // 'metrics': 'ga:organicSearches',

          // 'dimensions': 'ga:pagePath,ga:hostname',
          // 'metrics': 'ga:pageviews,ga:uniquePageviews',
          // 'sort': '-ga:pagePath'
          'metrics': 'ga:totalEvents,ga:uniqueEvents',
          'dimensions': 'ga:date,ga:eventLabel,ga:eventAction',
          'sort': '-ga:totalEvents'
          // 'demensions': 'ga:sourceMedium',
          // 'metrics': 'ga:organicSearches',
      };

      ga.get(options, function(err, entries) {
        // console.log(err);
        // util.debug(JSON.stringify(entries));
        res.json(entries);
         // util.debug(JSON.stringify(entries));
      });
  });
}


exports.testGoogleAnal = function(req, res) {
  var GA = require('../vendor_modules/ga/ga.js'),
      util = require('util'),
      config = {
          "user": secrets.gaEmail,
          "password": secrets.gaPassword
      },
      ga = new GA.GA(config);

  // console.log('converted time', moment('20150110', "YYYY-MM-DD").toDate());
  var nowNow = moment().format('YYYY-MM-DD');

  ga.login(function(err, token) {
    // console.log(err);
      var options = {
          'ids': 'ga:96169939',//50484734
          'start-date': nowNow,
          'end-date': nowNow,
          'filters': 'ga:eventLabel=~^campaign_.*',
          'metrics': 'ga:totalEvents,ga:uniqueEvents',
          'dimensions': 'ga:date,ga:eventLabel,ga:eventAction',
          'sort': '-ga:totalEvents'
      };

      ga.get(options, function(err, entries) {
        var output = _.map(entries, function(entry) {
          entry.dimensions = _.map(entry.dimensions, function(dimension) {
            // dimension['ga:date'] = moment(dimension['ga:date'], "YYYY-MM-DD").toDate();
            dimension['ga:eventLabel'] = dimension['ga:eventLabel'].replace('campaign_','');
            return dimension;
          });
          return entry;
        });
        res.json(output);
      });
  });
}

exports.campaignPrice = function(req, res) {
  lb.campaignPrice({lang: req.query.lang, basePrice: req.query.basePrice, last12mPageUniqueUsers: req.query.uu, followers: req.query.followers, numberOfActiveAds: req.query.naa, days: req.query.days}, function(output) {
    res.json(output)
  });
}

exports.euro = function(req, res) {
  oxr.latest(function() {
      // Apply exchange rates and base rate to `fx` library object:
      fx.rates = oxr.rates;
      fx.base = oxr.base;

      // money.js is ready to use:
      res.json({
        price: fx(1).from('PLN').to('EUR'),
        inEuro: fx(req.query.a||0).from('PLN').to('EUR')
      })
  });
}

exports.report = function(req, res) {
  var locales = {}
      locales.amount = 0.00;

  if(!req.query.cid) return res.redirect('/');

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: req.query.cid})
        .populate({
          path: 'product',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          done();
        })
    },
    checkPermission: function(done) {
      if(!req.user||(req.user._id.toString()!=locales.campaign.blogger.toString()&&req.user._id.toString()!=locales.campaign.user.toString())) return res.redirect('/');
      return done();
    },
    getProduct: function(done) {
      Product.findOne({_id: locales.campaign.product._id})
        .populate({
          path: 'author',
          select: '_id username permalink profile email blogger meta'
        })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    findBlogger: function(done) {
      User.findOne({_id: locales.campaign.blogger}).exec(function(err, blogger) {
        locales.blogger = blogger
        done();
      })
    },
  }, function() {
    res.render('ads/report', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: locales.campaign,
      product: locales.product,
      pricing: locales.pricing,
      processedDays: _.uniq(locales.campaign.daily, function(day) {return day.day}).length,
      md5sum: md5('17460' + locales.campaign.price.totalPrice.toString() + locales.campaign._id + 'U6lRv4cAiw96GsRi')
    });
  })
};

exports.payment = function(req, res) {
  var locales = {}
      locales.amount = 0.00;

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: req.query.cid})
        .populate({
          path: 'product',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          done();
        })
    },
    getProduct: function(done) {
      Product.findOne({_id: locales.campaign.product._id})
        .populate({
          path: 'author',
          select: '_id username permalink profile email blogger meta'
        })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    findBlogger: function(done) {
      User.findOne({_id: locales.campaign.blogger}).exec(function(err, blogger) {
        locales.blogger = blogger
        done();
      })
    },
  }, function() {
    // id + kwota + crc + kod potwierdzający sprzedawcy
    res.render('ads/summarize', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: locales.campaign,
      product: locales.product,
      pricing: locales.pricing,
      payNow: 1,
      demo: req.query.demo?true:false,
      md5sum: md5('17460' + locales.campaign.price.totalPrice.toString() + locales.campaign._id + 'U6lRv4cAiw96GsRi')
    });
  })
};

exports.update = function(req, res) {
  var locales = {}
      locales.amount = 0.00;

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: req.query.cid})
        .populate({
          path: 'user',
        })
        .populate({
          path: 'product',
        })
        .populate({
          path: 'blogger',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          locales.campaign.price.days = req.body.days;
          if(req.body.url) locales.campaign.url = req.body.url;
          if(req.body.days) locales.campaign.price.days = req.body.days;
          // if(req.body.start) locales.campaign.start = moment(req.body.start+'T'+moment().format('HH:mm:ss')).zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          // if(req.body.end) locales.campaign.end = moment(req.body.end+'T'+'23:59:59').zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          done();
        })
    },
    getProduct: function(done) {
      Product.findOne({_id: locales.campaign.product._id})
        .populate({
          path: 'author',
          select: '_id username permalink profile email blogger meta'
        })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    findBlogger: function(done) {
      User.findOne({_id: locales.campaign.blogger}).exec(function(err, blogger) {
        locales.blogger = blogger
        done();
      })
    },
    getAds: function(done) {
      locales.ads = []
      if(locales.product) {
        lb.getActiveAdsByProduct(locales.product, function(ads) {
          if(!ads) return done();
          locales.ads = ads
          done();
        })
      } else {
        done();
      }
    },
    calcPricing: function(done) {
      lb.campaignPrice({lang: locales.blogger.blogger.locale, last12mPageUniqueUsers: locales.blogger.blogger.last12mPageUniqueUsers, followers: locales.blogger.meta.followers, numberOfActiveAds: locales.ads.length}, function(output) {
        locales.pricing = output
        done();
      });
    },
    calculatePrice: function(done) {
      async.parallel({
        basePrice: function(done) {
          locales.campaign.price.bloggerShare = locales.blogger.business.baseShare;
          locales.campaign.price.basePrice = locales.blogger.business.basePrice;
          done();
        },
        extraPrice: function(done) {
          locales.campaign.price.extraPrice = Math.ceil(25);
          done();
        },
        discountsBasedOnNumberOfAdsOrSpentMoney: function(done) {
          // locales.campaign.price.discount = 0.10;
          done();
        }
      }, function() {
        done();
      })
    },
    updateCampaign: function(done) {
      locales.campaign.save(function(err, campaign) {
        locales.campaign = campaign;
        done();
      })
    }
  }, function() {
    res.render('ads/create_click', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: locales.campaign,
      demo: req.body.demo?true:false,
      pricing: locales.pricing
    });
  })
};

exports.paypalCancel = function(req, res) {
  res.json(req.body);
}

exports.paymentError = function(req, res) {
  var locales = {}
      locales.amount = 0.00;

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: options.payment.custom})
        .populate({
          path: 'product',
        })
        .populate({
          path: 'user',
        })
        .populate({
          path: 'blogger',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          done();
        })
    },
  }, function() {
    res.render('ads/payed', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: options.campaign,
      status: false
    });
  });
}

exports.transferujPaid = function(req, res) {
  var options = {};
      options.adPaymentMethod = 'Bank Transfer';
      options.adPaymentService = 'Transferuj';
      options.payment = {custom: req.query.cid};

  payed(options, function(output) {
    User.update({_id: output.campaign.blogger}, {$set: {pleaseRefreshJson: true}}).exec(function() {
      res.render('ads/payed', {
        showSearchBox: false,
        title: 'Reklama',
        campaign: output.campaign,
        status: output.campaign.price.isPaid
      });
    });
  });
}

exports.paypalPayed = function(req, res) {
  // console.log(req.body);
  // Completed, Created, Pending, Processed
  // txn_id
  // console.log('body', req.body);
  // console.log('ref', req.headers['referer']);

  var options = {};
      options.adPaymentMethod = 'Credit Card';
      options.adPaymentService = 'PayPal';
      options.payment = req.body;

  if(req.body.txn_id && (req.body.payment_status=='Completed'||req.body.payment_status=='Created'||req.body.payment_status=='Pending'||req.body.payment_status=='Processed')) {
    payed(options, function(output) {
      User.update({_id: output.campaign.blogger}, {$set: {pleaseRefreshJson: true}}).exec(function() {
        res.render('ads/payed', {
          title: 'Reklama',
          campaign: output.campaign,
          status: output.campaign.price.isPaid
        });
      });
    })
  } else {
    res.render('ads/payed', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: options.campaign,
      status: false
    });
  }

  // res.json(req.body);
}

var payed = function(options, cb) {
  // console.log('options', options)
  var locales = {}
      locales.amount = 0.00;

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: options.payment.custom})
        .populate({
          path: 'product',
        })
        .populate({
          path: 'user',
        })
        .populate({
          path: 'blogger',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          if(!locales.campaign.start) {
            locales.campaign.price.isPaid = true;
            locales.campaign.price.adPaymentMethod = options.adPaymentMethod;
            locales.campaign.price.adPaymentService = options.adPaymentService;
            locales.campaign.price.adTransactionId = options.payment.txn_id;
            locales.campaign.start = moment().zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
            locales.campaign.end = moment(locales.campaign.start).add(locales.campaign.price.days, 'days').zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          }
          done();
        })
    },
    updateCampaign: function(done) {
      locales.campaign.save(function(err, campaign) {
        // locales.campaign = campaign;
        done();
      })
    },
    sendMailPaySuccessful: function(done) {
      lb.sendHtmlEmail({to: locales.campaign.user.email, user: locales.campaign.user, campaign: locales.campaign, subject: 'shopbyblog.com - Potwierdzenie przyjęcia płatności on-line', templateName: 'campaign-payment'}, function(output) {
        done();
      });
    },
    sendMailNotifyUser: function(done) {
      lb.sendHtmlEmail({to: locales.campaign.user.email, user: locales.campaign.user, campaign: locales.campaign, subject: 'shopbyblog.com - Potwierdzenie uruchomienia kampanii', templateName: 'campaign-successful'}, function(output) {
        done();
      });
    },
    sendMailNotifyBlogger: function(done) {
      lb.sendHtmlEmail({to: locales.campaign.blogger.email, user: locales.campaign.blogger, campaign: locales.campaign, subject: 'shopbyblog.com - Potwierdzenie uruchomienia nowej kampanii', templateName: 'campaign-successful'}, function(output) {
        done();
      });
    }
  }, function() {
    cb({
      campaign: locales.campaign
    });
  })
};


exports.update_edit = function(req, res) {
  var locales = {}
      locales.amount = 0.00;

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: req.query.cid})
        .populate({
          path: 'product',
        })
        .populate({
          path: 'user',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          if(req.body.url) locales.campaign.url = lb.repairUrl(req.body.url);
          if(req.body.days) locales.campaign.price.days = req.body.days;

          if(req.body.fullname) locales.campaign.invoice.fullname = req.body.fullname;
          if(req.body.address1) locales.campaign.invoice.address1 = req.body.address1;
          if(req.body.address2) locales.campaign.invoice.address2 = req.body.address2;
          if(req.body.city) locales.campaign.invoice.city = req.body.city;
          if(req.body.country) locales.campaign.invoice.country = req.body.country;
          if(req.body.postcode) locales.campaign.invoice.postcode = req.body.postcode;
          if(req.body.vatNumber) locales.campaign.invoice.vatNumber = req.body.vatNumber;
          if(req.body.invoiceCurrencyCode) locales.campaign.invoice.invoiceCurrencyCode = req.body.invoiceCurrencyCode;
          // if(req.body.start) locales.campaign.start = moment(req.body.start+'T'+moment().format('HH:mm:ss')).zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          // if(req.body.end) locales.campaign.end = moment(req.body.end+'T'+'23:59:59').zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          done();
        })
    },
    getProduct: function(done) {
      Product.findOne({_id: locales.campaign.product._id})
        .populate({
          path: 'author',
          select: '_id username name permalink profile email blogger meta'
        })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    findBlogger: function(done) {
      User.findOne({_id: locales.campaign.blogger}).exec(function(err, blogger) {
        locales.blogger = blogger
        done();
      })
    },
    getAds: function(done) {
      locales.ads = []
      if(locales.product) {
        lb.getActiveAdsByProduct(locales.product, function(ads) {
          if(!ads) return done();
          locales.ads = ads
          done();
        })
      } else {
        done();
      }
    },
    calcPricing: function(done) {
      lb.campaignPrice({lang: locales.blogger.blogger.locale, last12mPageUniqueUsers: locales.blogger.blogger.last12mPageUniqueUsers, followers: locales.blogger.meta.followers, numberOfActiveAds: locales.ads.length}, function(output) {
        locales.pricing = output
        locales.campaign.price.plnRate = 1;
        locales.campaign.price.eurRate = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].euro.rate;
        locales.campaign.price.usdRate = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].usd.rate;
        locales.campaign.price.nettoPrice = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].totalNetto;
        locales.campaign.price.totalPrice = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].totalBrutto;
        locales.campaign.price.totalPriceFormatted = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].totalBruttoFormatted;
        locales.campaign.price.euro = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].euro;
        locales.campaign.price.usd = locales.pricing[((parseFloat(locales.campaign.price.days) / 5)-1)].usd;
        locales.campaign.bloggerShare = locales.blogger.business.baseShare;
        done();
      });
    },
    updateCampaign: function(done) {
      locales.campaign.save(function(err, campaign) {
        // console.log('ERR', err);
        locales.campaign = campaign;
        done();
      })
    },
    sendMailInit: function(done) {
      lb.sendHtmlEmail({to: locales.campaign.user.email, user: locales.campaign.user, campaign: locales.campaign, subject: 'Informacje o utworzeniu kampanii reklamowej w serwisie ShopByBlog', templateName: 'campaign-init'}, function(output) {
        done();
      });
    }
  }, function() {
    res.render('ads/summarize', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: locales.campaign,
      payNow: req.query.pay?true:false,
      product: locales.product,
      demo: req.body.demo?true:false,
      md5sum: md5('17460' + locales.campaign.price.totalPrice.toString() + locales.campaign._id + 'U6lRv4cAiw96GsRi')
    });
  })
};

exports.update_calculate = function(req, res) {
  var locales = {}
      locales.amount = 0.00;

  async.series({
    findCampaign: function(done) {
      Campaign.findOne({_id: req.query.cid})
        .populate({
          path: 'product',
        })
        .exec(function(err, campaign) {
          locales.campaign = campaign;
          if(req.body.url) locales.campaign.url = req.body.url;
          if(req.body.start) locales.campaign.start = moment(req.body.start+'T'+moment().format('HH:mm:ss')).zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          if(req.body.end) locales.campaign.end = moment(req.body.end+'T'+'23:59:59').zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          if(req.body.isInvoiced) locales.campaign.price.isInvoiced = req.body.isInvoiced;
          else locales.campaign.price.isInvoiced = false;
          done();
        })
    },
    calculatePrice: function(done) {
      async.parallel({
        basePrice: function(done) {
          locales.campaign.price.basePrice = 25;
          done();
        },
        extraPrice: function(done) {
          locales.campaign.price.extraPrice = 25;
          done();
        }
      }, function() {
        done();
      })
    },
    updateCampaign: function(done) {
      locales.campaign.save(function(err, campaign) {
        locales.campaign = campaign;
        done();
      })
    }
  }, function() {
    res.render('ads/summarize', {
      showSearchBox: false,
      title: 'Reklama',
      campaign: locales.campaign
    });
  })
};

exports.create = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      if(req.query.pid) {
        Product.findOne({_id: req.query.pid})
          .exec(function(err, product) {
            if(product) locales.product = product
            done()
          })
      } else {
        done();
      }
    },
    findCampaign: function(done) {
      if(req.query.cid) {
        Campaign.findOne({_id: req.query.cid})
          .populate({
            path: 'product',
          })
          .exec(function(err, campaign) {
            locales.campaign = campaign;
            done();
          })
      } else {
        if(locales.product) {
          var campaign = new Campaign();
          campaign.variant = req.query.variant;
          campaign.user = req.user._id;
          campaign.blogger = locales.product.author; // change to publisher
          campaign.product = locales.product;
          campaign.section = locales.product.section;

          campaign.save(function(err, campaign) {
            // console.log('ERR', err)
            locales.campaign = campaign;
            done();
          })
        } else {
          done();
        }
      }
    }
  }, function() {
    if(!locales.campaign) return res.redirect('/');
    res.redirect('/ads/edit?cid='+locales.campaign._id);
  })
};

exports.create_click = function(req, res) {
  res.render('ads/create_click', {
    showSearchBox: false,
    title: 'Reklama',
    product_id: req.query.pid,
    variant: 1
  });
};

exports.recalculate = function(req, res) {
  res.redirect('/ads/summarize?cid=123');
};

exports.summarize = function(req, res) {
  res.render('ads/summarize', {
    title: 'Reklama',
    campaign: {}
  });
};

exports.confirm = function(req, res) {
  res.render('ads/confirm', {
    title: 'Reklama',
    campaign: {}
  });
};