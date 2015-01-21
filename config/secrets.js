"use strict";

/**
 * IMPORTANT * IMPORTANT * IMPORTANT * IMPORTANT * IMPORTANT * IMPORTANT *
 *
 * You should never commit this file to a public repository on GitHub!
 * All public code on GitHub can be searched, that means anyone can see your
 * uploaded secrets.js file.
 *
 * I did it for your convenience using "throw away" credentials so that
 * all features could work out of the box.
 *
 * Untrack secrets.js before pushing your code to public GitHub repository:
 *
 * git rm --cached config/secrets.js
 *
 * If you have already commited this file to GitHub with your keys, then
 * refer to https://help.github.com/articles/remove-sensitive-data
*/

module.exports = {
  development: {
    sbbConfig: {
      email_from: 'hello@shopbyblog.com',
      website: 'http://localhost:3005',
      s3Host: 'https://s3.amazonaws.com/shopbyblog',
      s3ImagesHost: 'https://s3.amazonaws.com/shopbyblog.images',
    },

    gaEmail: 'hello@shopbyblog.com',
    gaPassword: 'centauri',

    s3Host: 'https://s3.amazonaws.com/shopbyblog',
    s3ImagesHost: 'https://s3.amazonaws.com/shopbyblog.images',

    db: process.env.MONGODB|| 'mongodb://localhost:27017/shopbyblog',

    sessionSecret: process.env.SESSION_SECRET || 'shopbybloglovesyou',

    mailgun: {
      user: process.env.MAILGUN_USER || 'postmaster@sandbox697fcddc09814c6b83718b9fd5d4e5dc.mailgun.org',
      password: process.env.MAILGUN_PASSWORD || '29eldds1uri6'
    },

    mandrill: {
      user: process.env.MANDRILL_USER || 'hackathonstarterdemo',
      password: process.env.MANDRILL_PASSWORD || 'E1K950_ydLR4mHw12a0ldA'
    },

    sendgrid: {
      user: process.env.SENDGRID_USER || 'shopbyblog',
      password: process.env.SENDGRID_PASSWORD || 'Centauri1125$'
    },

    facebook: {
      clientID: process.env.FACEBOOK_ID || '691486860949955',
      clientSecret: process.env.FACEBOOK_SECRET || 'd7a80670b205d73f69c2f10b9221ee0d',
      callbackURL: '/auth/facebook/callback',
      passReqToCallback: true
    },

    instagram: {
      clientID: process.env.INSTAGRAM_ID || '0d97b7c1a2e14c04b90b5f27bae28df9',
      clientSecret: process.env.INSTAGRAM_SECRET || 'e7d6b3de74a14345ac26e23ccd1ddb1b',
      callbackURL: '/auth/instagram/callback',
      passReqToCallback: true
    },

    twitter: {
      consumerKey: process.env.TWITTER_KEY || 'VC1BJuzu1mnG7FU96FbwimUKX',
      consumerSecret: process.env.TWITTER_SECRET  || 'LQHVtPMb6bO1LT0pi4St8mBEE1DUvEQAYqWMrfadx6Bl6iYaEI',
      callbackURL: '/auth/twitter/callback',
      passReqToCallback: true
    },

    google: {
      clientID: process.env.GOOGLE_ID || '854785131443-444g6445gdt53b3im455dnmf107afq0c.apps.googleusercontent.com',
      clientSecret: process.env.GOOGLE_SECRET || 'V7ia0FDtQIMfIf5BOmtFwx3c',
      callbackURL: '/auth/google/callback',
      passReqToCallback: true
    },

    twilio: {
      sid: process.env.TWILIO_SID || 'AC6f0edc4c47becc6d0a952536fc9a6025',
      token: process.env.TWILIO_TOKEN || 'a67170ff7afa2df3f4c7d97cd240d0f3'
    },

    stripe: {
      apiKey: process.env.STRIPE_KEY || 'sk_test_BQokikJOvBiI2HlWgH4olfQ2'
    },

    tumblr: {
      consumerKey: process.env.TUMBLR_KEY || 'FaXbGf5gkhswzDqSMYI42QCPYoHsu5MIDciAhTyYjehotQpJvM',
      consumerSecret: process.env.TUMBLR_SECRET || 'QpCTs5IMMCsCImwdvFiqyGtIZwowF5o3UXonjPoNp4HVtJAL4o',
      callbackURL: '/auth/tumblr/callback'
    },

    foursquare: {
      clientId: process.env.FOURSQUARE_ID || '2STROLSFBMZLAHG3IBA141EM2HGRF0IRIBB4KXMOGA2EH3JG',
      clientSecret: process.env.FOURSQUARE_SECRET || 'UAABFAWTIHIUFBL0PDC3TDMSXJF2GTGWLD3BES1QHXKAIYQB',
      redirectUrl: process.env.FOURSQUARE_REDIRECT_URL || 'http://localhost:3000/auth/foursquare/callback'
    },
  },

  production: {
    sbbConfig: {
      email_from: 'hello@shopbyblog.com',
      website: 'http://shopbyblog.com',
      s3Host: 'https://s3.amazonaws.com/shopbyblog',
      s3ImagesHost: 'https://s3.amazonaws.com/shopbyblog.images',
    },

    gaEmail: 'hello@shopbyblog.com',
    gaPassword: 'centauri',

    s3Host: 'https://s3.amazonaws.com/shopbyblog',
    s3ImagesHost: 'https://s3.amazonaws.com/shopbyblog.images',

    db: process.env.MONGODB|| 'mongodb://localhost/shopbyblog',

    sessionSecret: process.env.SESSION_SECRET || 'shopbybloglovesyou',

    mailgun: {
      user: process.env.MAILGUN_USER || 'postmaster@sandbox697fcddc09814c6b83718b9fd5d4e5dc.mailgun.org',
      password: process.env.MAILGUN_PASSWORD || '29eldds1uri6'
    },

    mandrill: {
      user: process.env.MANDRILL_USER || 'hackathonstarterdemo',
      password: process.env.MANDRILL_PASSWORD || 'E1K950_ydLR4mHw12a0ldA'
    },

    sendgrid: {
      user: process.env.SENDGRID_USER || 'shopbyblog',
      password: process.env.SENDGRID_PASSWORD || 'Centauri1125$'
    },

    facebook: {
      clientID: process.env.FACEBOOK_ID || '691486010950040',
      clientSecret: process.env.FACEBOOK_SECRET || 'ae7a2d30e6ad83cc31400a21d4b53236',
      callbackURL: '/auth/facebook/callback',
      passReqToCallback: true
    },

    instagram: {
      clientID: process.env.INSTAGRAM_ID || '0d97b7c1a2e14c04b90b5f27bae28df9',
      clientSecret: process.env.INSTAGRAM_SECRET || 'e7d6b3de74a14345ac26e23ccd1ddb1b',
      callbackURL: '/auth/instagram/callback',
      passReqToCallback: true
    },

    twitter: {
      consumerKey: process.env.TWITTER_KEY || 'VC1BJuzu1mnG7FU96FbwimUKX',
      consumerSecret: process.env.TWITTER_SECRET  || 'LQHVtPMb6bO1LT0pi4St8mBEE1DUvEQAYqWMrfadx6Bl6iYaEI',
      callbackURL: '/auth/twitter/callback',
      passReqToCallback: true
    },

    google: {
      clientID: process.env.GOOGLE_ID || '854785131443-444g6445gdt53b3im455dnmf107afq0c.apps.googleusercontent.com',
      clientSecret: process.env.GOOGLE_SECRET || 'V7ia0FDtQIMfIf5BOmtFwx3c',
      callbackURL: '/auth/google/callback',
      passReqToCallback: true
    },

    twilio: {
      sid: process.env.TWILIO_SID || 'AC6f0edc4c47becc6d0a952536fc9a6025',
      token: process.env.TWILIO_TOKEN || 'a67170ff7afa2df3f4c7d97cd240d0f3'
    },

    stripe: {
      apiKey: process.env.STRIPE_KEY || 'sk_test_BQokikJOvBiI2HlWgH4olfQ2'
    },

    tumblr: {
      consumerKey: process.env.TUMBLR_KEY || 'FaXbGf5gkhswzDqSMYI42QCPYoHsu5MIDciAhTyYjehotQpJvM',
      consumerSecret: process.env.TUMBLR_SECRET || 'QpCTs5IMMCsCImwdvFiqyGtIZwowF5o3UXonjPoNp4HVtJAL4o',
      callbackURL: '/auth/tumblr/callback'
    },

    foursquare: {
      clientId: process.env.FOURSQUARE_ID || '2STROLSFBMZLAHG3IBA141EM2HGRF0IRIBB4KXMOGA2EH3JG',
      clientSecret: process.env.FOURSQUARE_SECRET || 'UAABFAWTIHIUFBL0PDC3TDMSXJF2GTGWLD3BES1QHXKAIYQB',
      redirectUrl: process.env.FOURSQUARE_REDIRECT_URL || 'http://localhost:3000/auth/foursquare/callback'
    },
  },
};
