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

import os
import sys
import traceback
import json
import dicom
import couchdb

try:
    import PIL
    import PIL.Image as Image
except ImportError:
    # for some reason easy_install doesn't generate a PIL layer on mac
    import Image

import numpy


# {{{ ChronicleRecord

class ChronicleRecord():
    """Performs the recording of DICOM objects
    """

    def __init__(self, couchDB_URL='http://localhost:5984', databaseName='chronicle'):
        self.couchDB_URL=couchDB_URL
        self.databaseName=databaseName

        # these will not be included in the json
        self.BINARY_VR_VALUES = ['OW', 'OB', 'OW/OB', 'OW or OB', 'OB or OW', 'US or SS']

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
        elif dataElement.VR == "DS":
            # switch to " from ' - why doesn't json do this?
            value = "%s" % dataElement.value
        else:
            value = dataElement.value
            if isinstance(value, unicode):
                value = value.encode('utf=8')
        return {
            "vr" : dataElement.VR,
            "Value" : value
        }

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
            dataElement = dataset[key]
            jsonDictionary[jkey] = self.dataElementToJSON(dataElement)
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
            else:
                raise TypeError, "Don't know PIL mode for %d BitsAllocated and %d SamplesPerPixel" % (bits, samples)
            # PIL size = (width, height)
            size = (dataset.Columns, dataset.Rows)
            # Recommended to specify all details by
            #  http://www.pythonware.com/library/pil/handbook/image.htm
            image = Image.frombuffer(mode, size, dataset.PixelData, "raw", mode, 0, 1).convert('L')
        else:
            image = self.windowedData(
                                dataset.pixel_array,
                                dataset.WindowWidth, dataset.WindowCenter
                                )
            # Convert mode to L since LUT has only 256 values:
            #  http://www.pythonware.com/library/pil/handbook/image.htm
            if image.dtype != 'int16':
                print('Type is not int16, converting')
                image = numpy.array(image, dtype='int16')
            image = Image.fromarray(image).convert('L')
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
            dataset = dicom.read_file(fileNamePath)
        except:
            print("...apparently not dicom")
            return

        # check if instance is already in database
        if self.db.get(dataset.SOPInstanceUID):
            print("...already in database")
            return

        # make a couchdb document that contains the dataset in json
        jsonDictionary = self.datasetToJSON(dataset)
        document = {
            '_id' : dataset.SOPInstanceUID,
            'fileNamePath' : fileNamePath,
            'dataset': jsonDictionary
        }

        # save the document
        try:
            doc_id, doc_rev = self.db.save(document)
        except:
            print('...failed to save!!!')
            return

        # attach png images to the object if possible
        doc = self.db.get(doc_id)
        images = self.imagesFromDataset(dataset)
        for imageSize in images.keys():
            imageName = "image%d.png" % imageSize
            imagePath = "/tmp/" + imageName
            images[imageSize].save(imagePath) # TODO: generalize
            fp = open(imagePath)
            self.db.put_attachment(doc, fp, imageName)
            fp.close()
            os.remove(imagePath)

        # attach the original file
        fp = open(fileNamePath,'rb')
        self.db.put_attachment(doc, fp, "object.dcm")
        fp.close()

        print ("...recorded")

# }}}

# {{{ main, test, and arg parse

def usage():
    print ("record [directoryPath] <CouchDB_URL> <DatabaseName>")
    print (" CouchDB_URL default http://localhost:5984")
    print (" DatabaseName default 'chronicle'")

def main ():
    if sys.argv[1] in ("-h", "--help"):
        usage()
        return
    print(sys.argv)
    directoryPath = sys.argv[1]
    global recorder # for ipython debugging
    recorder = ChronicleRecord()
    if len(sys.argv) > 2:
        recorder.couchDB_URL = sys.argv[2]
    if len(sys.argv) > 3:
        recorder.databaseName = sys.argv[3]

    recorder.recordDirectory(directoryPath)

if __name__ == '__main__':
    try:
        if len(sys.argv) < 2:
            raise BaseException('missing arguments')
        main()
    except Exception, e:
        print ('ERROR, UNEXPECTED EXCEPTION')
        print str(e)
        traceback.print_exc()

# }}}

# vim:set sr et ts=4 sw=4 ft=python fenc=utf-8: // See Vim, :help 'modeline
# vim: foldmethod=marker
