"use strict";

/**
 * Module dependencies.
 */

var express = require('express');
var cookieParser = require('cookie-parser');
var compress = require('compression');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var csrf = require('lusca').csrf();
var methodOverride = require('method-override');

var _ = require('lodash');
var MongoStore = require('connect-mongo')({ session: session });
var flash = require('express-flash');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var expressValidator = require('express-validator');
var connectAssets = require('connect-assets');
var multer  = require('multer');


var moment = require('moment');
var i18n = require("i18n");

i18n.configure({
  locales:['pl'],//, 'en'
  cookie: 'sbblang',
  directory: __dirname + '/locales'
});

/**
 * Controllers (route handlers).
 */

var homeController = require('./controllers/home');
var userController = require('./controllers/user');
var apiController = require('./controllers/api');
var contactController = require('./controllers/contact');
var collectionController = require('./controllers/collection');
var productController = require('./controllers/product');
var sectionController = require('./controllers/section');
var notificationController = require('./controllers/notification');
var inviteController = require('./controllers/invite');
var analyticsController = require('./controllers/analytics');
var blogController = require('./controllers/blog');
var adsController = require('./controllers/ads');
var dashboardController = require('./controllers/dashboard');
var staticController = require('./controllers/static');
var commentController = require('./controllers/comment');
var notificationController = require('./controllers/notification');
var insightController = require('./controllers/insights');
var widgetController = require('./controllers/widget');
var templateController = require('./controllers/template')

/**
 * API keys and Passport configuration.
 */

var secrets = require('./config/secrets');
var passportConf = require('./config/passport');

/**
 * Create Express server.
 */

var app = express();

/**
 * Connect to MongoDB.
 */

mongoose.connect(secrets.db);
mongoose.connection.on('error', function() {
  console.error('MongoDB Connection Error. Make sure MongoDB is running.');
});

var hour = 3600000;
var day = hour * 24;
var week = day * 7;

/**
 * CSRF whitelist.
 */

var csrfExclude = ['/api/comments', '/payments/paypal/payed'];

/**
 * Express configuration.
 */

// // Add headers
// app.use(function (req, res, next) {

//     // Website you wish to allow to connect
//     res.setHeader('Access-Control-Allow-Origin', '*');

//     // Request methods you wish to allow
//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

//     // Request headers you wish to allow
//     res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

//     // Set to true if you need the website to include cookies in the requests sent
//     // to the API (e.g. in case you use sessions)
//     res.setHeader('Access-Control-Allow-Credentials', true);

//     // Pass to next layer of middleware
//     next();
// });

app.set('port', process.env.PORT || 3005);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('json spaces', 2);

// app.use(enableCORS);

