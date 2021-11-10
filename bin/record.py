#!/usr/bin/env python
"""
Record a directory containing dicom objects in
the chronicle couch database.

Use --help to see options.

TODO:
* this should work equally on all dicom object instances,
so the image specific things should be factored out.
* consider making binary VRs into attachments (but maybe not,
since full object is available already as attachment)

"""

import argparse
import couchdb
import pydicom
import json
import numpy
import os
import sys
import tempfile
import traceback

haveImage = True
try:
    import PIL
    import PIL.Image as Image
except ImportError:
    # for some reason easy_install doesn't generate a PIL layer on mac
    try:
        import Image
    except ImportError:
        haveImage = False



# {{{ ChronicleRecord

class ChronicleRecord():
    """Performs the recording of DICOM objects
    """

    def __init__(self, couchDB_URL='http://localhost:5984', databaseName='chronicle'):
        self.couchDB_URL=couchDB_URL
        self.databaseName=databaseName

        # these will not be included in the json
        self.BINARY_VR_VALUES = ['OW', 'OB', 'OW/OB', 'OW or OB', 'OB or OW', 'US or SS']

        # these don't get auto-quoted by json for some reason
        self.VRs_TO_QUOTE = ['DS', 'AT']

        print(self.couchDB_URL)
        self.couch = couchdb.Server(self.couchDB_URL)
        try:
            print(self.databaseName)
            self.db = self.couch[self.databaseName]
        except couchdb.ResourceNotFound:
            self.db = self.couch.create(self.databaseName)

    def dataElementToJSON(self,dataElement):
        """Returns a json dictionary which is either a single
        element or a dictionary of elements representing a sequnce.
        """
        if dataElement.VR in self.BINARY_VR_VALUES:
            value = "Binary Omitted"
        elif dataElement.VR == "SQ":
            values = []
            for subelement in dataElement:
                # recursive call to co-routine to format sequence contents
                values.append(self.datasetToJSON(subelement))
            value = values
        elif dataElement.VR in self.VRs_TO_QUOTE:
            # switch to " from ' - why doesn't json do this?
            value = "%s" % dataElement.value
        else:
            value = dataElement.value
            if isinstance(value, bytes):
                try:
                    value = value.encode('utf-8')
                except AttributeError:
                    value = str(value) # Private tags have non-standard 
            elif isinstance(value, pydicom.valuerep.PersonName):
                print(f"PersonName: {value}")
                if value.original_string:
                  value = value.original_string.decode()
                else:
                  value = ""
        try:
            print(f"serializing {value}, {dataElement.VR}")
            if isinstance(value, pydicom.multival.MultiValue):
                value = [str(i) for i in value]
            else:
                couchdb.json.encode(value).encode('utf-8')
        except ValueError:
            print('Skipping non-encodable value', value)
            value = "Not encodable"
        json = {
            "vr" : dataElement.VR,
            "Value" : value
        }
        return json

    def datasetToJSON(self,dataset):
        """
        returns a json-compatible dictionary of that the json module
        will convert into json of the form documented here:
        ftp://medical.nema.org/medical/dicom/final/sup166_ft5.pdf

        Note this is a co-routine with dataElementToJSON and they
        can call each other recursively since SQ (sequence) data elements
        are implemented as nested datasets.
        """
        jsonDictionary = {}
        for key in dataset.keys():
            jkey = "%04X%04X" % (key.group,key.element)
            try:
                dataElement = dataset[key]
                jsonDictionary[jkey] = self.dataElementToJSON(dataElement)
            except KeyError:
                print("KeyError: ", key)
            except ValueError:
                print("ValueError: ", key)
            except NotImplementedError:
                print("NotImplementedError: ", key)
        return jsonDictionary

    def windowedData(self,data, window, level):
        """Apply the RGB Look-Up Table for the given data and window/level value."""
        # deal with case of multiple values for window/level - use the first one in the list
        try:
            window = window[0]
            level = level[0]
        except TypeError:
            pass
        window = float(window) # convert from DS
        level = float(level) # convert from DS
        return numpy.piecewise(data,
            [data <= (level - 0.5 - (window-1)/2),
                data > (level - 0.5 + (window-1)/2)],
                [0, 255, lambda data: ((data - (level - 0.5))/(window-1) + 0.5)*(255-0)])

    def imageFromDataset(self,dataset):
        """return an image from the dicom dataset using the Python Imaging Library (PIL)"""
        if ('PixelData' not in dataset):
            # DICOM dataset does not have pixel data
            print('no pixels')
            return None
        if ('SamplesPerPixel' not in dataset):
            print('no samples')
            return None
        if ('WindowWidth' not in dataset) or ('WindowCenter' not in dataset):
            print("No window width or center in the dataset")
            # no width/center, so use whole
            bits = dataset.BitsAllocated
            samples = dataset.SamplesperPixel
            if bits == 8 and samples == 1:
                mode = "L"
            elif bits == 8 and samples == 3:
                mode = "RGB"
            elif bits == 16:
                mode = "I;16" # from sample code: "not sure about this
                            # -- PIL source says is 'experimental' and no documentation.
                            # Also, should bytes swap depending on endian of file and system??"
            elif bits == 1 and samples == 1:
                mode = "1"
            else:
                raise TypeError("Don't know PIL mode for %d BitsAllocated and %d SamplesPerPixel" % (bits, samples))
            # PIL size = (width, height)
            size = (dataset.Columns, dataset.Rows)
            # Recommended to specify all details by
            #  http://www.pythonware.com/library/pil/handbook/image.htm
            try:
                image = Image.frombuffer(mode, size, dataset.PixelData, "raw", mode, 0, 1).convert('L')
            except ValueError:
                print("ValueError getting image")
                image = None
        else:
            try:
                image = self.windowedData(
                                    dataset.pixel_array,
                                    dataset.WindowWidth, dataset.WindowCenter
                                    )
            except NotImplementedError:
                print("NotImplementedError: cannot get image data")
                return None
            except ValueError:
                print("ValueError: cannot get image data")
                return None
            # Convert mode to L since LUT has only 256 values:
            #  http://www.pythonware.com/library/pil/handbook/image.htm
            if image.dtype != 'int16':
                print('Type is not int16, converting')
                image = numpy.array(image, dtype='int16')
            try:
                image = Image.fromarray(image).convert('L')
            except TypeError:
                print('Type can not be converted')
                return None
        return image

    def imagesFromDataset(self,dataset, sizes = (32,64,128,256,512)):
        """
        returns a dictionary of pil images for each size where
        keys are the image size.
        """
        images = {}
        image = self.imageFromDataset(dataset)
        if image:
            for size in sizes:
                aspectRatio = image.size[0]/(1. * image.size[1])
                newSize = ( size, int(size / aspectRatio) )
                images[size] = image.resize(newSize,Image.ANTIALIAS)
        return images

    def recordDirectory(self,directoryPath):
        """Perform the record"""
        for root, dirs, files in os.walk(directoryPath):
            for fileName in files:
                fileNamePath = os.path.join(root,fileName)
                self.recordFile(fileNamePath)

    def recordFile(self,fileNamePath):
        print("Considering file: %s" % fileNamePath)
        # create dataset, skip non-dicom
        try:
            dataset = pydicom.read_file(fileNamePath)
        except:
            print("...apparently not dicom")
            return

        # check if instance is already in database
        document = self.db.get(dataset.SOPInstanceUID)
        if document:
            if self.forceUpload:
                print("... deleting existing %s from database" % dataset.SOPInstanceUID)
                self.db.delete(document)
            else:
                print("... %s already in database" % dataset.SOPInstanceUID)
                return

        # make a couchdb document that contains the dataset in json
        jsonDictionary = self.datasetToJSON(dataset)
        document = {
            '_id' : dataset.SOPInstanceUID,
            'fileNamePath' : fileNamePath,
            'dataset': jsonDictionary
        }

        print('...saving...')        
        doc_id, doc_rev = self.db.save(document)
        # save the document
        try:
            print('...saving...')
            doc_id, doc_rev = self.db.save(document)
        except:
            # TODO: keep track of failed documents and error conditions
            print('...failed to save!!!')
            try:
                print(couchdb.json.encode(document))
                print(couchdb.json.encode(document).encode('utf-8'))
            except UnicodeDecodeError:
                print('Document contains non-ascii value');
            return

        # attach png images to the object if possible
        if self.attachImages:
            doc = self.db.get(doc_id)
            images = self.imagesFromDataset(dataset)
          for imageSize in [512]: #images.keys():
              print('...thumbnail %d...' % imageSize)
              imageName = "image%d.png" % imageSize
              imageFD, imagePath = tempfile.mkstemp(suffix='.png')
              os.fdopen(imageFD,'w').close()
              images[imageSize].save(imagePath)
              fp = open(imagePath, "rb")
              self.db.put_attachment(doc, fp, imageName, content_type='image/png')
              fp.close()
              os.remove(imagePath)

        # attach the original file
        if self.attachOriginals:
          print('...attaching dicom object...')
          fp = open(fileNamePath,'rb')
          self.db.put_attachment(doc, fp, "object.dcm")
          fp.close()

        print ("...recorded %s" % dataset.SOPInstanceUID)

