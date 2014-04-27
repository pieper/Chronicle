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

      this.seriesList = $( "<ul>", { "id": "seriesList", } )
      .appendTo( this.element );

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
          // add tree entries for each hit
          var treeData = [];
          var patientUIDsByInstitution = {};
          var patientIDsByUID = {};
          var scanEntriesByPatientUID = {};
          $.each(data.rows, function(index,row) {
            var institution = row.key[0][0];
            var patientUID = String(row.key[0]);
            var patientID = row.key[0][1];
            var studyDescription = row.key[1][0];
            var modality = row.key[2][0];
            var seriesDescription = row.key[2][1];
            var seriesUID =row.key[2][2];
            var instanceCount = row.value;

            // keep track of all the institutions for the root of the tree
            if (! patientUIDsByInstitution.hasOwnProperty(institution) ) {
              patientUIDsByInstitution[institution] = [];
            }

            // keep track of patients to hook them into institutions
            if (patientUIDsByInstitution[institution].indexOf(patientUID) == -1) {
              patientUIDsByInstitution[institution].push(patientUID);
            }
            patientIDsByUID[patientUID] = patientID;

            // for each scan, create a leaf node tracked by patientUID
            var scanEntry = {};
            scanEntry.id = seriesUID;
            scanEntry.text = "%1 (%2) %3 (%4)"
              .replace("%1", studyDescription)
              .replace("%2", modality)
              .replace("%3", seriesDescription)
              .replace("%4", instanceCount);
            scanEntry.data = seriesUID;
            if (!scanEntriesByPatientUID.hasOwnProperty(patientUID)) {
              scanEntriesByPatientUID[patientUID] = [];
            }
            scanEntriesByPatientUID[patientUID].push(scanEntry);
         });

         // make the nested tree structure
         $.each(Object.keys(patientUIDsByInstitution), function(index,institution) {
           var institutionNode = {};
           institutionNode.text = institution;
           institutionNode.state = {'opened' : true};
           institutionPatients = [];
           $.each(patientUIDsByInstitution[institution], function(index,patientUID) {
             var patientNode = {};
             patientNode.text = patientIDsByUID[patientUID];
             patientNode.children = scanEntriesByPatientUID[patientUID];
             institutionPatients.push(patientNode);
           });
           institutionNode.children = institutionPatients;
           treeData.push(institutionNode);
         });
         var tree = { 'core' : {} };
         tree.core.data = treeData;
         tree.plugins = [ "wholerow", "sort" ];
         $('#scanTree').jstree(tree);

         $('#scanTree').on("changed.jstree", function(e,data) {
            if ( data.node.children.length > 0 ) {
              // selected a muscle, show the slices where it is defined
              $('#scanTree').jstree('toggle_node', data.selected);
            } else {
              chronicleUtil.setURLParameter("seriesUID",data.node.data)
            }
         });

         // trigger a callback/event - updates parent
         root._trigger( "change" );
        },
        error: function(status) {
          console.log(status);
        },
      });
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
