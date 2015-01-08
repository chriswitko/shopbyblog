"use strict";

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
      title: 'Advertise on ShopByBlog',
      campaign: locales.campaign,
      product: locales.product,
      pricing: locales.pricing,
      payNow: 1,
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
          path: 'product',
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
          locales.campaign.price.discount = 0.10;
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
      title: 'Advertise on ShopByBlog',
      campaign: locales.campaign,
      pricing: locales.pricing
    });
  })
};

exports.paypalCancel = function(req, res) {
  res.json(req.body);
}

exports.paypalPayed = function(req, res) {
  console.log('body', req.body);
  res.json(req.body);
}

exports.payed = function(req, res) {
  console.log('body', req.body);

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
          locales.campaign.price.isPaid = true;
          locales.campaign.start = moment().zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
          locales.campaign.end = moment(locales.campaign.start).add(locales.campaign.price.days, 'days').zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
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
    res.render('ads/payed', {
      title: 'Advertise on ShopByBlog',
      campaign: locales.campaign,
      status: locales.campaign.price.isPaid
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
    }
  }, function() {
    res.render('ads/summarize', {
      title: 'Advertise on ShopByBlog',
      campaign: locales.campaign,
      payNow: req.query.pay?true:false,
      product: locales.product,
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
      title: 'Advertise on ShopByBlog',
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
            console.log('ERR', err)
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
    title: 'Advertise on ShopByBlog',
    product_id: req.query.pid,
    variant: 1
  });
};

exports.recalculate = function(req, res) {
  res.redirect('/ads/summarize?cid=123');
};

exports.summarize = function(req, res) {
  res.render('ads/summarize', {
    title: 'Advertise on ShopByBlog',
    campaign: {}
  });
};

exports.confirm = function(req, res) {
  res.render('ads/confirm', {
    title: 'Advertise on ShopByBlog',
    campaign: {}
  });
};