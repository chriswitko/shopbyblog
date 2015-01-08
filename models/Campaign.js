"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var url = require('url');

var mongoosePaginate = require('mongoose-paginate')

var helper = require("../config/helper")

var campaignSchema = new mongoose.Schema({
  user: {type : Schema.ObjectId, ref : 'User'},
  blogger: {type : Schema.ObjectId, ref : 'User'},
  product: {type : Schema.ObjectId, ref : 'Product'},

  section: Number,
  title: String,
  url: String,

  start: Date,
  end: Date,

  isLive: {type: Boolean, default: false},

  notes: String,

  status: { type: Number, default: helper.campaign_status.CAMPAIGN_WAITING },
  variant: { type: Number, default: helper.campaign_variant.CAMPAIGN_ACTION_CLICK },

  price: {
    bloggerShare: {type: Number, default: 0.00}, // 0.7 default from user baseSahre
    sbbShare: {type: Number, default: 0.00}, // 0.3
    extraShare: {type: Number, default: 0.00}, // 0.3

    plnRate: {type: Number, default: helper.currency_rate.PLN},
    euroRate: {type: Number, default: helper.currency_rate.EUR},
    usdRate: {type: Number, default: helper.currency_rate.USD},

    days: {type: Number, default: 5}, // default from user basePrice
    vat: {type: Number, default: 0.23}, // TODO: Check VAT %

    nettoPrice: {type: Number, default: 0.00}, // (basePrice + extraPrice) +/* vat (if applied)
    totalPrice: {type: Number, default: 0.00},
    totalPriceFormatted: String,

    bloggerRevenue: {type: Number, default: 0.00},
    sbbRevenue: {type: Number, default: 0.00},
    extraRevenue: {type: Number, default: 0.00},

    bloggerPaid: {type: Number, default: 0.00},
    extraPaid: {type: Number, default: 0.00},

    adPaymentMethod: {type: String, default: ''},
    adPaymentService: {type: String, default: ''},

    bloggerPaidMethod: {type: String, default: ''},
    bloggerPaidService: {type: String, default: ''},

    isPaid: {type: Boolean, default: false},
    isInvoiced: {type: Boolean, default: false},
    bloggerIsPaid: {type: Boolean, default: false},
    extraIsPaid: {type: Boolean, default: false},

    adTransactionId: String,
    bloggerTransactionId: String,
    extraTransactionId: String,

    bloggerTransactionAt: {type: Date},
    extraTransactionAt: {type: Date},

    euro: {},
    usd: {}
  },
  invoice: {
    fullname: String,
    address1: String,
    address2: String,
    city: String,
    country: String,
    postcode: String,
    vatNumber: String,
    invoiceCurrencyCode: {type: String, default: helper.currency_code.PLN}, // default: EUR, USD, PLN, based on advertiser residency
    isDigitalAgreed: {type: Boolean, default: true},
    isSent: {type: Boolean, default: false},
    sentAt: {type: Date},
  },
});

campaignSchema.pre('save', function(next) {
  var campaign = this;

  // campaign.price.nettoPrice = Math.ceil(campaign.price.basePrice + campaign.price.extraPrice - ((campaign.price.basePrice + campaign.price.extraPrice)*campaign.price.discount));
  // campaign.price.totalPrice = Math.ceil(campaign.price.nettoPrice * 1.23);

  campaign.price.sbbShare = 1 - campaign.price.bloggerShare;
  campaign.price.bloggerRevenue = Math.ceil(campaign.price.nettoPrice * campaign.price.bloggerShare);
  campaign.price.sbbRevenue = Math.ceil(campaign.price.nettoPrice - campaign.price.bloggerRevenue);

  return next();
});

campaignSchema.methods.getDomainUrl = function() {
  return url.parse(this.url).hostname;
}

campaignSchema.methods.getLeadUrl = function(action, source) {
  action = !action?'click':action;
  source = !source?'web':source;

  return '/click?v=campaign&s=' + source + '&lid=' + this._id;
}

campaignSchema.plugin(mongoosePaginate)

module.exports = mongoose.model('Campaign', campaignSchema);
