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

      // the currently selected instanceUID to display
      instanceUID : null,

      // callbacks
      change: null,
    },

    // the constructor
    _create: function() {

      // state variables
      this.pendingSeriesRequest = null;
      this.pendingReferencesRequest = null;

      // the list of instance UIDs associated with this seriesUID
      instanceUIDs = [];

      // the image source to fetch from
      imgSrc = "";

      // the control point lists for the current instance
      //  - will be a list of lists of points
      controlPoints = [];

      // Set the class and disable click
      this.element
        // add a class for theming
        .addClass( "chronicle-series" )
        // prevent double click to select text
        .disableSelection();


      // Add the slice slider
      this.sliceSlider = $( "<input>", {
         "class": "chronicle-series-sliceSlider",
         "id": "sliceSlider",
         "type" : "range",
         "data-role" : "slider"
      }).appendTo( this.element );

      $( "<br>" ).appendTo( this.element );

      // Add the svg container for the slice (instance)
      this.sliceGraphics = $( "<div>", {
         "class" : "chronicle-series-sliceGraphics",
         "id" : "sliceGraphics",
         "width" : "512dpx",
         "height" : "512dpx",
      }).appendTo( this.element );

      $('#sliceGraphics').svg({onLoad: this._drawGraphics});

      $( "<br>" ).appendTo( this.element );

      this.sliceView = $( "<img>", {
         "class" : "chronicle-series-sliceView",
         "id" : "sliceView",
         "src" : "../"
      }).appendTo( this.element );

      this._refresh();
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
      }

      // create a slider with the max set to the number of instances
      // - when it is manipulated, trigger an update to the instance value
      //   and thus redraw the graphics
      var series = this;
      this.pendingSeriesRequest =
        $.couch.db("chronicle").view("instances/seriesInstances", {
          key : this.options.seriesUID,
          reduce : false,
          success: function(data) {
            series.instanceUIDs = $.map(data.rows, function(r) {return (r.value);})
            var instanceCount = series.instanceUIDs.length;
            $('#sliceSlider').attr( 'max', instanceCount-1 );
            $('#sliceSlider').val( Math.round(instanceCount/2) );
            series._instanceIndex( Math.round(instanceCount/2) );
            $('#sliceSlider').bind("change", function(event,ui) {
                    var value = $('#sliceSlider').val();
                    series._instanceIndex(value);
            });
          },
          error: function(status) {
            console.log(status);
            alert(status);
          },
        });

      // trigger a callback/event
      this._trigger( "change" );
    },

    // called when created, and later when changing options
    // This draws the current image and then sets up a request
    // for all the objects that reference this instance
    // TODO: currently hard-coded for control points and curves
    _instanceIndex: function(index) {

      // draw with the image first, overlays will come later
      this.controlPoints = [];
      this.options.instanceUID = this.instanceUIDs[index];
      this.imgSrc = '../' + this.options.instanceUID + '/image512.png';
      // TODO
      this.options.instanceUID = "1.3.6.1.4.1.35511635209895445060349.1.4.0.3.16";
      this._drawGraphics();

      // abort pending requests
      if (this.pendingReferencesRequest) {
        this.pendingReferencesRequest.abort();
      }

      // request curve lists associated with this instance
      var series = this;
      this.pendingReferencesRequest =
        $.couch.db("chronicle").view("instances/instanceReferences", {
          key : series.options.instanceUID,
          include_docs : true,
          reduce : false,
          success: function(data) {
            $.each(data.rows, function(index,value) {
              instancePoints = value.doc.instancePoints;
              series.controlPoints.push(instancePoints[series.options.instanceUID]);
            });
            series._drawGraphics();
          },
          error: function(status) {
            console.log(status);
            alert(status);
          },
        });
    },

    _drawGraphics: function() {

      if (this.imgSrc) {
        svg = $('#sliceGraphics').svg('get');
        svg.clear();
        svg.image(null, 0, 0, 512, 512, this.imgSrc);

        $.each(this.controlPoints, function(index, points) {
          $.each(points, function(index, point) {
            svg.circle(point[0], point[1], 5, {fill: 'red',
                                     opacity: 0.5,
                                     stroke: 'blue',
                                     strokeWidth: 5});

          });
        });
      // http://stackoverflow.com/questions/1108480/svg-draggable-using-jquery-and-jquery-svg
      // TODO: move out of loops
      $('circle')
      .draggable()
      .bind('mousedown', function(event, ui){
	// bring target to front
	$(event.target.parentElement).append( event.target );
      })
      .bind('drag', function(event, ui){
	// update coordinates manually, since top/left style props don't work on SVG
	event.target.setAttribute('cx', ui.position.left);
	event.target.setAttribute('cy', ui.position.top);
      });
      }
    },



    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {
      // remove generated elements
      this.sliceSlider.remove();
      this.sliceView.remove();
      this.sliceGraphics.remove();

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