app.use(compress());
app.use(connectAssets({
  paths: [path.join(__dirname, 'public/css'), path.join(__dirname, 'public/js')],
  helperContext: app.locals
}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(multer({ dest: './public/uploads'}));

app.use(expressValidator());
app.use(methodOverride());
app.use(cookieParser());

app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: secrets.sessionSecret,
  store: new MongoStore({
    url: secrets.db,
    auto_reconnect: true
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(function(req, res, next) {
  // CSRF protection.
  if (_.contains(csrfExclude, req.path)) return next();
  csrf(req, res, next);
});
app.use(function(req, res, next) {
  res.locals.imagesUrl = secrets.s3ImagesHost;
  // Make user object available in templates.
  res.locals.user = req.user;
  // res.locals.currentLang = req.getLocale();
  // res.locals.moment = moment;
  next();
});
app.use(function(req, res, next) {
  // Remember original destination before login.
  var path = req.path.split('/')[1];
  if (/auth|login|logout|signup|fonts|css|img|uploads|api|resources|js|favicon/i.test(path)) {
    return next();
  }
  req.session.returnTo = req.path;
  next();
});

app.use(i18n.init);

app.use(function(req, res, next) {
  // moment.locale('en-us');
  // Make user object available in templates.
  // res.locals.user = req.user;
  res.locals.currentLang = req.getLocale();
  res.locals.moment = moment;
  res.locals.sprintf = require('sprintf').sprintf;
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: week }));

app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.end('Error');
    // res.render('error', {
        // message: err.message,
        // error: {}//err
    // });
});

/**
 * Main routes.
 */

app.get('/', homeController.index);

app.get('/template/:template', templateController.index);
app.get('/components/:template', templateController.index);

app.get('/widgets/:variant', widgetController.customize);


app.get('/click', insightController.click);

app.get('/pl', homeController.langPolish);
app.get('/en', homeController.langEnglish);

app.get('/about', homeController.about);

app.get('/claim', userController.claim);
app.post('/claim', userController.claim_post);

app.get('/for-bloggers', staticController.for_bloggers);
app.get('/sell-products', staticController.sell_products);

app.get('/widget-demo', staticController.widget_demo);


app.get('/unverified', userController.unverified);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/settings', passportConf.isAuthenticated, userController.getAccount);
app.post('/settings/profile', passportConf.isAuthenticated, userController.postUpdateProfile);
app.post('/settings/password', passportConf.isAuthenticated, userController.postUpdatePassword);
app.post('/settings/delete', passportConf.isAuthenticated, userController.postDeleteAccount);
app.get('/settings/unlink/:provider', passportConf.isAuthenticated, userController.getOauthUnlink);

app.delete('/api/comments', commentController.delete);
app.post('/api/comments', commentController.postCreate);
app.get('/api/comments', commentController.list);


app.get('/s', sectionController.index);
app.get('/for-him', sectionController.index);
app.get('/for-her', sectionController.index);
app.get('/home-and-design', sectionController.index);
app.get('/deals', sectionController.deals);
app.get('/api/sections', sectionController.list);

app.get('/p', productController.index);
app.get('/product/:permalink', productController.index);
app.get('/product/:permalink/vote', productController.vote);
app.get('/product/:permalink/unvote', productController.unvote);
app.get('/product/:permalink/setScore', productController.setScore);

app.get('/search', sectionController.search);

app.get('/api/notifications', notificationController.list);

app.get('/api/products', productController.list);
app.get('/api/products/search', productController.search);
app.get('/api/products/search_beta', productController.search_beta);
app.get('/api/collections', collectionController.list);
app.get('/api/deals', productController.deals);

app.get('/add', passportConf.isAuthenticated, passportConf.isVerified, productController.add);
app.post('/add', passportConf.isAuthenticated, passportConf.isVerified, productController.post_add);
app.get('/product/:permalink/edit', passportConf.isAuthenticated, passportConf.isVerified, productController.edit);

app.get('/collection/add', passportConf.isAuthenticated, passportConf.isAdmin, collectionController.add);
app.post('/collection/add', passportConf.isAuthenticated, passportConf.isAdmin, collectionController.post_add);
app.get('/collection/:permalink', collectionController.index);
app.get('/collection/:permalink/edit', passportConf.isAuthenticated, passportConf.isAdmin, collectionController.edit);

app.get('/api/verifyVAT', userController.verifyVAT);
app.get('/api/user/follow', userController.follow);
app.get('/api/user/unfollow', userController.unfollow);
app.get('/api/user/:permalink/products', userController.products);
app.get('/api/user/:permalink/followers', userController.followers);
app.get('/api/user/business', userController.business);
app.get('/api/user/:permalink/whotofollow', userController.whotofollow);
app.get('/api/whotofollow', userController.whotofollow);

app.get('/api/section/follow', sectionController.follow);
app.get('/api/section/unfollow', sectionController.unfollow);

app.get('/u', userController.profile);
app.get('/c', collectionController.index);
app.get('/bloggers', userController.blogs);

app.get('/api/grab', productController.grab);
app.get('/api/blog/search', blogController.search);

app.get('/notifications', notificationController.index);

app.get('/invites', inviteController.index);

app.get('/analytics', passportConf.isAuthenticated, passportConf.isVerified, analyticsController.index);

app.get('/api/calc/euro', adsController.euro);
app.get('/api/calc/price', adsController.campaignPrice);

app.get('/ads/create', passportConf.isAuthenticated, adsController.create);
app.post('/ads/create', passportConf.isAuthenticated, adsController.update);
app.get('/ads/payed', adsController.payed);
app.post('/ads/payed', adsController.payed);
app.get('/payments/paypal/payed', adsController.paypalPayed);
app.post('/payments/paypal/payed', adsController.paypalPayed);
app.get('/payments/paypal/cancel', adsController.paypalCancel);

app.get('/ads/edit', passportConf.isAuthenticated, adsController.update);
app.post('/ads/edit', passportConf.isAuthenticated, adsController.update_edit);
app.get('/ads/payment', passportConf.isAuthenticated, adsController.payment);

app.get('/ads/calculate', passportConf.isAuthenticated, adsController.update_calculate);
app.post('/ads/calculate', passportConf.isAuthenticated, adsController.update_calculate);

// app.get('/ads/create/click', adsController.create_click);
app.get('/ads/recalculate', passportConf.isAuthenticated, adsController.recalculate);
app.get('/ads/summarize', passportConf.isAuthenticated, adsController.summarize);
app.get('/ads/confirm', passportConf.isAuthenticated, adsController.confirm);
// app.get('/ads/pay', passportConf.isAuthenticated, adsController.summarize);

app.get('/dashboard', passportConf.isAuthenticated, passportConf.isAdmin, dashboardController.index);
app.get('/dashboard/sections', passportConf.isAuthenticated, passportConf.isAdmin, dashboardController.sectionsIndex);
app.get('/dashboard/products', passportConf.isAuthenticated, passportConf.isAdmin, dashboardController.productsIndex);
app.get('/dashboard/campaigns', passportConf.isAuthenticated, passportConf.isAdmin, dashboardController.campaignsIndex);

app.get('/dashboard/users', dashboardController.usersIndex);
app.get('/dashboard/users/edit/:profile_id', dashboardController.usersRead);
app.post('/dashboard/users/edit/:profile_id', dashboardController.usersUpdate);

app.get('/dashboard/products/action/:product_id/sendToS3', dashboardController.productsActionUploadToS3);

app.get('/:vanityUrl', userController.profile);
app.get('/:vanityUrl/publicJson', userController.json);
app.get('/api/allJsons', userController.allJsons);


app.get('/api/s3test', productController.simpleUploadToS3);

/**
 * API examples routes.
 */

app.get('/api', apiController.getApi);
app.get('/api/lastfm', apiController.getLastfm);
app.get('/api/nyt', apiController.getNewYorkTimes);
app.get('/api/aviary', apiController.getAviary);
app.get('/api/steam', apiController.getSteam);
app.get('/api/stripe', apiController.getStripe);
app.post('/api/stripe', apiController.postStripe);
app.get('/api/scraping', apiController.getScraping);
app.get('/api/twilio', apiController.getTwilio);
app.post('/api/twilio', apiController.postTwilio);
app.get('/api/clockwork', apiController.getClockwork);
app.post('/api/clockwork', apiController.postClockwork);
app.get('/api/foursquare', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getFoursquare);
app.get('/api/tumblr', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getTumblr);
app.get('/api/facebook', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getFacebook);
app.get('/api/github', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getGithub);
app.get('/api/twitter', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getTwitter);
app.post('/api/twitter', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.postTwitter);
app.get('/api/venmo', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getVenmo);
app.post('/api/venmo', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.postVenmo);
app.get('/api/linkedin', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getLinkedin);
app.get('/api/instagram', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getInstagram);
app.get('/api/yahoo', apiController.getYahoo);

/**
 * OAuth sign-in routes.
 */

app.get('/auth/instagram', passport.authenticate('instagram'));
app.get('/auth/instagram/callback', passport.authenticate('instagram', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes for API examples.
 */

app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/foursquare');
});
app.get('/auth/tumblr', passport.authorize('tumblr'));
app.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/tumblr');
});
app.get('/auth/venmo', passport.authorize('venmo', { scope: 'make_payments access_profile access_balance access_email access_phone' }));
app.get('/auth/venmo/callback', passport.authorize('venmo', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/venmo');
});

/**
 * 500 Error Handler.
 */

if (process.env.NODE_ENV === 'development') {
  // only use in development
  app.use(errorhandler())
}

/**
 * Start Express server.
 */

app.listen(app.get('port'), function() {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;