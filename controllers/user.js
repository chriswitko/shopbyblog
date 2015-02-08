"use strict";

var env = process.env.NODE_ENV || 'development';

var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var passport = require('passport');
var secrets = require('../config/secrets')[env];
var moment = require('moment');

var lwip = require('lwip');
var fs = require('fs');
var jf = require('jsonfile')

var validate = require('validate-vat');

var User = require('../models/User');
var Following = require('../models/Following');
var Vote = require('../models/Vote');
var Product = require('../models/Product');
var Campaign = require('../models/Campaign');

var lb = require('./lb');
var helper = require("../config/helper")

exports.followers = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 6

  async.series({
    findUser: function(done) {
      User.findOne({permalink: req.params.permalink}, function(err, user) {
        locales.user = user;
        done();
      });
    },
    getFollowers: function(done) {
      criteria.followee = locales.user._id;
      criteria.end = undefined;

      Following.paginate(criteria, page, limit, function(err, pages, users, total) {
        if(users) locales.users = _.map(users, function(user) {return user.follower});
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        done(err, users);
      }, {populate: 'follower'})
    }
  }, function(err) {
    var max = helper.rounded(locales.users.length, 3);
    // if(locales.users.length<3) max = 0;
    res.json({
      users: _.shuffle(locales.users).splice(0, max),
      pagination: locales.pagination
    });
  })
};

exports.whotofollow = function(req, res) {
  // console.log('whotofollow')
  var locales = {}
      locales.users_ids = [];
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 6

  async.series({
    findUser: function(done) {
      if(!req.params.permalink) return done();
      User.findOne({permalink: req.params.permalink}, function(err, user) {
        locales.user = user;
        if(locales.user) locales.users_ids.push(locales.user._id);
        done();
      });
    },
    getFollowers: function(done) {
      if(!req.params.permalink) return done();
      criteria.follower = locales.user._id;
      criteria.end = undefined;

      Following.paginate(criteria, page, limit, function(err, pages, users, total) {
        if(users) locales.users_ids = locales.users_ids.concat(_.map(users, function(user) {return user.followee}));
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        done(err, users);
      }, {populate: 'follower'})
    },
    getRandomPageNumber: function(done) {
      criteria = {}
      criteria['meta.upvotes'] = {$gte: 1};
      criteria._id = {$nin: locales.users_ids};

      User.count(criteria, function(err, total) {
        locales.randomPageNumber = Math.floor(Math.random() * (Math.ceil(total/limit) - 1) + 1);
        page = locales.randomPageNumber;
        done();
      })
    },
    getWhoToFollow: function(done) {
      locales.users = [];
      criteria = {}
      criteria['meta.upvotes'] = {$gte: 0};
      criteria.isVerified = true;
      // criteria.isDemo = false;
      // criteria.isRemoved = false;
      criteria._id = {$nin: locales.users_ids};
      // if(req.query.filter=='bloggers') criteria.isVerified = true;

      // console.log(criteria);

      User.paginate(criteria, page, limit, function(err, pages, users, total) {
        locales.users = users||[];
        locales.pagination = {page: page, limit: limit, pages: pages, total: total}
        done(err, users);
      })
    }
  }, function(err) {
    var max = helper.rounded(locales.users.length, 3);
    // if(locales.users.length<3) max = 0;
    res.json({
      users: _.shuffle(locales.users).splice(0, max),
      pagination: locales.pagination
    });
  })
}

exports.verifyVAT = function(req, res) {
  // http://localhost:3005/api/verifyVAT?c=PL&n=5272712119
  // {
  //   "countryCode": "PL",
  //   "vatNumber": "5272712119",
  //   "requestDate": "2014-12-26+01:00",
  //   "valid": true,
  //   "name": "SZOPUJE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  //   "address": "AL. JANA PAWŁA II 27, 00-867 WARSZAWA"
  // }
  if(!req.query.c||!req.query.n) return res.json({status: 'missing params'});
  validate(req.query.c, req.query.n,  function(err, validationInfo) {
    // console.log(Math.max(1, 3))
    if(err) return res.json(err);
    return res.json(validationInfo);
  });
}

