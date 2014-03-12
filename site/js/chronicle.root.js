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
  $.widget( "chronicle.root", {
    // default options
    options: {
      red: 255,
      green: 0,
      blue: 0,

      // state variables
      pendingUpdateRequest : null,

      // callbacks
      change: null,
      random: null
    },

    // the constructor
    _create: function() {
      this.element
        // add a class for theming
        .addClass( "chronicle-root" )
        // prevent double click to select text
        .disableSelection();

      this.refresh = $( "<button>", {
        text: "Refresh",
        "class": "chronicle-root-refresh"
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

      // update the root view
      // Expecting tuples like this:
      // [["Brigham and Womens Hosp 221 15", "0001-01001"], ["novartis thighs and left arm", "1.3.6.1.4.1.35511635217625025614132.1"], ["MR", "Band 0 (without tumors)", "1.3.6.1.4.1.35511635217625025614132.1.4.0"], "1.3.6.1.4.1.35511635217625025614132.1.4.0.3.0"]
      // which is [[inst,patid],[studydes,studid],[modality,serdesc,serid],instid]

      pendingUpdateRequest = $.couch.db("chronicle").view("instances/context", {
        success: function(data) {
          // add entries for each hit
          $.each(data.rows, function(index,value) {
            $('#rootView')  // TODO: change this to something with 'this'
            .append($("<div class='seriesDiv'>"
                       + "<p class='patient'>" + value.key[0] + "</p>"
                       + "<p class='study'>" + value.key[1][0] + "</p>"
                       + "<p class='series'>" + value.key[2][0] 
                         + " " + value.key[2][1] + "</p>"
                       + "</div>"))
            .data({'seriesUID':value.key[2][2]}) 
            .click(function(){ chronicleUtil.setURLParameter("seriesUID",$(this).data('seriesUID'))});
          });
        },
        error: function(status) {
          console.log(status);
        },
        reduce : true,
        group_level : 3,
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
        .removeClass( "chronicle-root" )
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
