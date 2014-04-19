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

      // the chronicle key to the series
      // - should be highlighed in list
      seriesUID: null,


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

      this.list = $( "<ul>", {
        "id": "listview",
        "data-role": "listview",
        "data-inset": "true",
        "data-autodividers": "true",
        "data-filter": "true"
      })
      .appendTo( this.element )
      $('#listview').listview();

      this._refresh();
    },

    _clearResults: function() {
      $('li',this.element[0]).remove();
    },

    // called when created, and later when changing options
    _refresh: function() {

      this._trigger('random');

      this.options.seriesUID = chronicleUtil.getURLParameter("seriesUID");

      // clear previous results
      this._clearResults();

      // abort pending requests
      if (this.options.pendingUpdateRequest) { this.options.pendingUpdateRequest.abort(); }

      // update the root view
      // Expecting tuples like this:
      // [
      //  ["Brigham and Womens Hosp 221 15", "0001-01001"],
      //  ["novartis thighs and left arm", "1.3.6.1.4.1.35511635217625025614132.1"],
      //  ["MR", "Band 0 (without tumors)", "1.3.6.1.4.1.35511635217625025614132.1.4.0"],
      //  "1.3.6.1.4.1.35511635217625025614132.1.4.0.3.0"
      // ]
      // which is [[inst,patid],[studydes,studid],[modality,serdesc,serid],instid]

      var root = this;
      pendingUpdateRequest = $.couch.db("chronicle").view("instances/context", {
        reduce : true,
        group_level : 3,
        success: function(data) {
          // add entries for each hit
          $.each(data.rows, function(index,row) {
            var institution = row.key[0][0];
            var institutionElementID = institution.split(' ').join('_'); // replace all
            var institutionQuery = '#'+institutionElementID;
            var patientID = row.key[0][1];
            var patientElementID = institutionElementID+"-"+patientID;
            var patientQuery = "#"+patientElementID;
            var studyDescription = row.key[1][0];
            var modality = row.key[2][0];
            var seriesDescription = row.key[2][1];
            var seriesUID =row.key[2][2];
            var instanceCount = row.value;

            if ($(institutionQuery).length == 0) {
              // add institution entry if needed
              $('#listview').append($(''
                + "<li> <p class='institution' id='"+institutionElementID+"'>" + institution + "</p></li>"
              ));
            }

            if ($(patientQuery).length == 0) {
              // add patient entry if needed
              $(institutionQuery).append($(''
                + "<li> <p class='patient' id='"+patientElementID+"'>" + patientID + "</p></li>"
              ));
            }

            var selectedClass = "";
            if (seriesUID == root.options.seriesUID) {
              selectedClass = " selected";
            }
              
            // add study/series entry
            $(patientQuery).append($(''
                       + "<p class='series" + selectedClass + "'>" + studyDescription + ", " + modality
                         + " " + seriesDescription
                         + " ("+ instanceCount + ") "
                         + "</p>"
              )
              .data({'seriesUID':seriesUID})
              .click(function() {
                chronicleUtil.setURLParameter("seriesUID",$(this).data('seriesUID'))
              })
            )
console.log(selectedClass);

         });
         $('#listview').listview('refresh');
        },
        error: function(status) {
          console.log(status);
        },
      });

      // trigger a callback/event
      this._trigger( "change" );
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
