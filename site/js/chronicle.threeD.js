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

  $.widget( "chronicle.threeD", {
    // default options
    options : {
      // the list of structures to display
      structures : [],
    },

    // the constructor
    _create: function() {

      // Set the class and disable click
      this.element
        // add a class for theming
        .addClass( "chronicle-structure" )
        // prevent double click to select text
        .disableSelection();

      var threeD = this;
      $(this.options.structures).bind('change', function(e) {
        threeD._refresh();
      });


      // create and initialize a 3D renderer
      this.renderer = new X.renderer3D();
      this.renderer.container = 'threeDView';
      this.renderer.init();

      // map of X.mesh instances indexed by instanceUID of control points
      this.meshesByStructure = {};

      // list of sphere instances for control points
      this.spheres = []

      // listen for any changes to the structures and update the view
      var threeD = this;
      $('body').on('controlPointChange', function(e) {
        threeD._refresh(threeD);
      });
    },


    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {

      // remove generated elements
      this._clearResults();

      this.element
        .removeClass( "chronicle-threeD" )
        .enableSelection();
    },

    // create a custom X object at the point
    _Xobject: function() {
      var object = new X.object();

      object._points = new X.triplets(2*9);

      object._points.add(0,0,0);
      object._points.add(0,0,100);
      object._points.add(0,100,100);
      object._points.add(100,-100,100);
      object._points.add(100,-100,-100);
      object._points.add(-100,-100,-100);

      object._pointIndices = [];
      object._pointIndices.push(0);
      object._pointIndices.push(1);
      object._pointIndices.push(2);
      object._pointIndices.push(3);
      object._pointIndices.push(4);
      object._pointIndices.push(5);

      object._type = 'TRIANGLES';

      return (object);
    },


    _clearResults: function() {
      // TODO: proper clearing
      $('div',this.element[0]).remove();
      var uids = Object.keys(this.meshesByStructure);
      $.each(uids, function(index,uid) {
        this.renderer.remove(this.meshesByStructure[uid]);
      });
    },

    // called when created, and later when changing options
    _refresh: function(threeD) {

      // clear previous results
      this._clearResults();

      /*
      // TODO: if I add this skull alone, left button rotate works
      var skull = new X.mesh();
      // .. and associate the .vtk file to it
      skull.file = 'http://x.babymri.org/?skull.vtk';
      // .. make it transparent
      skull.opacity = 0.7;
      // .. add the mesh
      threeD.renderer.add(skull);
      */

      var object = threeD._Xobject();
      threeD.renderer.add(object);
      console.log(object);

      // BUG: adding these cubes breaks the left mouse button
      // but the other buttons work (pan, zoom but no rotate)
      var controlPointDocuments = $('body').data().controlPointDocuments;
      var seriesGeometry = $('body').data().seriesGeometry;
      $.each(controlPointDocuments, function(index,controlPointDocument) {
        id = controlPointDocument._id;
        var color = [Math.random(), Math.random(), Math.random()];
        var uids = Object.keys(controlPointDocument.instancePoints);
        $.each(uids, function(index,uid) {
          var points = controlPointDocument.instancePoints[uid];
          var p = null;
          $.each(points, function(index,point) {
            if (p == null) {
              p = chronicleDICOM.scoordToPatient(seriesGeometry, uid, point);
              var controlPoint = new X.cube();
              controlPoint.center = p;
              controlPoint.color = color;
              controlPoint.lengthX = 2;
              controlPoint.lengthY = 2;
              controlPoint.lengthZ = 2;
              threeD.renderer.add(controlPoint);
            }
          });
        });
      });

    
      // re-position the camera to face the muscles
      // TODO: don't hard code this
      threeD.renderer.camera.position = [0, 400, 0];

      var print = true;
      threeD.renderer.onRender = function() {
        threeD.renderer.camera.rotate([1,0]);
        if (print) {
    //console.log(skull);
    print = false;
        }
      };
      threeD.renderer.render();
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
