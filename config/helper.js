"use strict";

var _ = require('lodash');
var async = require('async');

var _product_status = {};
    _product_status.STATUS_PENDING = 1;
    _product_status.STATUS_APPROVED = 2;
    _product_status.STATUS_REJECTED = 3;

var _collection_status = {};
    _collection_status.STATUS_PENDING = 1;
    _collection_status.STATUS_APPROVED = 2;

var _c_section = {};
    _c_section.SECTION_FORHIM = 1;
    _c_section.SECTION_FORHER = 2;
    _c_section.SECTION_HOMEDESIGN = 3;

var _campaign_variant = {};
    _campaign_variant.CAMPAIGN_ACTION_CLICK = 1;

var _campaign_status = {};
    _campaign_status.CAMPAIGN_WAITING = 1;
    _campaign_status.CAMPAIGN_APPROVED = 2;
    _campaign_status.CAMPAIGN_REJECTED = 3;

var _currency_rate = {};
    _currency_rate.PLN = 1.00;
    _currency_rate.EUR = 4.30;
    _currency_rate.USD = 3.45;

var _currency_code = {};
    _currency_code.PLN = 'PLN';
    _currency_code.EUR = 'EUR';
    _currency_code.USD = 'USD';

var _sbb_sections = [];
    _sbb_sections.push({id: 1, name: 'Men', description: 'Curated products for guys, based on the best bloggers all around the world.',  permalink: 'for-him', coverImg: '/img/wlibis6m7poojanluwfj.jpg', sortIdx: 0});
    _sbb_sections.push({id: 2, name: 'Women', description: 'Curated products for girls, based on the best bloggers all around the world.', permalink: 'for-her', coverImg: 'http://deafpigeon.co.uk/wp-content/uploads/2014/06/modernica-hundreds.jpg', sortIdx: 1});
    _sbb_sections.push({id: 3, name: 'Home & Design', description: 'Curated Home & Design products, based on the best bloggers all around the world.', permalink: 'home-and-design', coverImg: 'http://daily-movement.com/wp-content/uploads/2014/09/Agata-Jenczelewska-daily-sugar-2.jpg', sortIdx: 2});

var _sbb_sections_pl = [];
    _sbb_sections_pl.push({id: 1, name: 'Mężczyzna', description: 'Curated products for guys, based on the best bloggers all around the world.',  permalink: 'for-him', coverImg: '/img/wlibis6m7poojanluwfj.jpg', sortIdx: 0});
    _sbb_sections_pl.push({id: 2, name: 'Kobieta', description: 'Curated products for girls, based on the best bloggers all around the world.', permalink: 'for-her', coverImg: 'http://deafpigeon.co.uk/wp-content/uploads/2014/06/modernica-hundreds.jpg', sortIdx: 1});
    _sbb_sections_pl.push({id: 3, name: 'Home & Design', description: 'Curated Home & Design products, based on the best bloggers all around the world.', permalink: 'home-and-design', coverImg: 'http://daily-movement.com/wp-content/uploads/2014/09/Agata-Jenczelewska-daily-sugar-2.jpg', sortIdx: 2});


exports.sections = function(options) {
  if(options.locale == 'pl') return _sbb_sections_pl;
  return _sbb_sections;
};

exports.rounded = function(n, max) {
  if(!max) max = 3;
  if(n > 0)
    return Math.ceil(n/max) * max;
  else if( n < 0)
    return Math.ceil(n/max) * max;
  else
    return max;
}

exports.rootEmail = 'hello@shopbyblog.com'

exports.collectionStatus = _collection_status;
exports.productStatus = _product_status;
exports.section = _c_section;
exports.campaign_variant = _campaign_variant;
exports.campaign_status = _campaign_status;
exports.currency_rate = _currency_rate;
exports.currency_code = _currency_code;