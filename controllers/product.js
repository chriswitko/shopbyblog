"use strict";

var _ = require('lodash');
var async = require('async');
var og = require('open-graph-scraper');
var request = require('request');
var cheerio = require('cheerio');
var util = require('util');
var multer  = require('multer');
var lwip = require('lwip');
var fs = require('fs');
var moment = require('moment');
var clj_fuzzy = require('clj-fuzzy');
var knox = require('knox');

var jf = require('jsonfile')

var helper = require('../config/helper');
var lb = require('./lb');

var Product = require('../models/Product');
var Vote = require('../models/Vote');
var User = require('../models/User');
var Campaign = require('../models/Campaign');
var Following = require('../models/Following');
var ProductSubscription = require('../models/ProductSubscription');

exports.algoliaSearchUpdate = function(req, res) {
  var Algolia = require('algolia-search');
  // search only api: 89b8c88f987fc2b1299bc88f529e5f2e
  var client = new Algolia('DY6CRRRG54', 'aa405ae3231c428007b1b6d2cbdf5280');

  async.series({
    generateJsonFileWithProducts: function(done) {
      Product.find({})
      .populate({
        path: 'publisher',
        select: 'profile.name'
      })
      .select('_id permalink title body imageFileName meta publisher isHidden sticky').exec(function(err, products) {
        if(!products) return done();

        var data = _.map(products, function(product) {
          product = product.toJSON();
          product.objectID = product._id;
          return product;
        });

        var file = './_storage/products.json';

        jf.writeFile(file, data, function(err) {
          done();
        })
      })
    },
    uploadToAlgolia: function(done) {
      var index = client.initIndex('products');
      var fileJSON = require('../_storage/products.json');
      index.addObjects(fileJSON, function(error, content) {
        // if (error) console.error("SEARCH ERROR: %s", content.message);
        done();
      });
    }
  }, function() {
    res.json({
      status: 'success'
    })
  })
}

exports.algoliaSearch = function(req, res) {
  if(!req.query.q) return res.json({status: 'missing q'});

  var Algolia = require('algolia-search');
  var client = new Algolia('DY6CRRRG54', '89b8c88f987fc2b1299bc88f529e5f2e');
  var locales = {};

  async.series({
    searchViaAlgolia: function(done) {
      var index = client.initIndex('products');
      index.search(req.query.q, function(error, content) {
        locales.products = content.hits;
        done();
      });
    }
  }, function() {
    res.json({
      status: 'success',
      products: locales.products
    })
  })
}


exports.simpleUploadToS3 = function(req, res) {
  var s3 = knox.createClient({
      key: 'AKIAIGVSLQ2TDWZXLOJA'
    , secret: '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'
    , bucket: 'shopbyblog.images'
  });

  s3.putFile('./demo/helloworld.html', '/demo/helloworld.html', function(err, output){
    res.json({
      url: output.client._httpMessage.url,
      err: err,
      status: 'success'
    })
  });
}

exports.setScore = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.findOne({permalink: req.params.permalink})
        .populate({
          path: 'author',
          select: '_id username permalink profile email'
        })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    setScore: function(done) {
      if(locales.product) {
        lb.setScore(locales.product, true, function(output) {
          done();
        })
      } else {
        done();
      }
    },
  }, function() {
    res.json({
      status: 'ok',
      score: 0
    });
  })
}

