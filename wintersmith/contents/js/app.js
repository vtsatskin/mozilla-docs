$(document).ready(function(){
  $("#toc").tableOfContents(null, {
    startLevel: 2
  });

  $('#toc').ddscrollSpy({
    scrollduration: 0
  });

  var selectedValue = $('.version-browser option[selected]').val();
  $('.version-browser').change(function() {
    var val = $(this).val();
    if(selectedValue != val) {
      window.location = val;
    }
  });
})
