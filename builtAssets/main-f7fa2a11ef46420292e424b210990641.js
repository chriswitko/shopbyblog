function grabUrl(e){if(e){$("#grab_msg").html("Please wait...");var a=new $.RestClient("/api/");a.add("grab");var t=a.grab.read({url:e});t.done(function(e){"success"==e.status?($("#title").val(e.data.title),$("#tagline").val(e.data.description),e.data.image&&($("#image_source_url").attr("checked","checked"),$("#image_url").val(e.data.image),$("#image_url_preview").css("background-image","url("+e.data.image+")")),$("#grab_msg").html("")):$("#grab_msg").html("Sorry. But we could not find any data to parse.")})}}function switchShow(e,a){$("#"+e+" .clearfix").addClass("hide"),$("#"+a+"_area .clearfix").removeClass("hide")}$(document).ready(function(){observable=new $.observable,window.SBB=new SBB,window.SBBUser=new SBBUser,window.SBBProduct=new SBBProduct,window.SBBSection=new SBBSection,window.SBBCollection=new SBBCollection,window.SBBComment=new SBBComment,SBB.init()});