exports.index = function(req, res) {
  if(req.getLocale()=='pl') require('../public/js/lib/locale/pl.js');
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.findOne({permalink: req.params.permalink})
        .populate({
          path: 'author',
          select: '_id username permalink profile email blogger meta picture imageFileName'
        })
        .populate({
          path: 'publisher',
          select: '_id username permalink profile email blogger meta picture imageFileName'
        })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    getVotes: function(done) {
      if(locales.product) {
        Vote.find({product: locales.product._id, end: null})
          .populate({
            path: 'follower',
          })
          .sort({start:-1})
          .exec(function(err, votes) {
            if(votes) locales.votes = _.map(votes, function(vote) {return {user: vote.follower}});
            done();
          });
      } else {
        done();
      }
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
    getAdsToRedirect: function(done) {
      locales.ad = []
      if(!locales.ads) return done();
      locales.ad = _.shuffle(locales.ads).splice(0, 1)
      if(locales.ad.length) return res.redirect('/track/' + locales.ad[0].ad._id + '?intent=true');
      done();
    },
    findFollowing: function(done) {
      if(req.user&&locales.product&&locales.product.author) {
        Following.findOne({followee: locales.product.author.id, follower: req.user.id}, function(err, following) {
          if(following&&!following.end) locales.isFollowing = true;
          else locales.isFollowing = false;
          done();
        });
      } else {
        done();
      }
    },
    findVote: function(done) {
      if(req.user&&locales.product) {
        Vote.findOne({product: locales.product._id, follower: req.user.id, end: null}, function(err, vote) {
          if(vote&&!vote.end) locales.product.isVoted = true;
          else locales.product.isVoted = false;
          done();
        });
      } else {
        locales.product.isVoted = false;
        done();
      }
    },
    calcPricing: function(done) {
      lb.campaignPrice({lang: locales.product.author.blogger.locale, last12mPageUniqueUsers: locales.product.author.blogger.last12mPageUniqueUsers, followers: locales.product.author.meta.followers, numberOfActiveAds: locales.ads.length}, function(output) {
        locales.pricing = output
        done();
      });
    }
  }, function() {
    if(!locales.product) return res.redirect('/')
    res.render('product', {
      title: locales.product.title,
      product: locales.product,
      section: _.where(helper.sections({}), {id: locales.product.section})[0],
      votes: locales.votes,
      ads: locales.ads,
      isPublisher: req.user?((req.user.role>=2)||(locales.product.publisher?locales.product.publisher.toString() == req.user._id.toString():false)):false,
      fromNow: moment(locales.product.createdAt).fromNow(),
      og: locales.product.getOpenGraph(),
      pricing: locales.pricing,
      hideSubscriptionBox: true,
      hideNav: true,
      email: req.cookies.sbb_email||'',
      subscribed: req.query.subscribed,
      isFollowing: locales.isFollowing,
      isOwner: req.user&&req.user._id.toString()==locales.product.author._id.toString()
    });
  })
};

exports.list = function(req, res) {
  var locales = {}

  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 12

  async.series({
    getVotes: function(done) {
      if(!req.user) return done();
      Vote.find({follower: req.user._id, end: null}, function(err, votes) {
        locales.votes = _.map(votes, function(vote) {return vote.product.toString()});
        done();
      })
    },
    getVerifiedUsersOnly: function(done) {
      locales.blogger_ids = [];
      User.find({isVerified: true, isHidden: {$ne: true}}, function(err, bloggers) {
        locales.blogger_ids = _.map(bloggers, function(blogger) {return blogger._id});
        done();
      })
    },
    getProducts: function(done) {
      // criteria.isHidden = false;
      // criteria['meta.upvotes'] = {$gte: 2};
      // criteria.sticky = true;
      // if(req.query.section) criteria.section = req.query.section;
      // if(req.query.tags) criteria.tags = {$in: _.map(req.query.tags.toString().split(','), function(tag) {return tag.trim()})}

      Product.paginate({$or: [{publisher: {$in:locales.blogger_ids}, isHidden: false, $or: [{'meta.upvotes': {$gte: 2}}, {sticky: true}]}, {sticky:true}]}, page, limit, function(err, pages, products, total) {
        locales.products = [];
        if(!products) return done();
        async.forEachSeries(products, function(product, cb) {
          var day = moment(new Date(product.createdAt)).format('YYYYMMDD');
          product = product.toJSON();
          if(day!=locales.lastDay) product.isNewDay = true
          if(req.user) product.isVoted = locales.votes.indexOf(product._id.toString())>-1?true:false;
          else product.isVoted = false;
          locales.lastDay = day
          lb.getActiveAdsByProduct(product, function(ads) {
            product.ads = ads
            locales.products.push({product: product})
            cb();
          })
        }, function() {
          done()
        })
      }, {populate: ['author','publisher'], sortBy: { createdAt : -1, score: -1 }})
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      products: locales.products
    });
  })
};

