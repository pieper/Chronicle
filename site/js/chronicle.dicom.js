//
// Utility code for manipulating DICOM
//
// This is part of the Chronicle Project.
//
//
// WIP 2014-04-26


chronicleDICOM = {

  // maps a tuple [instanceUID, SCOORD] to Patient space (LPS)
  // using information from the given seriesGeometry
  //
  // lps = [  ORl OCl   *  [ Sr   + [ Pl
  //          ORp OCp       Sc ]     Pp
  //          ORs OCs ]              Ps ]

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
}
