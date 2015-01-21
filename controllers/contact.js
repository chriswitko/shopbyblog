"use strict";

var env = process.env.NODE_ENV || 'development';

var secrets = require('../config/secrets')[env];
var nodemailer = require("nodemailer");
var transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: secrets.sendgrid.user,
    pass: secrets.sendgrid.password
  }
});

/**
 * GET /contact
 * Contact form page.
 */

exports.getContact = function(req, res) {
  res.render('contact', {
    title: 'Kontakt',
    hideSubscriptionBox: true
  });
};

/**
 * POST /contact
 * Send a contact form via Nodemailer.
 * @param email
 * @param name
 * @param message
 */

exports.postContact = function(req, res) {
  req.assert('name', 'Imię nie może być puste').notEmpty();
  req.assert('email', 'Email nie jest prawidłowy').isEmail();
  req.assert('message', 'Wpisz wiadomość').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/contact');
  }

  var from = req.body.email;
  var name = req.body.name;
  var body = req.body.message;
  var to = secrets.gaEmail;
  var subject = req.cookies.sbblang + ' | Contact Form | ShopByBlog';

  var mailOptions = {
    to: to,
    from: from,
    subject: subject,
    text: body
  };

  transporter.sendMail(mailOptions, function(err) {
    if (err) {
      req.flash('errors', { msg: err.message });
      return res.redirect('/contact');
    }
    req.flash('success', { msg: 'Email został wysłany!' });
    res.redirect('/contact');
  });
};