exports.deals = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 48

  async.series({
    getVotes: function(done) {
      if(!req.user) return done();
      Vote.find({follower: req.user._id, end: null}, function(err, votes) {
        locales.votes = _.map(votes, function(vote) {return vote.product.toString()});
        done();
      })
    },
    getVerifiedUsersOnly: function(done) {
      locales.blogger_ids = [];
      User.find({isVerified: true, isHidden: {$ne: true}}, function(err, bloggers) {
        locales.blogger_ids = _.map(bloggers, function(blogger) {return blogger._id});
        done();
      })
    },
    getDeals: function(done) {
      locales.deals_ids = []
      var nowNow = moment().zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
      Campaign.find({start: {$lte: nowNow}, end: {$gte: nowNow}, 'price.isPaid': true, blogger: {$in: locales.blogger_ids}})
        .sort({createdAt:-1})
        .exec(function(err, deals) {
          if(deals) locales.deals_ids = _.uniq(_.map(deals, function(deal) {return deal.product.toString()}), function(deal) {return deal});
          done()
        });
    },
    getProducts: function(done) {
      if(req.query.section) criteria.section = req.query.section;
      if(req.query.tags) criteria.tags = {$in: _.map(req.query.tags.toString().split(','), function(tag) {return tag.trim()})}
      criteria._id = {$in: locales.deals_ids}

      Product.paginate(criteria, page, limit, function(err, pages, products, total) {
        locales.products = [];
        async.forEachSeries(products, function(product, cb) {
          var day = moment(new Date(product.createdAt)).format('YYYYMMDD');
          product = product.toJSON();
          if(day!=locales.lastDay) product.isNewDay = true
          if(req.user) product.isVoted = locales.votes.indexOf(product._id.toString())>-1?true:false;
          else product.isVoted = false;
          locales.lastDay = day
          lb.getActiveAdsByProduct(product, function(ads) {
            product.ads = ads
            locales.products.push({product: product})
            cb();
          })
        }, function() {
          done()
        })
      }, {populate: 'author', sortBy: { createdAt : -1 }})
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      products: _.shuffle(locales.products)
    });
  })
};

exports.subscriptions = function(req, res) {
  var locales = {};
      locales.users = [];
  var criteria = {};
  var page = req.query.page || 1;
  var limit = req.query.limit || 50;

  async.series({
    getVotes: function(done) {
      if(!req.user) return done();
      Vote.find({follower: req.user._id, end: null}, function(err, votes) {
        locales.votes = _.map(votes, function(vote) {return vote.product.toString()});
        done();
      })
    },
    getDeals: function(done) {
      locales.deals_ids = []
      var nowNow = moment().zone('+01:00').format('ddd MMM DD YYYY HH:mm:ss z');
      Campaign.find({start: {$lte: nowNow}, end: {$gte: nowNow}})
        .sort({createdAt:-1})
        .exec(function(err, deals) {
          if(deals) locales.deals_ids = _.uniq(_.map(deals, function(deal) {return deal.product.toString()}), function(deal) {return deal});
          done()
        });
    },
    getFollowers: function(done) {
      criteria.follower = req.user._id;
      criteria.end = undefined;
      // console.log(criteria)

      Following.paginate(criteria, page, limit, function(err, pages, users, total) {
        if(users) locales.users = _.map(users, function(user) {return user.followee});
        done(err, users);
      })
    },
    getProducts: function(done) {
      Product.paginate({publisher: {$in: locales.users}}, page, limit, function(err, pages, products, total) {
        locales.products = [];
        async.forEachSeries(products, function(product, cb) {
          var day = moment(new Date(product.createdAt)).format('YYYYMMDD');
          product = product.toJSON();
          if(day!=locales.lastDay) product.isNewDay = true
          if(req.user) product.isVoted = locales.votes.indexOf(product._id.toString())>-1?true:false;
          else product.isVoted = false;
          locales.lastDay = day
          lb.getActiveAdsByProduct(product, function(ads) {
            product.ads = ads
            locales.products.push({product: product})
            cb();
          })
        }, function() {
          done()
        })
      }, {populate: 'author', sortBy: { createdAt : -1 }})
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      products: locales.products
    });
  })
};

