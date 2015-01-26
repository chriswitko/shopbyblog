// https://github.com/dfilatov/jquery-plugins/tree/master/src/jquery.inherit

var SBB = $.inherit(/** @lends A.prototype */{
    __constructor : function() { // constructor
      // console.log('init SBB');
    },

    getUrlVars: function(){
      var vars = [], hash;
      var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
      for(var i = 0; i < hashes.length; i++)
      {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
      }
      return vars;
    },

    getUrlVar: function(name){
      return this.getUrlVars()[name];
    },

    redirect: function(url){
      return window.location = url;
    },

    // getURIParameter("id")  // returns the last id or null if not present
    // getURIParameter("id", true) // returns an array of all ids

    getURIParameter: function(param, asArray) {
      return document.location.search.substring(1).split('&').reduce(function(p,c) {
        var parts = c.split('=', 2).map(function(param) { return decodeURIComponent(param); });
        if(parts.length == 0 || parts[0] != param) return (p instanceof Array) && !asArray ? null : p;
        return asArray ? p.concat(parts.concat(true)[1]) : parts.concat(true)[1];
      }, []);
    },

    initMoment: function() {
      var now = moment();

      $('time').each(function(i, e) {
          var time = moment($(e).attr('datetime'));

          $(e).html('<span>' + time.from(now) + '</span>');
      });
    },

    initFonts: function() {
      $('.grid-txt').each(function(i, e) {
        $(e).fitText(0.6, { minFontSize: '12px', maxFontSize: '21px' });
      })
    },

    initHandlebars: function() {
      Handlebars.registerHelper ("isFullfield", function (block) {
        // console.log('isFullfield', window.isFullfield)
        if(window.isFullfield) return block.fn(this)
        else return block.inverse(this)
      });

      Handlebars.registerHelper ("isLastDate", function (block) {
        // console.log('isLastDate', window.isLastDate)
        if(window.isLastDate) return block.fn(this)
        else return block.inverse(this)
      });

      Handlebars.registerHelper ("displayDay", function (context, block) {
        var locale = moment().locale();
        var __YESTERDAY = [];
            __YESTERDAY['pl'] = 'WCZORAJ';
            __YESTERDAY['en'] = 'YESTERDAY';
        var __TODAY = [];
            __TODAY['pl'] = 'DZISIAJ';
            __TODAY['en'] = 'TODAY';
        var __DAYFORMAT = [];
            __DAYFORMAT['pl'] = 'D MMMM';
            __DAYFORMAT['en'] = 'MMMM Do';

        var result = '';
        if(moment(new Date(context)).format('YYYYMMDD')==moment().format('YYYYMMDD')) {
          result = '<h3 class="day mt0">' + (__TODAY[locale]?__TODAY[locale]:__TODAY['en']) + '<small>' + moment(new Date(context)).format((__DAYFORMAT[locale]?__DAYFORMAT[locale]:__DAYFORMAT['en'])) + '</small></h3>';
        } else {
          if(moment(new Date(context)).format('YYYYMMDD')==moment().subtract(1, 'day').format('YYYYMMDD')) {
            result = '<h3 class="day mt0">' + (__YESTERDAY[locale]?__YESTERDAY[locale]:__YESTERDAY['en']) + '<small>' + moment(new Date(context)).format((__DAYFORMAT[locale]?__DAYFORMAT[locale]:__DAYFORMAT['en'])) + '</small></h3>';
          } else {
            result = '<h3 class="day mt0">' + moment(new Date(context)).format('dddd').toUpperCase() + '<small>' + moment(new Date(context)).format((__DAYFORMAT[locale]?__DAYFORMAT[locale]:__DAYFORMAT['en'])) + '</small></h3>';
          }
        }
        return new Handlebars.SafeString(result);
      })

      Handlebars.registerHelper ("lastDate", function (context, block) {
        var difference = true; //NEW
        var day = moment(new Date(context)).format('YYYYMMDD');
        if (window.lastDay != day) {
          difference = true ; //NEW
        } else {
          difference = false;//OLD
        }
        window.lastDay = day

        window.isLastDate = difference;
        window.isFullfield = true;
        if(difference) {
          return block.fn(this);
        }
      });

      Handlebars.registerHelper('dateFormat', function(context, block) {
        if (window.moment && context && moment(context).isValid()) {
          var f = block.hash.format || "MMM Do, YYYY";
          return moment(new Date(context)).format(f);
        } else {
          return context;
        };
      });

      if($("#temp-product")) Handlebars.registerPartial("product", $("#temp-product").html());
      if($("#temp-search")) Handlebars.registerPartial("search", $("#temp-search").html());

    },

    initResizeGrid: function(initId) {
      SBB.initFonts();
      // console.log('init', 'initResizeGrid: ' + (initId?initId:'default'));
      $(window).resize(function(){
        $('.grid-products').find('.grid-image').each(function(index) {
          $(this).css({'height': (($(this).closest('.grid-element').width()))+'px'});
        });
        $('.grid-sections').find('.grid-image').each(function(index) {
          $(this).css({'height': (($(this).closest('.grid-element').width()))+'px'});

          $(this).find('.grid-overfly-txt').each(function(index) {
            $(this).css({'top': (($(this).parent().height()/2)-($(this).height()/2))+'px'});
          });
        });
      }).trigger('resize')
    },

    initBootstrap: function() {
      $('[rel="tooltip"]').tooltip();
      $('[rel="popover"]').popover({html: true});
      $('.switch-tabs').stickyTabs();
      $('body').on('click', function (e) {
        $('[rel="popover"]').each(function () {
          if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
            $(this).popover('hide');
          }
        });
      });
    },

    initLinkBind: function() {
      $('a.bind').click(function(e){ e.preventDefault(); });
      $('form.bind').submit(function(e){ e.preventDefault(); });
    },

    initActionsBind: function() {
      // observable.on('userFollow', SBBUser.hello);
    },

    initRefreshNotificationsBadge: function() {
      // https://github.com/cowboy/jquery-dotimeout
      $.doTimeout( 'getNotifications', 5000, function(){
        // console.log('updating notifs...');
        return true;
      });
    },

    init: function() {
      this.initMoment();
      this.initHandlebars();
      this.initBootstrap();
      // this.initResizeGrid();
      this.initLinkBind();
      this.initActionsBind();
      // this.initRefreshNotificationsBadge();
    },

    hello : function() {
      alert('hello');
    },

    getStaticProperty : function() {
        return this.__self.staticMember; // access to static
    }
});