exports.claim = function(req, res) {
  var lib = require("../vendor_modules/country-list/nodejs.countryList.js");
  var defaultCountry = 'Poland';
  var cl = lib.countryList(defaultCountry);
  var locales = {};

  async.series({
    findUser: function(done) {
      User.findById(req.user.id, function(err, user) {
        locales.user = user;
        done();
      });
    },
  }, function() {
    if(!locales.user.isVerified&&!locales.user.isPending) {
      res.render('claim', {
        title: 'Dołącz do nas!',
        citiesInHTML: cl
      });
    } else {
      res.redirect('/for-bloggers');
    }
  })
};

exports.claim_post = function(req, res) {
  var locales = {}

  async.series({
    findUser: function(done) {
      User.findById(req.user.id, function(err, user) {
        locales.user = user;
        done();
      });
    },
    saveUser: function(done) {
      if(req.body.website) locales.user.profile.website = lb.repairUrl(req.body.website || '');
      locales.user.profile.name = req.body.name || '';
      locales.user.profile.country = req.body.country || '';

      if(req.body.blogger&&req.body.blogger.feedlyId) locales.user.blogger.feedlyId = req.body.blogger.feedlyId || '';
      if(req.body.blogger&&req.body.blogger.locale) locales.user.blogger.locale = req.body.blogger.locale || '';
      if(req.body.blogger&&req.body.blogger.last12mPageUniqueViews) locales.user.blogger.last12mPageUniqueViews = req.body.blogger.last12mPageUniqueViews || '';
      if(req.body.blogger&&req.body.blogger.last12mPageUniqueUsers) locales.user.blogger.last12mPageUniqueUsers = req.body.blogger.last12mPageUniqueUsers || '';

      if(req.body.links&&req.body.links.twitter) locales.user.links.twitter = lb.repairUrl(req.body.links.twitter || '');
      if(req.body.links&&req.body.links.facebook) locales.user.links.facebook = lb.repairUrl(req.body.links.facebook || '');
      if(req.body.links&&req.body.links.instagram) locales.user.links.instagram = lb.repairUrl(req.body.links.instagram || '');
      if(req.body.links&&req.body.links.youtube) locales.user.links.youtube = lb.repairUrl(req.body.links.youtube || '');

      locales.user.isPending = true;

      locales.user.save(function(err) {
        // if (err) return next(err);
        done();
      });
    },
    sendWelcomeEmail: function(done) {
      lb.sendHtmlEmail({to: 'chris.witko@gmail.com', user: {}, subject: 'Nowy bloger', templateName: 'new-blogger'}, function(output) {
        done();
      });
    }
  }, function() {
    req.flash('success', { msg: 'Formularz został przesłany. Po weryfikacji, skontatujemy się z Tobą w celu uruchomienia profilu blogera.' });
    res.redirect('/for-bloggers');
  })
};


exports.blogs = function(req, res) {
  res.render('blogs', {
    title: 'Blogi'
  });
};

exports.json = function(req, res) {
  var locales = {}

  async.series({
    getUserByPermalink: function(done) {
      User.findOne({permalink: req.params.vanityUrl}, function(err, profile) {
        if(!err&&profile) locales.profile = profile;
        done();
      })
    },
    getAddedProducts: function(done) {
      if(!locales.profile) res.redirect('/');

      var criteria = {};
      locales.products = [];

      if(!locales.profile) return done();
      if(locales.profile) criteria.author = locales.profile._id;
      Product.find(criteria).sort({createdAt: -1}).exec(function(err, products) {
        if(products) locales.products = locales.products.concat(_.map(products, function(product) {return {product: {title: product.title, imageFileName: product.imageFileName, permalink: product.permalink, id: product._id, createdAt: product.createdAt, votes: product.meta.votes}}}));
        done()
      })
    },
    saveFile: function(done) {
      var output = {
        profile: {id: locales.profile._id, permalink: locales.profile.permalink, username: locales.profile.username, followers: locales.profile.meta.followers},
        products: locales.products
      }
      var file = './public/js/widget/data/u_' + locales.profile._id + '.json'

      jf.writeFile(file, output, function(err) {
        done();
      })
    }
  }, function() {
    res.json({
      status: 'success'
    });
  })
};