exports.favorites = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 50

  locales.products = [];
  locales.products_ids = [];

  async.series({
    getUser: function(done) {
      User.findOne({_id: req.user._id}, function(err, user) {
        locales.user = user
        done();
      })
    },
    getVerifiedUsersOnly: function(done) {
      locales.blogger_ids = [];
      User.find({isVerified: true, isHidden: {$ne: true}}, function(err, bloggers) {
        locales.blogger_ids = _.map(bloggers, function(blogger) {return blogger._id});
        done();
      })
    },
    getVotes: function(done) {
      if(!locales.user||!req.user) return done();
      Vote.find({follower: req.user._id, end: null}, function(err, votes) {
        locales.votes = _.map(votes, function(vote) {return vote.product.toString()});
        done();
      })
    },
    getVotedProducts: function(done) {
      Vote.find({follower: locales.user._id, end: null})
        .sort({start: -1})
        .exec(function(err, votes) {
          if(votes) locales.products_ids = locales.products_ids.concat(_.map(votes, function(vote) {return vote.product}));
          done();
        })
    },
    getProducts: function(done) {
      var criteria = {};
      criteria.isHidden = false;
      criteria._id = {$in: locales.products_ids}
      criteria.publisher = {$in: locales.blogger_ids}

      Product.paginate(criteria, page, limit, function(err, pages, products, total) {
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        // if(products) {
          locales.products = [];
          async.forEachSeries(products, function(product, cb) {
            var day = moment(new Date(product.createdAt)).format('YYYYMMDD');
            product = product.toJSON();
            if(day!=locales.lastDay) product.isNewDay = true
            if(req.user) product.isVoted = locales.votes.indexOf(product._id.toString())>-1?true:false;
            else product.isVoted = false;
            locales.lastDay = day
            lb.getActiveAdsByProduct(product, function(ads) {
              product.ads = ads
              if(ads.length) product.sortIdx = 1;
              else product.sortIdx = 0;
              locales.products.push(product)
              cb();
            })
          }, function() {
            done()
          });
      }, {populate: 'author', sortBy: { createdAt : -1, score: -1 }})
    },
    sortOutput: function(done) {
      locales.products = _.sortBy(locales.products, ['sortIdx', 'score', 'createdAt']).reverse()
      locales.products = _.map(locales.products, function(product) {return {product: product}})
      done();
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      pagination: locales.pagination,
      products: locales.products
    });
  })
};

exports.search_beta = function(req, res) {
  var orig = clj_fuzzy.phonetics.soundex(req.query.o);
  var typos = clj_fuzzy.phonetics.soundex(req.query.q);

  res.json({
    text: req.query.q,
    orig: orig,
    typos: typos
  })

}

exports.search = function(req, res) {
  if(!req.query.q) return res.json({products: []});

  var locales = {}
      locales.products = [];

  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 12

  async.series({
    getVotes: function(done) {
      if(!req.user) return done();
      Vote.find({follower: req.user._id, end: null}, function(err, votes) {
        locales.votes = _.map(votes, function(vote) {return vote.product.toString()});
        done();
      })
    },
    getSearch: function(done) {
      if(!req.query.q) return done();
      var Algolia = require('algolia-search');
      var client = new Algolia('DY6CRRRG54', '89b8c88f987fc2b1299bc88f529e5f2e');

      var index = client.initIndex('products');
      index.search(req.query.q, function(error, content) {
        locales.products = _.map(content.hits, function(product) {return product._id});
        done();
      });
    },
    getProducts: function(done) {
      if(!locales.products) return done();

      Product.find({_id: {$in: locales.products}})
        .populate({
          path: 'author',
          select: '_id username permalink profile email'
        })
        .sort({createdAt: -1})
        .exec(function(err, products) {
          if(products) locales.products = _.map(products, function(product) {
            var day =  moment(new Date(product.createdAt)).format('YYYYMMDD');
            product = product.toJSON();
            if(req.user) product.isVoted = locales.votes.indexOf(product._id.toString())>-1?true:false;
            else product.isVoted = false;
            if(day!=locales.lastDay) product.isNewDay = true
            locales.lastDay = day
            return {product: product}
          })
          done()
        })
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      products: locales.products
    });
  })
};

