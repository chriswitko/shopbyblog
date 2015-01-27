"use strict";

var env = process.env.NODE_ENV || 'development';

var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

var monguurl = require('monguurl');
var timestamps = require("mongoose-times")
var mongoosePaginate = require('mongoose-paginate')

var secrets = require('../config/secrets')[env];
var helper = require("../config/helper");

var ROLE_USER = 1, ROLE_MODERATOR = 2, ROLE_ADMIN = 3;
var VARIANT_USER = 1, VARIANT_BLOGGER = 2, VARIANT_STORE = 3;

var schemaOptions = {
  toObject: {
    virtuals: true
  }
  ,toJSON: {
    virtuals: true
  }
};

var userSchema = new mongoose.Schema({
  username: { type: String, lowercase: true },
  permalink: { type: String, index: true },
  email: { type: String, unique: true, lowercase: true },
  password: String,
  website: String,
  role: { type: Number, default: ROLE_USER },
  variant: { type: Number, default: VARIANT_USER },
  imageFileName: String, // s=w:283:h:283, m=w:612:h:612, l=w:800:h:800, o=w:800:h:auto, bg=white
  backgroundFileName: String,
  facebook: String,
  twitter: String,
  google: String,
  github: String,
  instagram: String,
  linkedin: String,
  tokens: Array,

  business: {
    baseCurrency: {type: String, default: 'PLN'},
    baseShare: {type: Number, default: 0.60},
    totalEstimatedRevenue: {type: Number, default: 0.00},
    totalRevenue: {type: Number, default: 0.00},
    totalPaid: {type: Number, default: 0.00},
    euro: {
      totalEstimatedRevenue: {type: Number, default: 0.00},
      totalRevenue: {type: Number, default: 0.00},
      totalPaid: {type: Number, default: 0.00},
    },
    usd: {
      totalEstimatedRevenue: {type: Number, default: 0.00},
      totalRevenue: {type: Number, default: 0.00},
      totalPaid: {type: Number, default: 0.00},
    }
  },

  meta: {
    emailInvitesLeft: { type: Number, default: 5},
    emailInvitesSent: { type: Number, default: 0},
    campaigns: { type: Number, default: 0},
    activeCampaigns: { type: Number, default: 0},
    products: { type: Number, default: 0, index: true},
    upvotes: { type: Number, default: 0, index: true},
    karma: { type: Number, default: 0, index: true},
    comments: { type: Number, default: 0},
    following: { type: Number, default: 0},
    followers: { type: Number, default: 0},
    lastActionAt: Date // last vote action then we calculate number of active users per blogger
  },

  isGhost: { type: Boolean, default: false, index: true },
  isPending: { type: Boolean, default: false, index: true },
  isVerified: { type: Boolean, default: false, index: true },
  isHidden: { type: Boolean, default: false, index: true },
  isRemoved: { type: Boolean, default: false, index: true },

  pleaseRefreshJson: { type: Boolean, default: false, index: true },
  pleaseRefreshRevenue: { type: Boolean, default: false, index: true },
  lastRefreshJsonAt: Date,
  lastRefreshRevenueAt: Date,

  agreedNewsletter: { type: Boolean, default: true, index: true },
  lastNewsletterAt: Date,

  blogger: {
    feedlyId: {type: String, default: ''},
    last12mPageUniqueUsers: {type: Number, default: 0},
    last12mPageUniqueViews: {type: Number, default: 0},
    last12mPageAvgMinOnSite: {type: Number, default: 0},
    section: { type: Number, default: helper.section.SECTION_FORHIM },
    locale: { type: String, default: 'pl' },
    platform: String, // wordpress, tumblr, blogger etc.
    isWidgetActive: {type: Boolean, default: false},
    lastWidgetPingAt: Date
  },

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' },
    about: { type: String, default: '' },
    country: { type: String, default: '' },
    locale: { type: String, default: 'pl' }
  },

  links: {
    rss: String,
    twitter: String,
    instagram: String,
    facebook: String,
    youtube: String
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  lastNotifsReadAt: Date
}, schemaOptions);

userSchema.pre('save', function(next) {
  var user = this;

  if (!user.isModified('email')&&!user.username) return next();

  user.username = user.email.split('@')[0] + (Math.floor(Math.random() * (Math.ceil(9) - 1) + 1)).toString();
  next();

});

/**
 * Hash the password for security.
 * "Pre" is a Mongoose middleware that executes before each user.save() call.
 */

userSchema.pre('save', function(next) {
  var user = this;

  if (!user.isModified('password')) return next();

  bcrypt.genSalt(5, function(err, salt) {
    if (err) return next(err);

    bcrypt.hash(user.password, salt, null, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

/**
 * Validate user's password.
 * Used by Passport-Local Strategy for password validation.
 */

userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

/**
 * Get URL to a user's gravatar.
 * Used in Navbar and Account Management page.
 */

userSchema.virtual('photo').get(function() {
  var size = 200;

  if(this.imageFileName) {
    return secrets.s3ImagesHost + '/avatars/s_' + this.imageFileName;
  }

  if (!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=retro';
  }

  var md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return 'https://gravatar.com/avatar/' + md5 + '?s=' + size + '&d=retro';
});

userSchema.methods.getOpenGraph = function() {
  return {
    title: this.getName(),
    description: this.profile.about,
    url: secrets.sbbConfig.website + '/' + this.permalink,
    image: this.gravatar()
  }
}

userSchema.methods.gravatar = function(size) {
  var size = 200;
  if (!size) size = 200;

  if(this.imageFileName) {
    return secrets.s3ImagesHost + '/avatars/s_' + this.imageFileName;
  }

  if (!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=retro';
  }

  var md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return 'https://gravatar.com/avatar/' + md5 + '?s=' + size + '&d=retro';
};

userSchema.methods.background = function() {
  if(this.backgroundFileName) {
    return secrets.s3ImagesHost + '/bgs/o_' + this.backgroundFileName;
  }

  return '';
};

userSchema.methods.getName = function() {
  return this.profile.name || this.username || this.email || this.id
};

userSchema.methods.getRole = function() {
  if(this.role==1) return 'User';
  else if(this.role==2) return 'Moderator';
  else if(this.role>2) return 'Admin';
};

userSchema.methods.getPermalink = function() {
  if(this.permalink&&this.isVerified) return '/' + this.permalink;
  else return '/me';
};

userSchema.methods.getExternalLink = function() {
  if(this.profile.website) return this.profile.website;
  else return this.getPermalink();
};

userSchema.methods.getCleanLink = function() {
  if(this.profile.website) return this.profile.website.replace(/^(https?|ftp):\/\//, '');
};

// userSchema.plugin(monguurl({source: 'username', target: 'permalink'}));
userSchema.plugin(timestamps, { created: 'createdAt', lastUpdated: 'updatedAt' })
userSchema.plugin(mongoosePaginate)

module.exports = mongoose.model('User', userSchema);