exports.allJsons = function(req, res) {
  var locales = {}

  async.series({
    getUserByPermalink: function(done) {
      User.find({pleaseRefreshJson: true}, function(err, profiles) {
        if(!err&&profiles) locales.profiles = profiles;
        done();
      })
    },
    generateFiles: function(done) {
      async.forEachSeries(locales.profiles, function(profile, cb) {
        lb.refreshJsonFile(profile, function() {
          cb();
        })
      }, function() {
        done();
      });
    }
  }, function() {
    res.json({
      status: 'success'
    });
  })
};

exports.profile = function(req, res) {
  var locales = {}

  async.series({
    getUserByPermalink: function(done) {
      if(req.params.vanityUrl) {
        User.findOne({permalink: req.params.vanityUrl}, function(err, profile) {
          if(!err&&profile) locales.profile = profile;
          if(!locales.profile||!locales.profile.isVerified) return res.redirect('/');
          done();
        })
      } else {
        if(!req.user) return res.redirect('/');
        User.findOne({_id: req.user._id}, function(err, profile) {
          if(!err&&profile) locales.profile = profile;
          done();
        })
      }
    },
    findFollowing: function(done) {
      if(req.user&&locales.profile) {
        Following.findOne({followee: locales.profile.id, follower: req.user.id}, function(err, following) {
          if(following&&!following.end) locales.profile.isFollowing = true;
          else locales.profile.isFollowing = false;
          done();
        });
      } else {
        done();
      }
    },
    // getUserById: function(done) {
    //   if(!locales.profile) {
    //     User.findOne({_id: req.params.vanityUrl}, function(err, profile) {
    //       if(!err&&profile) locales.profile = profile;
    //       done();
    //     })
    //   } else {
    //     done()
    //   }
    // }
  }, function() {
    if(!locales.profile) {
      res.redirect('/');
    } else {
      if((req.user&&req.user._id.toString()==locales.profile._id.toString())||locales.profile.isVerified) {
        if(locales.profile.isGhost) req.flash('errors', { msg: 'UWAGA! To jest profil testowy.' });
        res.render('account/index', {
          title: locales.profile.getName(), //
          profile: locales.profile,
          og: locales.profile.getOpenGraph(),
          hideSubscriptionBox: true,
          isOwner: req.user&&req.user._id.toString()==locales.profile._id.toString(),
          section: {section: {permalink:(req.user&&req.user._id.toString()==locales.profile._id.toString()?'me':'')}}
        });
      } else {
        res.redirect('/');
      }
    }
  })
};

/**
 * GET /login
 * Login page.
 */

exports.getLogin = function(req, res) {
  if (req.user) return res.redirect('/');
  res.render('account/login', {
    title: 'Logowanie',
    hideNav: true,
    hideSubscriptionBox: true
  });
};

/**
 * POST /login
 * Sign in using email and password.
 * @param email
 * @param password
 */