exports.business = function(req, res) {
  var locales = {}
      locales.products = [];

  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 12

  async.series({
    getVotes: function(done) {
      if(!req.user) return done();
      Vote.find({follower: req.user._id, end: null}, function(err, votes) {
        locales.votes = _.map(votes, function(vote) {return vote.product.toString()});
        done();
      })
    },
    getSearch: function(done) {
      // if(!req.query.q) return done();
      var Algolia = require('algolia-search');
      var client = new Algolia('DY6CRRRG54', '89b8c88f987fc2b1299bc88f529e5f2e');

      var index = client.initIndex('products');
      index.search(req.query.q||'', function(error, content) {
        locales.products = _.map(content.hits, function(product) {return product._id});
        done();
      }, {'hitsPerPage': 24});
    },
    getProducts: function(done) {
      // if(!locales.products) return done();

      Product.find({_id: {$in: locales.products}})
        .populate({
          path: 'author',
          select: '_id username permalink profile email imageFileName'
        })
        .populate({
          path: 'publisher',
          select: '_id username permalink profile email blogger imageFileName'
        })
        .sort({createdAt: -1})
        .exec(function(err, products) {
          if(products) locales.products = _.map(products, function(product) {
            var day =  moment(new Date(product.createdAt)).format('YYYYMMDD');
            product = product.toJSON();
            if(req.user) product.isVoted = locales.votes.indexOf(product._id.toString())>-1?true:false;
            else product.isVoted = false;
            if(day!=locales.lastDay) product.isNewDay = true
            locales.lastDay = day
            return {product: product}
          })
          done()
        })
    },
    addPricing: function(done) {
      locales.output = [];
      async.forEachSeries(locales.products, function(product, cb) {
        lb.campaignPrice({lang: 'pl', last12mPageUniqueUsers: product.product.publisher.blogger.last12mPageUniqueUsers, followers: 0, numberOfActiveAds: 0}, function(output) {
          product.product.pricing = output[5]
          locales.output.push({product: product.product});
          cb();
        });
      }, function() {
        done();
      })
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      products: locales.output
    });
  })
};


exports.add = function(req, res) {
  res.render('product/edit', {
    title: 'Dodaj produkt',
    product: new Product()
  });
};

exports.edit = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.findOne({permalink: req.params.permalink})
        // .populate({
          // path: 'author',
          // select: '_id username permalink profile email'
        // })
        .exec(function(err, product) {
          if(product) locales.product = product
          done()
        })
    },
    getAds: function(done) {
      if(!locales.product) return done();
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
  }, function() {
    if(!locales.product) return res.redirect('/')
    if(locales.ads.length) {
      req.flash('errors', { msg: 'Ten produkt posiada aktualnie aktywne kampanie. Edycja będzie możliwa po ich zakończeniu.' });
      res.redirect('/product/'+locales.product.permalink);
    } else {
      res.render('product/edit', {
        title: 'Edytuj produkt',
        product: locales.product
      });
    }
  })
};