# }}}

# {{{ main, test, and arg parse

def main ():

    parser = argparse.ArgumentParser(description="Record DICOM documents into Chronicle of CouchDB")
    parser.add_argument("inputDirectory",help="Input path to search for files to record")
    parser.add_argument("--url",dest="couchDB_URL",type=str,default="http://localhost:5984",help="CouchDB instance URL (default http://localhost:5984)")
    parser.add_argument("--dbName",dest="databaseName",type=str,default="chronicle",help="Name of the database (default chronicle)")
    parser.add_argument("--dontAttachImages",dest="dontAttachImages",action="store_true",default=False,help="Flag to generate and attach image thumbnails (default false)")
    parser.add_argument("--dontAttachOriginals",dest="dontAttachOriginals",action="store_true",default=False,help="Flag to attach original DICOM files (default false)")
    parser.add_argument("--force",dest="forceUpload",action="store_true",default=False,help="Force re-upload of already in database (default false)")
    ns = parser.parse_args()

    global recorder # for ipython debugging
    recorder = ChronicleRecord(couchDB_URL=ns.couchDB_URL,databaseName=ns.databaseName)
    recorder.attachImages = not ns.dontAttachImages
    recorder.attachOriginals = not ns.dontAttachOriginals
    recorder.forceUpload = ns.forceUpload

    path = ns.inputDirectory
    if os.path.isdir(path):
      recorder.recordDirectory(path)
    elif os.path.isfile(path):
      recorder.recordFile(path)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print ('ERROR, UNEXPECTED EXCEPTION')
        print (str(e))
        traceback.print_exc()

# }}}

# vim:set sr et ts=4 sw=4 ft=python fenc=utf-8: // See Vim, :help 'modeline
# vim: foldmethod=marker
