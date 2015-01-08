$(document).ready(function() {

  observable = new $.observable();

  window.SBB = new SBB();
  // window.SBBUi = new SBBUi();
  window.SBBUser = new SBBUser();
  window.SBBProduct = new SBBProduct();
  window.SBBSection = new SBBSection();
  window.SBBCollection = new SBBCollection();
  window.SBBComment = new SBBComment();

  SBB.init();

});

function grabUrl(url) {
  if(!url) return;

  $('#grab_msg').html('Please wait...');

  var api = new $.RestClient('/api/');

  api.add('grab');

  var request = api.grab.read({url: (url)});
  request.done(function (data) {
    if(data.status=='success') {
      $('#title').val(data.data.title);
      $('#tagline').val(data.data.description);
      if(data.data.image) {
        $('#image_source_url').attr('checked', 'checked');
        $('#image_url').val(data.data.image);
        $('#image_url_preview').css('background-image', 'url('+data.data.image+')');
      }
      $('#grab_msg').html('');
    } else {
      $('#grab_msg').html('Sorry. But we could not find any data to parse.');
    }
  });
}

function switchShow(h, id) {
  $('#'+h+' .clearfix').addClass('hide');
  $('#'+id+'_area .clearfix').removeClass('hide');
}