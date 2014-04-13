# the views.py file includes the map/reduce functions for the couchdb
# design as python dictionaries.

global views
views = { "instances" : {
    "language" : "javascript",
    "views" : {
        "context" : {
            "map" : '''
              function(doc) {
                var tags = [
                  ['institution', '00080080', 'UnspecifiedInstitution'],
                  ['patientID', '00100020', 'UnspecifiedPatientID'],
                  ['studyUID', '0020000D', 'UnspecifiedStudyUID'],
                  ['studyDescription', '00081030', 'UnspecifiedStudyDescription'],
                  ['seriesUID', '0020000E', 'UnspecifiedSeriesUID'],
                  ['seriesDescription', '0008103E', 'UnspecifiedSeriesDescription'],
                  ['instanceUID', '00080018', 'UnspecifiedInstanceUID'],
                  ['modality', '00080060', 'UnspecifiedModality'],
                ];
                var key = {};
                if (doc.dataset) {
                  var i;
                  for (i = 0; i < tags.length; i++) {
                    var tag = tags[i];
                    var name     = tag[0];
                    var t        = tag[1];
                    var fallback = tag[2];
                    key[name] = fallback;
                    if (doc.dataset[t] && doc.dataset[t].Value) {
                      key[name] = doc.dataset[t].Value || fallback;
                    }
                  }
                  emit([
                      [key.institution,key.patientID],
                      [key.studyDescription,key.studyUID],
                      [key.modality,key.seriesDescription,key.seriesUID],
                      key.instanceUID
                    ],
                    1
                  );
                }
              }
            ''',
            "reduce" : "_count()",
        },
        "seriesInstances" : {
            "map" : '''
              function(doc) {
                var tags = [
                  ['seriesUID', '0020000E', 'UnspecifiedSeriesUID'],
                  ['classUID', '00080016', 'UnspecifiedClassUID'],
                  ['instanceUID', '00080018', 'UnspecifiedInstanceUID'],
                ];
                var key = {};
                if (doc.dataset) {
                  var i;
                  for (i = 0; i < tags.length; i++) {
                    var tag = tags[i];
                    var name     = tag[0];
                    var t        = tag[1];
                    var fallback = tag[2];
                    key[name] = fallback;
                    if (doc.dataset[t] && doc.dataset[t].Value) {
                      key[name] = doc.dataset[t].Value || fallback;
                    }
                  }
                  emit( key.seriesUID, [key.classUID, key.instanceUID] );
                }
              }
            ''',
            "reduce" : "_count()",
        },
        "instanceReferences" : {
            "map" : '''
              // TODO: this needs to be generalized to instance->instance reference
              // for now this is specific fo instancePoints
              function(doc) {
                if (doc.instancePoints) {
                  instanceUIDs = Object.keys(doc.instancePoints);
                  for (var i in instanceUIDs) {
                    emit( instanceUIDs[i], doc._id );
                  }
                }
              }
            ''',
            "reduce" : "_count()",
        }
    }
  }
}

