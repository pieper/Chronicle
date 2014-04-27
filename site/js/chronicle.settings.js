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
  $.widget( "chronicle.settings", {
    // default options
    options: {

      // username of the person doing the editing
      username: null,

      // project for which this is being done
      project: null,

      // callbacks
      change: null,
    },

    // the constructor
    _create: function() {
      this.element
        // add a class for theming
        .addClass( "chronicle-settings" )
        // prevent double click to select text
        .disableSelection();

      this.settingsForm = $(''
        + ' <p>These fields will be recorded in the database when you commit changes to the segmentation structures.'
        + ' <form> '
        + ' <fieldset> '
          + ' <label for="username">Username</label> '
          + ' <input type="text" name="username" id="username" class="text ui-widget-content ui-corner-all"> '
          + ' <label for="project">Project</label> '
          + ' <input type="text" name="project" id="project" value="" class="text ui-widget-content ui-corner-all"> '
        + ' </fieldset> '
        + ' </form> '
        + ' <button id="save-settings">Save</button> '
        )
      .appendTo( this.element );

      $(''
         + ' <div id="dialog-bad-save" title="Fields cannot be empty"></div>'
      ).appendTo( this.element );

      $(''
         + ' <div id="dialog-good-save" title="Settings stored"></div>'
      ).appendTo( this.element );

      var username = localStorage.getItem('username');
      var project = localStorage.getItem('project');
      if (username) {
        $('#username')[0].value = username;
      }
      if (project) {
        $('#project')[0].value = project;
      }
      $('body').data().settings = {
        'username': username,
        'project': project,
      };

      $('#save-settings').button()
      .click(function() {
        var username = $('#username')[0].value || "";
        var project = $('#project')[0].value || "";
        if (username.length > 0 && project.length > 0) {
          localStorage.setItem('username', username);
          localStorage.setItem('project', project);
          $('body').data().settings = {
            'username': username,
            'project': project,
          };
          $( "#dialog-good-save" ).dialog({
            resizable: true,
            height:140,
            modal: true,
            buttons: {
              Ok: function() {
                $( this ).dialog( "close" );
              }
            }
          });
        } else { 
          $( "#dialog-bad-save" ).dialog({
            resizable: true,
            height:140,
            modal: true,
            buttons: {
              Ok: function() {
                $( this ).dialog( "close" );
              }
            }
          });
        }
      });

      this._refresh();
    },

    _clearResults: function() {
      // TODO
    },

    // called when created, and later when changing options
    _refresh: function() {
      // TODO: probably not needed here
    },


    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {
      // TODO
      this.element
        .removeClass( "chronicle-settings" )
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