exports.remove = function(req, res) {
  var locales = {}

  async.series({
    getProduct: function(done) {
      Product.findOne({permalink: req.params.permalink})
        .populate({
          path: 'publisher',
        })
        .exec(function(err, product) {
          if(!product) return res.redirect('/')
          if(product) locales.product = product
          done()
        })
    },
    getAds: function(done) {
      if(!locales.product) return done();
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
    removeProduct: function(done) {
      if(!locales.ads.length) {
        Product.update({_id: locales.product._id}, {$set: {isHidden: true}}, function() {
          done();
        })
      } else {
        done();
      }
    },
    pleaseRefreshJson: function(done) {
      User.update({_id: locales.product.publisher||locales.product.author}, {$set: {pleaseRefreshJson: true}}).exec(function() {
        done()
      });
    },
    updateMetasForProductAuthor: function(done) {
      lb.updateCountersForUser(locales.product.publisher, function(total) {
        done();
      });
    },
  }, function() {
    if(locales.ads.length) {
      req.flash('errors', { msg: 'Ten produkt posiada aktualnie aktywne kampanie. Zmiany będą możliwe po ich zakończeniu.' });
      res.redirect('/product/'+locales.product.permalink);
    } else {
      req.flash('success', { msg: 'Produkt został usunięty.' });
      res.redirect('/');
    }
  })
};

exports.post_add = function(req, res) {
  // req.assert('postUrl', 'Adres do bloga musi być podany').isURL();
  // req.assert('url', 'Product URL is not valid').isURL();
  req.assert('title', 'Nazwa produkty jest wymagana').notEmpty();
  req.assert('body', 'Krótki opis produktu jest wymagany').notEmpty();
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
    return res.redirect('/add');
  }


  async.series({
    processImage: function(done) {
      if(!req.files.filename) return done()
      lwip.open(req.files.filename.path, function(err, image) {
        if (err) throw err;

        locales.image = image

        var o_height = image.height();
        var o_width = image.width();

        var max_size = 799

        if(o_height>o_width) {
          var n_height = 799;
          var percent = (((n_height * 100)/o_height)/100)
          var n_width =  Math.floor((o_width*percent))-1;
        } else {
          var n_width =  799;
          var percent = (((n_width * 100)/o_width)/100)
          var n_height = Math.floor((o_height*percent))-1;
        }

        locales.n_width = n_width
        locales.n_height = n_height

        var blank_size_x = Math.floor((800 - n_width - 1) / 2);
        if(blank_size_x<0) blank_size_x = 0;
        locales.blank_size_x = blank_size_x

        var blank_size_y = Math.floor((800 - n_height - 1) / 2);
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
        lwip.create(800, 800, {r: 249, g: 249, b: 249, a: 100}, function(err, layer) {
          layer.paste(locales.blank_size_x, locales.blank_size_y, cropped, function(err, layer) {
            locales.large = layer
            layer.writeFile('./public/uploads/l_'+locales.filename, function(err) {
              done();
            })
          })
        })
      })
    },
    imageSizeMedium: function(done) {
      if(!locales.path) return done();
      locales.large.resize(612, 612, function(err, resized) {
        resized.writeFile('./public/uploads/m_'+locales.filename, function(err) {
          done();
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
    loadProduct: function(done) {
      if(!req.body.id) return done();
      Product.findOne({_id: req.body.id})
        .populate({
          path: 'publisher',
        })
        .exec(function(err, product) {
        locales.product = product;
        done();
      })
    },
    uploadToCDN: function(done) {
      lb.uploadProductImagesToCDN(locales.filename?locales.filename:locales.product.imageFileName, function() {
        done();
      })
    },
    removeUpload: function(done) {
      if(!locales.path) return done();
      async.parallel({
        u: function(doneParallel) {
          fs.unlink(locales.path, function() {
            done();
          })
        },
        o: function(doneParallel) {
          fs.unlink('./public/uploads/o_'+locales.filename, function() {
            doneParallel();
          })
        },
        l: function(doneParallel) {
          fs.unlink('./public/uploads/l_'+locales.filename, function() {
            doneParallel();
          })
        },
        m: function(doneParallel) {
          fs.unlink('./public/uploads/m_'+locales.filename, function() {
            doneParallel();
          })
        },
        s: function(doneParallel) {
          fs.unlink('./public/uploads/s_'+locales.filename, function() {
            doneParallel();
          })
        },
      }, function() {
        done();
      })
    },
    saveToDb: function(done) {
      if(!locales.product) locales.product = new Product()
      // TODO: Add related links based on product link & blogger link
      // TODO: Add first voter (author)
      locales.product.postUrl = req.body.postUrl||req.user.profile.website
      // locales.product.url = req.body.url
      locales.product.title = req.body.title

      locales.typos = _.each((req.body.title + ' ' + req.body.body).split(' '), function(typo) {
        locales.product.typos.push(clj_fuzzy.phonetics.soundex(typo))
      })

      locales.product.body = req.body.body
      locales.product.imageFileName = locales.filename?locales.filename:locales.product.imageFileName,
      locales.product.section = req.body.section
      locales.product.status = req.user.role>=2?helper.productStatus.STATUS_APPROVED:helper.productStatus.STATUS_PENDING
      if(locales.product.isNew) {
        locales.product.author = req.user
        locales.product.publisher = req.user
      }
      if(!locales.product.publisher) {
        locales.product.publisher = locales.product.author;
      }
      locales.product.postedAt = req.user.role>=2?new Date():null

      locales.product.tags = req.body.tags

      locales.product.save(function(err, saved) {
        locales.saved = saved
        done();
      })
    },
    setScore: function(done) {
      if(locales.saved) {
        lb.setScore(locales.saved, false, function(output) {
          done();
        })
      } else {
        done();
      }
    },
    pleaseRefreshJson: function(done) {
      User.update({_id: locales.product.publisher||locales.product.author}, {$set: {pleaseRefreshJson: true}}).exec(function() {
        done()
      });
    },
    updateMetasForProductAuthor: function(done) {
      if(locales.product.isNew) {
        lb.updateCountersForUser(req.user, function(total) {
          done();
        });
      } else {
        lb.updateCountersForUser(locales.product.publisher, function(total) {
          done();
        });
      }
    },
  }, function() {
    if(locales.product.isNew) req.flash('success', { msg: 'Produkt został dodany.' });
    else req.flash('success', { msg: 'Zmiany zostały zapisane.' });

    res.redirect('/product/'+locales.saved.permalink)
  })


};


exports.grab = function(req, res) {
  var output = [];
  var title = '';
  var description = '';
  var url = req.query.url;
  var meta = {};

  if(!url) return res.json({code: 200, status: 'error', message: 'No URL given'});

  og({url: url, timeout: 2000}, function(err, meta){
    request({url: url, timeout: 2000}, function (error, response, html) {
      if (!error && response.statusCode == 200) {
        var $ = cheerio.load(html);
        title = $('title').text();
        description = $('meta[name=description]').attr('content');
        $('img').each(function(i, element){
          output.push({url: $(this).attr('src')});
        });
        res.json({code: 200, status: 'success', data: {url: url, title: meta&&meta.data.ogTitle?meta.data.ogTitle:title, description: meta&&meta.data.ogDescription?meta.data.ogDescription:description, image: meta&&meta.ogImage?meta.image.url:''}});
      } else {
        res.json({code: 200, status: 'error'});
      }
    });
  })
};

exports.subscribe = function(req, res) {
  var locales = {}

  req.assert('email', 'Pole Email jest wymagane').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/product/'+req.params.permalink);
  }

  res.cookie('sbb_email', req.body.email);

  async.series({
    findProduct: function(done) {
      Product.findOne({permalink: req.params.permalink})
        .populate({
          path: 'author',
        })
        .populate({
          path: 'publisher',
        })
        .exec(function(err, product) {
          locales.product = product;
          done();
        });
    },
    findSubscrition: function(done) {
      ProductSubscription.findOne({product: locales.product._id, email: req.body.email}, function(err, vote) {
        // if(!vote) locales.isNew = true;
        locales.vote = vote||new ProductSubscription();
        done();
      });
    },
    unVote: function(done) {
      if(locales.vote&&!locales.vote.end) {//&&locales.isNew
        if(!locales.vote.isNew) locales.vote.end = new Date();
      } else {
        locales.vote.end = undefined;
        locales.shouldCreateNotification = true
      }
      done();
    },
    createNotification: function(done) {
      req.flash('success', { msg: 'Powiadomienie o nowej ofercie dla tego produktu zostało ustawione.' });
      done();
      // if(locales.shouldCreateNotification) {
        // var notification = {}
        //     notification.author = req.user;
        //     notification.elementType = 1;
        //     notification.elementObject = locales.product;
        //     notification.verb = 'voted';
        // lb.createNotification(notification, function() {
        //   return done();
        // })
      // } else done()
    },
    updateVote: function(done) {
      locales.vote.product =  locales.product._id;
      locales.vote.email =  req.body.email;

      if(!locales.vote.start||!locales.vote.end) locales.vote.start = new Date();
      locales.vote.last = new Date();

      locales.vote.save(function() {
        done();
      });
    },
    // updateMetasForProduct: function(done) {
    //   lb.updateCountersForProduct(locales.product, function(total) {
    //     locales.totalVotes = total.totalVotes;
    //     locales.totalComments = total.totalComments;
    //     done();
    //   });
    // },
    // updateMetasForUser: function(done) {
    //   lb.updateCountersForUser(req.user, function(total) {
    //     done();
    //   });
    // },
    // updateMetasForProductAuthor: function(done) {
    //   lb.updateCountersForUser(locales.product.author, function(total) {
    //     done();
    //   });
    // },
    // setScore: function(done) {
    //   if(locales.product) {
    //     lb.setScore(locales.product, false, function(output) {
    //       done();
    //     })
    //   } else {
    //     done();
    //   }
    // },
    // autoFollowUser: function(done) {
    //   if(!locales.product.publisher.isVerified||!locales.shouldCreateNotification) return done();
    //   if(req.user&&!locales.product.publisher._id.toString()==req.user._id.toString()) return done();
    //   // console.log('to follow', locales.product.author._id)
    //   lb.followUser(locales.product.author._id, req.user._id, function(output) {
    //     done();
    //   });
    // }
  }, function() {
    res.redirect('/product/'+locales.product.permalink+'?subscribed=1');
  })
}

exports.vote = function(req, res) {
  var locales = {}

  async.series({
    findProduct: function(done) {
      if(!req.user) return done();
      Product.findOne({_id: req.params.permalink})
        .populate({
          path: 'author',
        })
        .populate({
          path: 'publisher',
        })
        .exec(function(err, product) {
          locales.product = product;
          done();
        });
    },
    findVote: function(done) {
      if(!req.user) return done();
      Vote.findOne({product: req.params.permalink, follower: req.user._id}, function(err, vote) {
        // if(!vote) locales.isNew = true;
        locales.vote = vote||new Vote();
        done();
      });
    },
    unVote: function(done) {
      if(!req.user) return done();
      if(locales.vote&&!locales.vote.end) {//&&locales.isNew
        if(!locales.vote.isNew) locales.vote.end = new Date();
      } else {
        locales.vote.end = undefined;
        locales.shouldCreateNotification = true
      }
      done();
    },
    createNotification: function(done) {
      if(locales.shouldCreateNotification) {
        var notification = {}
            notification.author = req.user;
            notification.elementType = 1;
            notification.elementObject = locales.product;
            notification.verb = 'voted';
        lb.createNotification(notification, function() {
          return done();
        })
      } else done()
    },
    updateVote: function(done) {
      if(!req.user) return done();
      locales.vote.product =  req.params.permalink;
      locales.vote.follower =  req.user._id;

      if(!locales.vote.start||!locales.vote.end) locales.vote.start = new Date();
      locales.vote.last = new Date();

      locales.vote.save(function() {
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
    updateMetasForProductAuthor: function(done) {
      lb.updateCountersForUser(locales.product.author, function(total) {
        done();
      });
    },
    setScore: function(done) {
      if(locales.product) {
        lb.setScore(locales.product, false, function(output) {
          done();
        })
      } else {
        done();
      }
    },
    autoFollowUser: function(done) {
      if(!locales.product.publisher.isVerified||!locales.shouldCreateNotification) return done();
      if(req.user&&!locales.product.publisher._id.toString()==req.user._id.toString()) return done();
      // console.log('to follow', locales.product.author._id)
      lb.followUser(locales.product.author._id, req.user._id, function(output) {
        done();
      });
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      meta: {
        upvotes: locales.totalVotes,
        comments: locales.totalComments
      }
    })
  })
}

exports.unvote = function(req, res) {
  var locales = {}

  async.series({
    findProduct: function(done) {
      if(!req.user) return done();
      Product.findOne({_id: req.params.permalink})
        .populate({
          path: 'author',
        })
        .exec(function(err, product) {
          locales.product = product;
          done();
        });
    },
    findFollowing: function(done) {
      if(!req.user) return done();
      Vote.findOne({product: req.params.permalink, follower: req.user._id}, function(err, vote) {
        locales.vote = vote||new Vote();
        done();
      });
    },
    updateFollowing: function(done) {
      if(!req.user) return done();
      locales.vote.product =  req.params.permalink;
      locales.vote.follower =  req.user._id;
      locales.vote.end = new Date();

      if(!locales.vote.start) locales.vote.start = new Date();
      locales.vote.last = new Date();

      locales.vote.save(function() {
        done();
      });
    },
    updateMetasForProductAuthor: function(done) {
      lb.updateCountersForUser(locales.product.author, function(total) {
        done();
      });
    },
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      vote: false
    })
  })
}