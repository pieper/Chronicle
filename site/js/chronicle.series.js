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

      // default point properties
      fill : 'red',
      stroke : 'yellow',
      opacity : 0.5,
      // selected properties
      selectedFill : 'green',
      selectedStroke : 'yellow',
      selectedOpacity : 0.8,

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

      this.ImagePositionPatientTag = "00200032";
      this.ImageOrientationPatientTag = "00200037";

      // state variables
      this.pendingSeriesRequest = null;
      this.pendingControlPointsRequest = null;

      // the list of image class instance UIDs associated with this seriesUID
      this.imageInstanceUIDs = [];

      // seriesGeometry is a map of instnaceUID to position, orientation vectors
      this.seriesGeometry = {};

      // the list of control point class instance UIDs associated with this seriesUID
      this.controlPointInstanceUIDs = [];
      // the list of control point documents in json
      this.controlPointDocuments = [];
      this.controlPointDocumentsByLabel = {};

      // the image source to fetch from
      this.imgSrc = "";

      // the control point lists for the current instance
      //  - will be a list of lists of points
      //  - labels is a matching list of the labels (same indexing)
      this.controlPoints = [];
      this.labels = [];

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
        // TODO
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

      $(''
         + ' <div id="dialog-confirm" title="Copy points?">'
         + '  <p>'
         + '  <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;">'
         + '  </span>'
         + '  These items will be permanently deleted and cannot be recovered. Are you sure?'
         + '  </p>'
         + ' </div>'
      ).appendTo( this.element );



      $( "<br>" ).appendTo( this.element );

      // listen for changes to the image index to show
      var series = this;
      $('body').on('imageInstanceUIDChange', function(e) {
        series._imageInstanceUID(series, $('body').data().imageInstanceUID);
      });

      this._refresh();
    },


    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {
      // remove observer
      $('body').on('imageInstanceUIDChange', this._imageInstanceIndex);
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
            series.controlPointDocumentsByLabel = {};
            $.each(data.rows, function(index,row) {
              var classUID = row.value[0];
              var instanceUID = row.value[1];
              if (series.imageClasses.indexOf(classUID) != -1) {
                series.imageInstanceUIDs.push(instanceUID);
                // TODO: don't use 'eval' - looks like a bug in record.py - should be list not string with list inside
                var position = $.map(
                  eval(row.doc.dataset[series.ImagePositionPatientTag].Value), function(e) {
                    return (Number(e));
                });
                var orientation = $.map(
                  eval(row.doc.dataset[series.ImageOrientationPatientTag].Value), function(e) {
                    return (Number(e));
                });
                series.seriesGeometry[instanceUID] = {
                  'position' : position,
                  'orientation' : orientation,
                };
              } else {
                // TODO: once we have a classUID for control points we can do better
                // For now, assume any non-image is a control point list
                series.controlPointInstanceUIDs.push(instanceUID);
                series.controlPointDocuments.push(row.doc);
                series.controlPointDocumentsByLabel[row.doc.label] = row.doc;
              }
            });
            // Pseudo-HACK: sort instanceUIDs by last element of UID
            // since that is almost always slice number.
            // This way the slider will work as expected.
            // TODO: use new chronicleDICOM.sortedUIDs
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
            $('#sliceSlider').on("change", function(event,ui) {
                    var value = $('#sliceSlider').val();
                    series._imageInstanceIndex(value);
            });
            // copy data to DOM for shared access (see chronicle.structures.js)
            $('body').data().imageInstanceUIDs = series.imageInstanceUIDs;
            $('body').data().controlPointInstanceUIDs = series.controlPointInstanceUIDs;
            $('body').data().controlPointDocuments = series.controlPointDocuments;
            $('body').data().seriesGeometry = series.seriesGeometry;
            // trigger callback/event events for update
            $('#sliceView').trigger( "change" );
            $('body').trigger( "controlPointChange" );
          },
          error: function(status) {
            console.log(status);
            alert(status);
          },
        });

      $( "#dragModeRadio" ).buttonset();
      $( "#dragModeRadio" ).buttonset('refresh');

    },

    // called when the body data uid is changed
    _imageInstanceUID: function(series, uid) {
      series.options.imageInstanceUID = uid;
      var index = series.imageInstanceUIDs.indexOf(uid);
      $('#sliceSlider').val( index );
      series._imageInstanceIndex(index);
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
      this.labels = [];
      var series = this;
      $.each(this.controlPointDocuments, function(index, doc) {
        var points = doc.instancePoints[series.options.imageInstanceUID];
        if (points) {
          series.controlPoints.push(points);
          series.labels.push(doc.label);
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
      var series = this;
      $.each(this.controlPoints, function(index, points) {
        var polylinePoints = points.slice(0); // make a copy
        polylinePoints.push(points[0]); // close the line
        var opacity = 0.5;
        var selectedStructure = $('body').data().selectedStructure || '';
        if (series.labels[index] == selectedStructure) {
          opacity = 1.;
        }
        svg.polyline(polylinePoints,
                   {fill: 'none', stroke: 'yellow', strokeWidth: 1, opacity: 0.5});
      });
    },


    // handle a drag event on a control point
    //  -- take into account the current dragModeRadio state
    _dragEvent: function(series,event) {
        var dragMode = $("#dragModeRadio :radio:checked + label").text();

        if (dragMode == 'Drag All') {
          $('circle').each( function (index) {
            var cx = event.offsetX - $(this).attr('dx');
            var cy = event.offsetY - $(this).attr('dy');
            $(this).attr('cx', cx);
            $(this).attr('cy', cy);
            // update curve in series object
            var curveIndex = this.getAttribute('curveIndex');
            var pointIndex = this.getAttribute('pointIndex');
            series.controlPoints[curveIndex][pointIndex] = [cx, cy];
          });
        } else {
          var cx = event.offsetX - event.target.getAttribute('dx');
          var cy = event.offsetY - event.target.getAttribute('dy');
          event.target.setAttribute('cx', cx);
          event.target.setAttribute('cy', cy);
          // update curve in series object
          var curveIndex = event.target.getAttribute('curveIndex');
          var pointIndex = event.target.getAttribute('pointIndex');
          series.controlPoints[curveIndex][pointIndex] = [cx, cy];
        }

        // redraw the lines with new values
        series._updateLines();
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
          svg.image(null, 0, 0, 512, 512, this.imgSrc)
          $('image').on('keydown', function(event){
            // TODO: key press
            console.log(event);
          })
          .on('mousedown', function(event){

          });
        } else {
          $('image')[0].setAttribute('href', this.imgSrc);
        }
      }
 

 
      // draw the graphic overlay
      this._updateLines();

      var series = this;

      // add control points
      // - pull them from the document dictionary for this instance
      $.each(this.controlPoints, function(curveIndex, points) {
        var opacity = series.options.opacity;
        var stroke = series.options.stroke;
        var fill = series.options.fill;
        var selectedStructure = $('body').data().selectedStructure || '';
        if (series.labels[curveIndex] == selectedStructure) {
          opacity = series.options.selectedOpacity;
          stroke = series.options.selectedStroke;
          fill = series.options.selectedFill;
          $.each(points, function(pointIndex, point) {
            svg.circle(point[0], point[1], 5,
                        {fill: fill, stroke: stroke, strokeWidth: 1, opacity: opacity,
                         curveIndex: curveIndex, pointIndex: pointIndex
                        })
          });
        }
      });

      $('circle')
      .draggable()
      .on('mouseenter', function(event){
        // bring target to front
        $(event.target.parentElement).append( event.target );
        event.target.setAttribute('opacity', 1.0);
        event.target.setAttribute('stroke', 'green');
      })
      .on('mouseleave', function(event){
        event.target.setAttribute('opacity', series.options.selectedOpacity);
        event.target.setAttribute('stroke', series.options.selectedStroke);

        /*
            $( "#dialog-confirm" ).dialog({
              resizable: true,
              height:140,
              modal: true,
              buttons: {
                "Delete all items": function() {
                  $( this ).dialog( "close" );
                },
                Cancel: function() {
                  $( this ).dialog( "close" );
                }
              }
            });
            */
            
      })
      .on('mousedown', function(event){
        // record start position offset from center of point
        $('circle').each( function (index) {
          var dx = $(this).attr('cx') - event.offsetX;
          var dy = $(this).attr('cy') - event.offsetY;
          $(this).attr('dx', dx);
          $(this).attr('dy', dy);
        });
      })
      .on('drag', function(event, ui){
        // update circle coordinates
        series._dragEvent(series, event);
      })
      .on('mouseup', function(event, ui){
        var selectedStructure = $('body').data().selectedStructure || '';
        var controlPointDocument = series.controlPointDocumentsByLabel[selectedStructure] || false;
        if (controlPointDocument) {
          var index = series.labels.indexOf(selectedStructure);
          if (index != -1) {
            var instancePoints = controlPointDocument.instancePoints;
            console.log(series);
            console.log(instancePoints);
            console.log(series.options.imageInstanceUID);
            console.log(series.controlPoints);
            instancePoints[series.options.imageInstanceUID] = series.controlPoints[index];
            $('body').data().controlPointDocuments = series.controlPointDocuments;
            $('body').trigger( "controlPointChange" );
          }
        }
      })
      .on('keydown', function(event){
        // TODO: key press
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
