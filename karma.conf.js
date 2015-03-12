// karma.conf.js
module.exports = function(config) {
  config.set({
    basePath: '../..',
    frameworks: ['jasmine', 'mocha'],
    files: [
      'chriswitko/shopbyblog/spec/*.js'
    ],
    proxies: {
    '/web': 'http://localhost:3005',
    '/css/': 'http://localhost:3005/css/',
    '/assets/': 'http://localhost:3005/assets/',
    '/js/': 'http://localhost:3005/js/',
    '/img/': 'http://localhost:3005/img/',
    '/fonts/': 'http://localhost:3005/fonts/',
    '/api/': 'http://localhost:3005/api/'
    },
  });
};