exports.postLogin = function(req, res, next) {
  req.assert('email', 'Email nie jest poprawny').isEmail();
  req.assert('password', 'Hasło jest wymagane').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/login');
  }

  passport.authenticate('local', function(err, user, info) {
    if (err) return next(err);
    if (!user) {
      req.flash('errors', { msg: info.message });
      return res.redirect('/login');
    }
    req.logIn(user, function(err) {
      if (err) return next(err);
      // res.cookie('sbblang', user.profile.locale||'en');
      // req.flash('success', { msg: 'Gratulacje! Jesteś zalogowany!' });
      res.redirect(req.session.returnTo || '/');
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */

exports.logout = function(req, res) {
  req.logout();
  res.redirect('/');
};

/**
 * GET /signup
 * Signup page.
 */

exports.getSignup = function(req, res) {
  if (req.user) return res.redirect('/');
  res.render('account/signup', {
    title: 'Utwórz profil',
    bg: false,
    hideSubscriptionBox: true
  });
};

/**
 * POST /signup
 * Create a new local account.
 * @param email
 * @param password
 */

exports.postSignup = function(req, res, next) {
  req.assert('email', 'Email nie jest poprawny').isEmail();
  req.assert('password', 'Hasło musi składać się z conajmniej 4 znaków').len(4);
  req.assert('confirmPassword', 'Hasła nie pasują do siebie').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/signup');
  }

  var user = new User({
    email: req.body.email,
    password: req.body.password,
    profile: {
      locale: req.getLocale()
    }
  });

  async.series({
    countUsers: function(done) {
      User.count({}, function(err, total) {
        // Setting up first user as ADMIN
        if(!total) {
          user.role = 3;
        }
        done();
      })
    },
    saveUser: function(done) {
      User.findOne({ email: req.body.email }, function(err, existingUser) {
        if (existingUser) {
          req.flash('errors', { msg: 'Profil z tym adresem email już istnieje.' });
          return res.redirect('/signup');
        }
        user.save(function(err) {
          if (err) return next(err);
          done();
        });
      });
    },
    sendWelcomeEmail: function(done) {
      lb.sendHtmlEmail({to: user.email, user: user, subject: 'Witaj na ShopByBlog', templateName: 'welcome-user'}, function(output) {
        done();
      });
    }
  }, function() {
    req.logIn(user, function(err) {
      if (err) return next(err);
      res.redirect('/');
    });
  })
};

/**
 * GET /account
 * Profile page.
 */

exports.getAccount = function(req, res) {
  var locales = {};

  async.series({
    getPaidCampaigns: function(done) {
      // console.log({'price.isPaid': true, blogger: req.user._id})
      Campaign.find({'price.isPaid': true, blogger: req.user._id})
        .populate({
          path: 'product',
        })
        .sort({isLive:-1, createdAt:-1})
        .exec(function(err, ads) {
          if(ads) locales.ads = _.map(ads, function(ad) {return {ad: ad}});
          done();
        });
    }
  }, function() {
    res.render('account/profile', {
      title: 'Ustawienia',
      campaigns: locales.ads
    });
  })
};

/**
 * POST /account/profile
 * Update profile information.
 */

exports.postUpdateProfile = function(req, res, next) {
  var locales = {}

  async.series({
    findUser: function(done) {
      User.findById(req.user.id, function(err, user) {
        locales.user = user;
        done();
      });
    },
    processBackground: function(done) {
      if(req.body.removeBackground) locales.user.backgroundFileName = '';
      if(!req.files.background) return done()
      lwip.open(req.files.background.path, function(err, image) {
        if (err) throw err;

        var o_height = image.height();
        var o_width = image.width();

        locales.user.backgroundFileName = req.files.background.name;

        image.resize(o_width, o_height, function(err, resized) {
          resized.writeFile('./public/uploads/o_'+locales.user.backgroundFileName, function(err) {
            done();
          })
        })
      });
    },
    uploadBgToS3: function(done) {
      if(!req.files.background) return done()
      lb.uploadToS3('./public/uploads/o_'+locales.user.backgroundFileName, 'bgs', 'o_'+locales.user.backgroundFileName, function() {
        done();
      });
    },
    removeBg: function(done) {
      if(!req.files.background) return done()
      fs.unlink('./public/uploads/o_'+locales.user.backgroundFileName, function() {
        done();
      })
    },
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
        locales.user.imageFileName = locales.filename;
        done();
      });
    },
    imageSizeOriginal: function(done) {
      if(!locales.path) return done();
      locales.image.resize(locales.n_width, locales.n_height, function(err, resized) {
        locales.resized = resized
        // resized.writeFile('./public/uploads/o_'+locales.filename, function(err) {
        done();
        // })
      })
    },
    imageSizeLarge: function(done) {
      if(!locales.path) return done();
      locales.resized.crop(0, 0, locales.n_width, locales.n_height, function(err, cropped) {
        lwip.create(800, 800, {r: 249, g: 249, b: 249, a: 100}, function(err, layer) {
          layer.paste(locales.blank_size_x, locales.blank_size_y, cropped, function(err, layer) {
            locales.large = layer
            // layer.writeFile('./public/uploads/l_'+locales.filename, function(err) {
              done();
            // })
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
    uploadAvatarToS3: function(done) {
      if(!req.files.filename) return done()
      lb.uploadToS3('./public/uploads/s_'+locales.filename, 'avatars', 's_'+locales.filename, function() {
        done();
      });
    },
    removeAvatar: function(done) {
      if(!req.files.background) return done()
      fs.unlink('./public/uploads/s_'+locales.filename, function() {
        done();
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
    saveUser: function(done) {
      locales.user.email = req.body.email || '';
      locales.user.profile.name = req.body.name || '';
      locales.user.profile.gender = req.body.gender || '';
      locales.user.profile.location = req.body.location || '';
      locales.user.profile.country = req.body.country || '';
      if(req.body.website) locales.user.profile.website = lb.repairUrl(req.body.website || '');
      locales.user.profile.about = req.body.about || '';

      if(req.body.links&&req.body.links.twitter) locales.user.links.twitter = lb.repairUrl(req.body.links.twitter || '');
      if(req.body.links&&req.body.links.facebook) locales.user.links.facebook = lb.repairUrl(req.body.links.facebook || '');
      if(req.body.links&&req.body.links.instagram) locales.user.links.instagram = lb.repairUrl(req.body.links.instagram || '');
      if(req.body.links&&req.body.links.youtube) locales.user.links.youtube = lb.repairUrl(req.body.links.youtube || '');

      locales.user.save(function(err) {
        // if (err) return next(err);
        done();
      });
    },
    updateMetasForProductAuthor: function(done) {
      lb.updateCountersForUser(locales.user, function(total) {
        done();
      });
    },
  }, function() {
    req.flash('success', { msg: 'Zmiany zostały zapisane.' });
    res.redirect('/settings');
  })
};

/**
 * POST /account/password
 * Update current password.
 * @param password
 */

exports.postUpdatePassword = function(req, res, next) {
  req.assert('password', 'Hasło musi składać się z conajmniej 4 znaków').len(4);
  req.assert('confirmPassword', 'Hasła nie pasują do siebie').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/settings');
  }

  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    user.password = req.body.password;

    user.save(function(err) {
      if (err) return next(err);
      req.flash('success', { msg: 'Hasło zostało zmienione.' });
      res.redirect('/settings');
    });
  });
};

/**
 * POST /account/delete
 * Delete user account.
 */

exports.postDeleteAccount = function(req, res, next) {
  User.remove({ _id: req.user.id }, function(err) {
    if (err) return next(err);
    req.logout();
    req.flash('info', { msg: 'Profil został usunięty.' });
    res.redirect('/');
  });
};

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 * @param provider
 */

exports.getOauthUnlink = function(req, res, next) {
  var provider = req.params.provider;
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    user[provider] = undefined;
    user.tokens = _.reject(user.tokens, function(token) { return token.kind === provider; });

    user.save(function(err) {
      if (err) return next(err);
      req.flash('info', { msg: provider + ' profil został rozłączony.' });
      res.redirect('/settings');
    });
  });
};

/**
 * GET /reset/:token
 * Reset Password page.
 */

exports.getReset = function(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  User
    .findOne({ resetPasswordToken: req.params.token })
    .where('resetPasswordExpires').gt(Date.now())
    .exec(function(err, user) {
      if (!user) {
        req.flash('errors', { msg: 'Link stracił ważność. Zresetuj hasło ponownie.' });
        return res.redirect('/forgot');
      }
      res.render('account/reset', {
        title: 'Reset hasła',
        hideSubscriptionBox: true
      });
    });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 * @param token
 */

exports.postReset = function(req, res, next) {
  req.assert('password', 'Hasło musi składać się z conajmniej 4 znaków').len(4);
  req.assert('confirm', 'Hasła do siebie nie pasują').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function(done) {
      User
        .findOne({ resetPasswordToken: req.params.token })
        .where('resetPasswordExpires').gt(Date.now())
        .exec(function(err, user) {
          if (!user) {
            req.flash('errors', { msg: 'Link stracił ważność. Zresetuj hasło ponownie.' });
            return res.redirect('back');
          }

          user.password = req.body.password;
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;

          user.save(function(err) {
            if (err) return next(err);
            req.logIn(user, function(err) {
              done(err, user);
            });
          });
        });
    },
    function(user, done) {
      var transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: secrets.sendgrid.user,
          pass: secrets.sendgrid.password
        }
      });
      var mailOptions = {
        to: user.email,
        from: secrets.gaEmail,
        subject: 'Twoje hasło zostało zmienione.',
        text: 'Witaj,\n\n' +
          'To jest informacja potwierdzająca, że hasło dla konta ' + user.email + ' zostało zmienione.\n'
      };
      transporter.sendMail(mailOptions, function(err) {
        req.flash('success', { msg: 'Gratulacje! Hasło zostało zmienione.' });
        done(err);
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/');
  });
};

/**
 * GET /forgot
 * Forgot Password page.
 */

exports.getForgot = function(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('account/forgot', {
    title: 'Przypominanie hasła',
    hideSubscriptionBox: true
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 * @param email
 */

exports.postForgot = function(req, res, next) {
  req.assert('email', 'Wprowadź poprawny adres e-mail').isEmail();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function(done) {
      crypto.randomBytes(16, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
        if (!user) {
          req.flash('errors', { msg: 'Nie ma profilu z takim adresem email.' });
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: secrets.sendgrid.user,
          pass: secrets.sendgrid.password
        }
      });
      var mailOptions = {
        to: user.email,
        from: secrets.gaEmail,
        subject: 'Zresetuj hasło do ShopByBlog',
        text: 'Otrzymujesz tego maila ponieważ Ty (lub ktoś inny) zgłosił prośbę o reset hasła do Twojego profilu.\n\n' +
          'Proszę kliknąć na link lub przekleić go do przeglądarki internetowej w celu zmiany hasła:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'Jeżli nie zgłaszałeś prośby o zmianę hasła, zignoruj tego maila, hasło nie zostanie zmienione.\n'
      };
      transporter.sendMail(mailOptions, function(err) {
        req.flash('info', { msg: 'Email z instrukcjami został wysłany na adres ' + user.email });
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
};


exports.unverified = function(req, res) {
  res.render('account/unverified', {
    title: 'Dołącz do nas'
  });
};

exports.follow = function(req, res) {
  var locales = {}

  lb.followUser(req.query.followee, req.query.follower||req.user, function(output) {
    res.json({
      code: 200,
      status: 'success',
      following: true
    })
  })

  // async.series({
  //   findFollowing: function(done) {
  //     Following.findOne({followee: req.query.followee, follower: req.query.follower}, function(err, following) {
  //       locales.following = following||new Following();
  //       done();
  //     });
  //   },
  //   updateFollowing: function(done) {
  //     locales.following.followee =  req.query.followee;
  //     locales.following.follower =  req.query.follower;
  //     locales.following.end = undefined;

  //     if(!locales.following.start) locales.following.start = new Date();
  //     locales.following.last = new Date();

  //     locales.following.save(function() {
  //       done();
  //     });
  //   },
  //   getFollowee: function(done) {
  //     User.findOne({_id: req.query.followee}, function(err, followee) {
  //       locales.followee = followee
  //       done();
  //     })
  //   },
  //   updateCountersForFollowee: function(done) {
  //     lb.updateCountersForUser(locales.followee, function() {
  //       done();
  //     })
  //   },
  //   getFollower: function(done) {
  //     User.findOne({_id: req.query.follower}, function(err, follower) {
  //       locales.follower = follower
  //       done();
  //     })
  //   },
  //   updateCountersForFollower: function(done) {
  //     lb.updateCountersForUser(locales.follower, function() {
  //       done();
  //     })
  //   }
  // }, function() {
  //   res.json({
  //     code: 200,
  //     status: 'success',
  //     following: true
  //   })
  // })
}

exports.unfollow = function(req, res) {
  var locales = {}

  async.series({
    findFollowing: function(done) {
      Following.findOne({followee: req.query.followee, follower: req.query.follower}, function(err, following) {
        locales.following = following||new Following();
        done();
      });
    },
    updateFollowing: function(done) {
      locales.following.followee =  req.query.followee;
      locales.following.follower =  req.query.follower;
      locales.following.end = new Date();

      if(!locales.following.start) locales.following.start = new Date();
      locales.following.last = new Date();

      locales.following.save(function() {
        done();
      });
    },
    getFollowee: function(done) {
      User.findOne({_id: req.query.followee}, function(err, followee) {
        locales.followee = followee
        done();
      })
    },
    updateCountersForFollowee: function(done) {
      lb.updateCountersForUser(locales.followee, function() {
        done();
      })
    },
    getFollower: function(done) {
      User.findOne({_id: req.query.follower}, function(err, follower) {
        locales.follower = follower
        done();
      })
    },
    updateCountersForFollower: function(done) {
      lb.updateCountersForUser(locales.follower, function() {
        done();
      })
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      following: false
    })
  })
}

exports.products = function(req, res) {
  var locales = {}
  var criteria = {}
  var page = req.query.page || 1
  var limit = req.query.limit || 50

  locales.products = [];
  locales.products_ids = [];

  async.series({
    getUser: function(done) {
      User.findOne({_id: req.params.permalink}, function(err, user) {
        locales.user = user
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
    // getVotedProducts: function(done) {
    //   Vote.find({follower: locales.user._id, end: null})
    //     .sort({start: -1})
    //     .exec(function(err, votes) {
    //       if(votes) locales.products_ids = locales.products_ids.concat(_.map(votes, function(vote) {return vote.product}));
    //       done();
    //     })
    // },
    getAddedProducts: function(done) {
      if(!locales.user) return done();
      if(locales.user) criteria.author = locales.user._id;
      criteria.isHidden = false;
      Product.find(criteria).sort({createdAt: -1}).exec(function(err, products) {
        if(products) locales.products_ids = locales.products_ids.concat(_.map(products, function(product) {return product._id}));
        done()
      })
    },
    getProducts: function(done) {
      var criteria = {};
      criteria.isHidden = false;
      criteria._id = {$in: locales.products_ids}

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
      }, {populate: ['author','publisher'], sortBy: { createdAt : -1, score: -1 }})
    },
    addPricing: function(done) {
      locales.output = [];
      async.forEachSeries(locales.products, function(product, cb) {
        lb.campaignPrice({lang: 'pl', last12mPageUniqueUsers: product.publisher.blogger.last12mPageUniqueUsers, followers: 0, numberOfActiveAds: 0}, function(output) {
          product.pricing = output[5]
          locales.output.push(product);
          cb();
        });
      }, function() {
        done();
      })
    },
    sortOutput: function(done) {
      locales.products = _.sortBy(locales.output, ['sortIdx', 'score', 'createdAt']).reverse()
      locales.products = _.map(locales.output, function(product) {return {product: product}})
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

exports.business = function(req, res) {
  var locales = {}
  locales.output = {}
  locales.users = []

  async.series({
    findUsersToRefresh: function(done) {
      User.find({pleaseRefreshRevenue: true}, function(err, users) {
        locales.users = _.map(users, function(user) {return user._id});
        done();
      });
    },
    getEstimatedRevenue: function(done) {
      if(!locales.users) return done();

      var criteria = [{'price.isPaid': true}];

      Campaign.aggregate([
        { $match: {$and: criteria } },
        {
          $project: {
            _id: 0,
            'price.bloggerRevenue': 1,
            'price.plnRate': 1,
            'price.euro.totalNetto': 1,
            'price.usd.totalNetto': 1,
            'price.bloggerShare': 1,
            blogger_id: '$blogger',
            total_pln: { $multiply: [ '$price.bloggerRevenue', '$price.plnRate' ]},
            total_euro: { $multiply: [ '$price.euro.totalNetto', '$price.bloggerShare' ]},
            total_usd: { $multiply: [ '$price.usd.totalNetto', '$price.bloggerShare' ]},
          }
        },
        {
          $group: {
            _id: '$blogger_id',
            total_pln: {$sum:'$total_pln'},
            total_euro: {$sum:'$total_euro'},
            total_usd: {$sum:'$total_usd'},
            // total_pln: { $multiply: [ '$price.bloggerRevenue', '$price.plnRate' ]},
            count: { $sum: 1 }
          }
        },
        // {"$group":{
        //     _id: '',
        //     totalRevenueForAllBloggers: {$sum:"$total_usd"}
        //   }
        // },
        { $sort : { start : -1 } }
      ], function(err, output) {
        // console.log(err);
        // var bloggerEstimatedRevenue = _.map(output, function(row) {
          // row.total = parseFloat(row.total.toFixed(2));
          // return row;
        // });
        locales.output.bloggerEstimatedRevenue = output;
        done();
      });
    },
    updateUser: function(done) {
      async.forEachSeries(locales.output.bloggerEstimatedRevenue, function(row, cb) {
        User.update({_id: row._id}, {$set: {'business.totalEstimatedRevenue': row.total_pln.toFixed(2), 'business.euro.totalEstimatedRevenue': row.total_euro.toFixed(2), 'business.usd.totalEstimatedRevenue': row.total_euro.toFixed(2), 'meta.campaigns': row.count}}).exec(function() {
          cb();
        })
      }, function() {
        done();
      })
    }
  }, function() {
    res.json({
      code: 200,
      status: 'success',
      data: locales.output
    })
  })
}