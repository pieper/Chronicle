//
// A custom jqueryui plugin widget.
// based on: http://jqueryui.com/widget/
//
// This is part of the Chronicle Project.
//
// This is a set of untility functions to keep the
// other code cleaner.
//
// WIP 2014-01-31


chronicleUtil = {

  // parses the url arguments and returns value (if specified)
  // e.g. http://hoot.ba?test=1
  // getURLParameter('test') returns 1
  "getURLParameter" : function(parameter) {
      // from http://www.jquerybyexample.net/2012/06/get-url-parameters-using-jquery.html
      var pageURL = window.location.search.substring(1);
      var urlVariables = pageURL.split('&');
      for (var i = 0; i < urlVariables.length; i++) {
          var parameterName = urlVariables[i].split('=');
          if (parameterName[0] == parameter) {
              return parameterName[1];
          }
      }
  },

  // escape the special characters in an id
  // http://learn.jquery.com/using-jquery-core/faq/how-do-i-select-an-element-by-an-id-that-has-characters-used-in-css-notation/
  "jqID" : function(id) {
      return "#" + id.replace( /(:|\.|\[|\])/g, "\\$1" );
  },

}
