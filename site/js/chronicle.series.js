//
// A custom jqueryui plugin widget.
// based on: http://jqueryui.com/widget/
//
// This is part of the Chronicle Project.
// It accesses the couchdb database and shows
// various levels of detail.
//
// WIP 2014-01-31


$(function() {
  $.widget( "chronicle.series", {
    // default options
    options: {
      // the chronicle key to the instance that starts the series
      seriesUID: null,

      // state variables
      pendingUpdateRequest : null,

      // callbacks
      change: null,
    },

    // the constructor
    _create: function() {

      this.element
        // add a class for theming
        .addClass( "chronicle-series" )
        // prevent double click to select text
        .disableSelection();

      this.refresh = $( "<button>", {
        text: "Refresh",
        "class": "chronicle-series-refresh"
      })
      .appendTo( this.element )
      .button();

      // bind click events on the refresh button to update view
      this._on( this.refresh, {
        // _on won't call refresh when widget is disabled
        click: "_refresh"
      });

      this._refresh();
    },

    random : function() {
      console.log('trigger random');
      this._trigger('random');
    },

    _clearResults: function() {
      $('p',this.element[0]).remove();
    },

    // called when created, and later when changing options
    _refresh: function() {

      this._trigger('random');

      // clear previous results
      this._clearResults();

      // abort pending requests
      if (this.options.pendingUpdateRequest) { this.options.pendingUpdateRequest.abort(); }

      // update the series view
      pendingUpdateRequest = $.couch.db("chronicle").view("instances/seriesInstances", {
        success: function(data) {
          // add entries for each hit
          $.each(data.rows, function(index,value) {
            var jqSeriesUID = chronicleUtil.jqID(value.key);
            $(jqSeriesUID)
              .append($("<img src='../" + value.value + "/image128.png' />"))
              .append($("<p class='instanceCaption'> key: " + value.key + " value: " + value.value + "<p>"));
          });
        },
        error: function(status) {
          console.log(status);
        },
        reduce : false,
      });

      // trigger a callback/event
      this._trigger( "change" );
      console.log('changed');
    },


    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {
      // remove generated elements
      this.refresh.remove();
      this._clearResults();

      this.element
        .removeClass( "chronicle-series" )
        .enableSelection();
    },

    // _setOptions is called with a hash of all options that are changing
    // always refresh when changing options
    _setOptions: function() {
      // _super and _superApply handle keeping the right this-context
      this._superApply( arguments );
      this._refresh();
    },

    // _setOption is called for each individual option that is changing
    _setOption: function( key, value ) {
      // prevent invalid color values
      if ( /red|green|blue/.test(key) && (value < 0 || value > 255) ) {
        return;
      }
      this._super( key, value );
    }
  });

});