var SBBUser = $.inherit(SBB, {
    __constructor : function(property) { // constructor
      // console.log('init SBBUser');
      this.init();
    },

    userFollow : function(el, ctx) {
      if(!ctx.follower_id) {
        SBB.redirect('/login');
        // swal({title: "Please sign in...", text: "You need to sign in to proceed.", type: "error", confirmButtonText: "OK" });
        return;
      }
      var api = new $.RestClient('/api/user/');
          api.add('follow');

      var request = api.follow.read({followee: ctx.followee_id, follower: ctx.follower_id});
      request.done(function (data) {
        ga('sbb.send', 'event', 'Users', 'Follow', 'user_'+ctx.followee_id);
        $('#action-btn-follow-'+ctx.followee_id).addClass('hid');
        $('#action-btn-unfollow-'+ctx.followee_id).removeClass('hid');
      })
    },

    userUnfollow : function(el, ctx) {
      var api = new $.RestClient('/api/user/');
          api.add('unfollow');

      var request = api.unfollow.read({followee: ctx.followee_id, follower: ctx.follower_id});
      request.done(function (data) {
        ga('sbb.send', 'event', 'Users', 'Unfollow', 'user_'+ctx.followee_id);
        $('#action-btn-follow-'+ctx.followee_id).removeClass('hid');
        $('#action-btn-unfollow-'+ctx.followee_id).addClass('hid');
      })
    },

    getProducts : function(options, user_id, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/user/'+user_id+'/');
          api.add('products');

      var request = api.products.read(options);
      request.done(function (data) {
        cb(data);
      })
    },


    initActionsBind: function() {
      observable.on('userFollow', this.userFollow);
      observable.on('userUnfollow', this.userUnfollow);
    },

    init: function() {
      this.initActionsBind();
    }

});

var SBBProduct = $.inherit(SBB, {
    __constructor : function(property) { // constructor
      // console.log('init SBBProduct');
      this.init();
    },

    getList : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('products');

      var request = api.products.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    getDeals : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('deals');

      var request = api.deals.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    getSubscriptions : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('subscriptions');

      var request = api.subscriptions.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    getFavorites : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('favorites');

      var request = api.favorites.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    search: function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/products/');
          api.add('search');

      var request = api.search.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    init: function() {
    },

    searchBusiness: function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/products/');
          api.add('business');

      var request = api.business.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    init: function() {
    }
});

