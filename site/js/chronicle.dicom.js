//
// Utility code for manipulating DICOM
//
// This is part of the Chronicle Project.
//
//
// WIP 2014-04-26


chronicleDICOM = {

  //
  // math utilities for processing dicom volumes
  // TODO: there must be good replacements for these
  //
  _cross: function(x, y) {
    return ([x[1] * y[2] - x[2] * y[1],
            x[2] * y[0] - x[0] * y[2],
            x[0] * y[1] - x[1] * y[0]]);
  },

  _difference: function(x, y) {
    return ([x[0] - y[0], x[1] - y[1], x[2] - y[2]]);
  },

  _dot: function(x, y) {
    return (x[0] * y[0] + x[1] * y[1] + x[2] * y[2]);
  },

  // maps a tuple [instanceUID, SCOORD] to Patient space (LPS)
  // using information from the given seriesGeometry
  //
  // lps = [  ORl OCl   *  [ Sr   + [ Pl
  //          ORp OCp        Sc ]     Pp
  //          ORs OCs ]               Ps ]
  "scoordToPatient" : function(seriesGeometry, instanceUID, scoord) {
    var position = seriesGeometry[instanceUID].position;
    var oRow = seriesGeometry[instanceUID].orientation.slice(0,3);
    var oCol = seriesGeometry[instanceUID].orientation.slice(3,6);
    return [
      oRow[0]*scoord[0] + oCol[0]*scoord[1] + position[0],
      oRow[1]*scoord[0] + oCol[1]*scoord[1] + position[1],
      oRow[2]*scoord[0] + oCol[2]*scoord[1] + position[2],
    ];
  },

  // converts a dictionary of scoords indexed by uid to patient space
  "scoordsToPatient" : function(seriesGeometry, points) {
    var patientPoints = {};
    var uids = Object.keys(points);
    $.each(uids, function(index,uid) {
      patientPoints[uid] = [];
      scoords = points[uid];
      $.each(scoords, function(index,scoord) {
        patientPoints[uid].push(chronicleDICOM.scoordToPatient(seriesGeometry, uid, scoord));
      });
    });
    return( patientPoints );
  },

  // returns a list of the instanceUIDs geometrically sorted
  // -- for now assumes all instances have same orientation and spacing
  // TODO: add more checks for validity of slices (see DICOMScalarVolumePlugin.py in slicer)
  "sortedUIDs" : function(seriesGeometry,uids) {
    if (typeof(uids) === 'undefined') {
      uids = Object.keys(seriesGeometry);
    }
    var uid0 = uids[0];
    var origin = seriesGeometry[uid0].position;
    var oRow = seriesGeometry[uid0].orientation.slice(0,3);
    var oCol = seriesGeometry[uid0].orientation.slice(3,6);
    var scanDirection = chronicleDICOM._cross(oRow, oCol);
    var uidDistances = [] // list of pairs for sorting
    $.each(uids, function(index,uid) {
      var position = seriesGeometry[uid].position;
      var vec = chronicleDICOM._difference(position, origin);
      var distance = chronicleDICOM._dot(vec, scanDirection);
      uidDistances.push([uid,distance]);
    });
    uidDistances.sort( function(a,b) {
      return ( (a[1] > b[1]) ? 1 : ( (a[1] < b[1]) ? -1 : 0 ) );
    });
  console.log(uidDistances);
    var sortedUIDs = $.map(uidDistances, function(x) {return(x[0])});
  console.log(sortedUIDs);
    return (sortedUIDs);
  },
}
