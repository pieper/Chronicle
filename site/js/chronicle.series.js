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

      // the list of instance UIDs associated with this seriesUID
      instanceUID : [],

      // the image source to fetch from by default
      imgSrc : "",

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


      this.sliceSlider = $( "<input>", {
         "class": "chronicle-series-sliceSlider",
         "id": "sliceSlider",
         "type" : "range",
         "data-role" : "slider"
      }).appendTo( this.element );

      $( "<br>" ).appendTo( this.element );

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
      if (this.options.pendingUpdateRequest) { this.options.pendingUpdateRequest.abort(); }

      var series = this;

      // create a slider with the max set to the number of instances
      pendingUpdateRequest = $.couch.db("chronicle").view("instances/seriesInstances", {
        success: function(data) {
          series.instanceIDs = $.map(data.rows, function(r) {return (r.value);})
          var instanceCount = series.instanceIDs.length;
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
        key : this.options.seriesUID,
        reduce : false,
      });

      // trigger a callback/event
      this._trigger( "change" );
    },

    // called when created, and later when changing options
    _instanceIndex: function(index) {
      this.imgSrc = '../' + this.instanceIDs[index] + '/image512.png';
      this._drawGraphics();
    },

    _drawGraphics: function() {
      console.log('draw graphics');

      svg = $('#sliceGraphics').svg('get');
      svg.clear();
      svg.image(null, 0, 0, 512, 512, this.imgSrc);
      svg.circle(70, 220, 50, {fill: 'red', 
                               opacity: 0.5, 
                               stroke: 'blue', 
                               strokeWidth: 5});
      // http://stackoverflow.com/questions/1108480/svg-draggable-using-jquery-and-jquery-svg
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
