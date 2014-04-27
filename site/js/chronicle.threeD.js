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

      // show the control points as cubes
      showPoints : false,

      // show only the first point per-muscle as a cube
      showFirstPoint : false,
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

    _cross: function(a,b) {
      return [a[1]*b[2] - a[2]*b[1],
              a[2]*b[0] - a[0]*b[2],
              a[0]*b[1] - a[1]*b[0]];
    },

    // create an X mesh object that connects the given points
    // - points is a dictionary of point lists (one per 'row' of points, wraps)
    // -- all points lists must have same number of points
    // - keys is a list that defines the order (the 'columns', does not wrap)
    _pointMesh: function(points,keys) {
      var mesh = new X.object();
      mesh.type = 'TRIANGLES';

      var rows = keys.length;
      var columns = points[keys[0]].length;
      var triangles = (rows-1) * (columns-1) * 2;
      var vertices = triangles * 3;
      var coordinates = vertices * 3;

      mesh.points = new X.triplets(coordinates);
      mesh.normals = new X.triplets(coordinates);

      var row, column;
      for (row = 0; row < rows-1; row++) {
        var rowPoints = points[keys[row]];
        var nextRowPoints = points[keys[row+1]];
        for (column = 0; column < columns; column++) {
          // at each cell, create two triangles
          var nextColumn = column + 1;
          if (nextColumn == columns) {
            nextColumn = 0;
          }
          // clockwise around cell - facet shading for now
          var p0 = rowPoints[column];
          var p1 = rowPoints[nextColumn];
          var p2 = nextRowPoints[nextColumn];
          var p3 = nextRowPoints[column];
          var edge0 = [p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]];
          var edge1 = [p3[0]-p0[0],p3[1]-p0[1],p3[2]-p0[2]];
          var normal = this._cross(edge0,edge1);
          // triangle 0
          mesh.points.add(p0[0], p0[1], p0[2]);
          mesh.normals.add(normal[0], normal[1], normal[2]);
          mesh.points.add(p1[0], p1[1], p1[2]);
          mesh.normals.add(normal[0], normal[1], normal[2]);
          mesh.points.add(p2[0], p2[1], p2[2]);
          mesh.normals.add(normal[0], normal[1], normal[2]);
          // triangle 1
          mesh.points.add(p0[0], p0[1], p0[2]);
          mesh.normals.add(normal[0], normal[1], normal[2]);
          mesh.points.add(p2[0], p2[1], p2[2]);
          mesh.normals.add(normal[0], normal[1], normal[2]);
          mesh.points.add(p3[0], p3[1], p3[2]);
          mesh.normals.add(normal[0], normal[1], normal[2]);

        }
      }
      return (mesh);
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
      threeD._clearResults();

      // BUG: adding these cubes breaks the left mouse button
      // but the other buttons work (pan, zoom but no rotate)
      var controlPointDocuments = $('body').data().controlPointDocuments;
      var seriesGeometry = $('body').data().seriesGeometry;
      $.each(controlPointDocuments, function(index,controlPointDocument) {
        id = controlPointDocument._id;
        var color = [Math.random(), Math.random(), Math.random()];
        var controlPoints = controlPointDocument.instancePoints;
        var patientPoints = chronicleDICOM.scoordsToPatient(seriesGeometry,controlPoints);
        var uids = chronicleDICOM.sortedUIDs(seriesGeometry, Object.keys(patientPoints));
        threeD.meshesByStructure[id] = threeD._pointMesh(patientPoints, uids);
        threeD.meshesByStructure[id].color = color;
        threeD.renderer.add(threeD.meshesByStructure[id]);
        $.each(uids, function(index,uid) {
          var points = controlPointDocument.instancePoints[uid];
          var p = null;
          $.each(points, function(index,point) {
            if (threeD.options.showPoints ||
                 (threeD.options.showFirstPoint && p == null)) {
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

      console.log(threeD.meshesByStructure);

      // re-position the camera to face the muscles
      // TODO: don't hard code this
      threeD.renderer.camera.position = [0, 400, 0];

      /* TODO: expose a toggle button for autospin mode
      threeD.renderer.onRender = function() {
        threeD.renderer.camera.rotate([1,0]);
      };
      */
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
