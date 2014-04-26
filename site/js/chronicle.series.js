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
      // the chronicle key to the series
      seriesUID: null,

      // the currently selected imageInstanceUID to display
      imageInstanceUID : null,

      // callbacks
      change: null,
    },


    // the constructor
    _create: function() {

      // dicom classes associated with images we can display
      this.imageClasses = [
                "1.2.840.10008.5.1.4.1.1.1", // CR Image
                "1.2.840.10008.5.1.4.1.1.2", // CT Image
                "1.2.840.10008.5.1.4.1.1.4", // MR Image
                "1.2.840.10008.5.1.4.1.1.6", // US Image
                "1.2.840.10008.5.1.4.1.1.7", // SC Image
                "1.2.840.10008.5.1.4.1.1.7.1", // SC Image - bit
                "1.2.840.10008.5.1.4.1.1.7.2", // SC Image - byte
                "1.2.840.10008.5.1.4.1.1.7.3", // SC Image - word
                "1.2.840.10008.5.1.4.1.1.7.4", // SC Image - true color
      ];

      // state variables
      this.pendingSeriesRequest = null;
      this.pendingControlPointsRequest = null;

      // the list of image class instance UIDs associated with this seriesUID
      this.imageInstanceUIDs = [];

      // the list of control point class instance UIDs associated with this seriesUID
      this.controlPointInstanceUIDs = [];
      // the list of control point documents in json
      this.controlPointDocuments = [];

      // the image source to fetch from
      this.imgSrc = "";

      // the control point lists for the current instance
      //  - will be a list of lists of points
      this.controlPoints = [];

      // Set the class and disable click
      this.element
        // add a class for theming
        .addClass( "chronicle-series" )
        // prevent double click to select text
        .disableSelection();

      // Add the slice slider
      // TODO: add ticks and labels and spinner e.g.
      //  http://bseth99.github.io/jquery-ui-scrollable/index.html
      this.sliceSlider = $( "<input>", {
         "class": "chronicle-series-sliceSlider",
         "id": "sliceSlider",
         "type" : "range",
         "data-role" : "slider",
         "width" : "512px"
      }).appendTo( this.element );

      $( "<br>" ).appendTo( this.element );

      // Add the svg container for the slice (instance)
      this.sliceGraphics = $( "<div>", {
         "class" : "chronicle-series-sliceGraphics",
         "id" : "sliceGraphics",
         "width" : "512px",
         "height" : "512px",
      }).appendTo( this.element );

      $('#sliceGraphics').svg({
        width: 512,
        height: 512
      }).keydown( function(event) {
        console.log(event);
      });

      $( "<br>" ).appendTo( this.element );

      $(''
        + '<form>'
          + '<div id="dragModeRadio">'
          + '    <input type="radio" id="dragMode1" name="dragModeRadio" value="one">'
          + '    <label for="dragMode1">Drag One</label>'
          + '    <input type="radio" id="dragMode2" name="dragModeRadio"  value="all" checked="checked">'
          + '    <label for="dragMode2">Drag All</label>'
          + '    <input type="radio" id="dragMode3" name="dragModeRadio" value="rotate">'
          + '    <label for="dragMode3">Rotate All</label>'
          + '    <input type="radio" id="dragMode4" name="dragModeRadio" value="scale">'
          + '    <label for="dragMode4">Scale All</label>'
          + '</div>'
        + '</form>'
      ).appendTo( this.element );

      $( "<br>" ).appendTo( this.element );

      this._refresh();
    },


    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {
      // remove generated elements
      this.sliceSlider.remove();
      this.sliceGraphics.remove();

      this._clearResults();

      this.element
        .removeClass( "chronicle-series" )
        .enableSelection();
    },


    _clearResults: function() {
      $('p',this.element[0]).remove();
    },

    // called when created, and later when changing options
    _refresh: function() {

      // clear previous results
      this._clearResults();

      // abort pending requests
      if (this.pendingSeriesRequest) {
        this.pendingSeriesRequest.abort();
        this.pendingSeriesRequest = null;
      }
      if (this.pendingControlPointsRequest) {
        this.pendingControlPointsRequest.abort();
        this.pendingControlPointsRequest = null;
      }

      // create a slider with the max set to the number of instances
      // - when it is manipulated, trigger an update to the instance value
      //   and thus redraw the graphics
      var series = this;
      this.pendingSeriesRequest =
        $.couch.db("chronicle").view("instances/seriesInstances", {
          key : this.options.seriesUID,
          reduce : false,
          include_docs : true,
          success: function(data) {
            series.imageInstanceUIDs = [];
            series.controlPointInstanceUIDs = [];
            series.controlPointDocuments = [];
            $.each(data.rows, function(index,row) {
              var classUID = row.value[0];
              var instanceUID = row.value[1];
              if (series.imageClasses.indexOf(classUID) != -1) {
                series.imageInstanceUIDs.push(instanceUID);
              } else {
                // TODO: once we have a classUID for control points we can do better
                // For now, assume any non-image is a control point list
                series.controlPointInstanceUIDs.push(instanceUID);
                series.controlPointDocuments.push(row.doc);
              }
            });
            // Pseudo-HACK: sort instanceUIDs by last element of UID
            // since that is almost always slice number.
            // This way the slider will work as expected.
            lastUIDInt = function(uid) {return (eval(uid.split(".").pop())); };
            cmp = function(a,b) { return (a<b ? -1 : (b<a ? 1 : 0)); };
            sortF = function(a,b) { return (cmp(lastUIDInt(a),lastUIDInt(b))); }
            series.imageInstanceUIDs = series.imageInstanceUIDs.sort(sortF);

            // determine the current instance index and update the slider and view
            var imageInstanceIndex = series.imageInstanceUIDs.indexOf(
                                               series.options.imageInstanceUID);
            var instanceCount = series.imageInstanceUIDs.length;
            $('#sliceSlider').attr( 'max', instanceCount-1 );
            if (imageInstanceIndex == -1) {
              imageInstanceIndex = Math.round(instanceCount/2);
            }
            $('#sliceSlider').val( imageInstanceIndex );
            series._imageInstanceIndex( imageInstanceIndex );
            $('#sliceSlider').bind("change", function(event,ui) {
                    var value = $('#sliceSlider').val();
                    series._imageInstanceIndex(value);
            });
            // copy data to DOM for shared access (see chronicle.structures.js)
            $('body').data().imageInstanceUIDs = series.imageInstanceUIDs;
            $('body').data().controlPointDocuments = series.controlPointDocuments;
            $('body').data().controlPointDocuments = series.controlPointDocuments;
            // trigger a callback/event
            $('#sliceView').trigger( "change" );
console.log('triggered change');
          },
          error: function(status) {
            console.log(status);
            alert(status);
          },
        });

      $( "#dragModeRadio" ).buttonset();
      $( "#dragModeRadio" ).buttonset('refresh');


    },

    // called when created, and later when changing options
    // This draws the current image and then sets up a request
    // for all the objects that reference this instance
    // TODO: currently hard-coded for control points and curves
    _imageInstanceIndex: function(index) {

      // draw with the image first, overlays will come later
      this.options.imageInstanceUID = this.imageInstanceUIDs[index];
      // copy data to DOM for shared access (see chronicle.structures.js)
      $('body').data().imageInstanceUID = this.options.imageInstanceUID;
      // update the background image
      this.imgSrc = '../' + this.options.imageInstanceUID + '/image512.png';
      // create a list of points for this image instance
      this.controlPoints = [];
      var series = this;
      $.each(this.controlPointDocuments, function(index, doc) {
        var points = doc.instancePoints[series.options.imageInstanceUID];
        if (points) {
          series.controlPoints.push(points);
        }
      });
      this._drawGraphics();
    },

    // update the polyline between the control points
    // - broken out so it can be called from the drag handler
    _updateLines: function() {

      var svg = $('#sliceGraphics').svg('get');
      $('polyline').remove();
      // add lines
      $.each(this.controlPoints, function(index, points) {
        points.push(points[0]); // close the line
        svg.polyline(points,
                   {fill: 'none', stroke: 'yellow', strokeWidth: 1, opacity: 0.5});
      });
    },


    // handle a drag event on a control point
    //  -- take into account the current dragModeRadio state
    _dragEvent: function() {
        console.log($("#dragModeRadio :radio:checked + label").text());
    },

    // updates the slice graphics to reflect current state
    // and sets up callback events
    _drawGraphics: function() {

      // clear the old graphics
      svg = $('#sliceGraphics').svg('get');
      //svg.clear();
      $('circle').remove();
      $('polyline').remove();

      // draw the image
      if (this.imgSrc) {
        if ( $('image').length == 0 ) {
          svg.image(null, 0, 0, 512, 512, this.imgSrc);
        } else {
          $('image')[0].setAttribute('href', this.imgSrc);
        }
      }

      // draw the graphic overlay
      this._updateLines();

      // add control points
      // - pull them from the document dictionary for this instance
      $.each(this.controlPoints, function(curveIndex, points) {
        $.each(points, function(pointIndex, point) {
          svg.circle(point[0], point[1], 5,
                      {fill: 'red', stroke: 'blue', strokeWidth: 1, opacity: 0.5,
                       curveIndex: curveIndex, pointIndex: pointIndex
                      })
        });
      });

      var series = this;
      $('circle')
      .draggable()
      .bind('mouseenter', function(event){
        // bring target to front
        $(event.target.parentElement).append( event.target );
        event.target.setAttribute('opacity', 1.0);
        event.target.setAttribute('stroke', 'green');
      })
      .bind('mouseleave', function(event){
        event.target.setAttribute('opacity', 0.5);
        event.target.setAttribute('stroke', 'blue');
      })
      .bind('mousedown', function(event){
        // record start position offset from center of point
        var dx = event.target.getAttribute('cx') - event.offsetX;
        var dy = event.target.getAttribute('cy') - event.offsetY;
        event.target.setAttribute('dx', dx);
        event.target.setAttribute('dy', dy);
      })
      .bind('drag', function(event, ui){
        // update circle coordinates
        series._dragEvent();
        var cx = event.offsetX - event.target.getAttribute('dx');
        var cy = event.offsetY - event.target.getAttribute('dy');
        event.target.setAttribute('cx', cx);
        event.target.setAttribute('cy', cy);
        // update curve in series object
        var curveIndex = event.target.getAttribute('curveIndex');
        var pointIndex = event.target.getAttribute('pointIndex');
        series.controlPoints[curveIndex][pointIndex] = [cx, cy];
        // redraw the lines with new values
        series._updateLines();
        console.log(event);
      })
      .bind('keydown', function(event){
        // key press
        console.log(event);
      });
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