var SBBSection = $.inherit(SBB, {
    __constructor : function(property) { // constructor
      // console.log('init SBBSection');
      this.init();
    },

    sectionFollow : function(el, ctx) {
      if(!ctx.follower_id) {
        SBB.redirect('/login');
        // swal({title: "Please sign in...", text: "You need to sign in to proceed.", type: "error", confirmButtonText: "OK" });
        return;
      }
      var api = new $.RestClient('/api/section/');
          api.add('follow');

      var request = api.follow.read({section: ctx.section_id, follower: ctx.follower_id});
      request.done(function (data) {
        $('#action-btn-follow-'+ctx.section_id).addClass('hid');
        $('#action-btn-unfollow-'+ctx.section_id).removeClass('hid');
      })
    },

    sectionUnfollow : function(el, ctx) {
      var api = new $.RestClient('/api/section/');
          api.add('unfollow');

      var request = api.unfollow.read({section: ctx.section_id, follower: ctx.follower_id});
      request.done(function (data) {
        $('#action-btn-follow-'+ctx.section_id).removeClass('hid');
        $('#action-btn-unfollow-'+ctx.section_id).addClass('hid');
      })
    },

    getList : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('sections');

      var request = api.sections.read({});
      request.done(function (data) {
        cb(data);
      })
    },

    initActionsBind: function() {
      observable.on('sectionFollow', this.sectionFollow);
      observable.on('sectionUnfollow', this.sectionUnfollow);
    },

    init: function() {
      this.initActionsBind();
    }
});

var SBBCollection = $.inherit(SBB, {
    __constructor : function(property) { // constructor
      // console.log('init SBBCollection');
      this.init();
    },

    getList : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('collections');

      var request = api.collections.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    uiGetCollections: function(SBB_SECTION, limit) {
      this.getList({section: SBB_SECTION.id, limit: limit||3}, function(data) {
        var source = $("#grid-item-collection").html();

        var template = Handlebars.compile(source);

        var context = {collections: data.collections};
        var html    = template(context);

        $('#collections-area').html(html);

        if(data.collections.length==0) $('#collections-container').hide();
        else if(limit>3||data.collections.length<3) $('#collection-btn-more').hide();

        SBB.initResizeGrid();
      });
    },

    collectionsMore: function(el, ctx) {
      SBBCollection.uiGetCollections(ctx.SBB_SECTION, 50);
    },

    initActionsBind: function() {
      observable.on('collectionsMore', this.collectionsMore);
    },

    init: function() {
      this.initActionsBind();
    }
});

var SBBComment = $.inherit(SBB, {
    __constructor : function(property) { // constructor
      // console.log('init SBBComment');
      this.init();
    },

    commentAdd : function(el, ctx) {
      if(!ctx.user_id) {
        SBB.redirect('/login');
        // swal({title: "Please sign in...", text: "You need to sign in to proceed.", type: "error", confirmButtonText: "OK" });
        return;
      }
      var api = new $.RestClient('/api/', {stripTrailingSlash: true});
          api.add('comments');

      // console.log({user: ctx.user_id, product: ctx.product_id, body: ctx.body})
      var request = api.comments.create({user: ctx.user_id, product: ctx.product_id, body: ctx.body});
      request.done(function (data) {
        $('#commentBody').val('');
        observable.trigger("commentRefresh", {product_id: ctx.SBB_PRODUCT._id});
      })
    },

    commentRemove : function(el, ctx) {
      var api = new $.RestClient('/api/', {stripTrailingSlash: true});
          api.add('comments');

      var request = api.comments.del({comment_id: ctx.comment_id});
      request.done(function (data) {
        observable.trigger("commentRefresh", {product_id: ctx.product_id});
      })
    },

    getList : function(options, cb) {
      if(!options) options = {};
      var api = new $.RestClient('/api/');
          api.add('comments');

      var request = api.comments.read(options);
      request.done(function (data) {
        cb(data);
      })
    },

    uiGetComments: function(criteria) {
      if(!criteria) criteria = {}
      this.getList(criteria, function(data) {
        var source = $("#temp-comment").html();

        var template = Handlebars.compile(source);

        var context = {comments: data.comments};
        var html    = template(context);

        $('#comments-area').html(html);
        $('#commentsCounter').html(data.paginate.total);
        SBB.initLinkBind();
        SBB.initMoment();
      });
    },

    getComments: function(el, ctx) {
      SBBComment.uiGetComments({product_id: ctx.product_id, limit: 5});
    },

    initActionsBind: function() {
      observable.on('commentAdd', this.commentAdd);
      observable.on('commentRefresh', this.getComments);
      observable.on('commentRemove', this.commentRemove);
    },

    init: function() {
      this.initActionsBind();
    }
});