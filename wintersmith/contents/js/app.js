$(document).ready(function(){
  $("#toc").tableOfContents(null, {
    startLevel: 2
  });

  $('#toc').ddscrollSpy({
    scrollduration: 0
  });

  var selectedValue = $('.version-info-select option[selected]').val();
  $('.version-info-select').change(function() {
    var val = $(this).val();
    if(selectedValue != val) {
      window.location = val;
    }
  });
})
