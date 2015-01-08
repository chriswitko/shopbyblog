// require('express-static-render');

exports.index = function (req, res) {
  var view = req.params.view;
  var template = req.params.template;
  res.render('components/'+template);
};
