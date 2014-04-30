Chronicle
=========

An ordered record of events.

Purpose
=======

Chronicle is a system to manage a directed acyclic graph of data items.

The items are represented as DICOM object instances stored as documents in CouchDB.

Repository Contents
===================

* site: a web app (html5/js/css) to be hosted from CouchDB for interacting with the data.

* bin: python utility scripts to transfer local (DICOM) data to a CouchDB instance.


Prerequisites
=============

* For the python scripts
 * pydicom
 * couchdb
 * PIL
 * numpy
* For the server
 * Apache CouchDB
* For the browser
 * HTML5 compliant browser (Chrome, Desktop Safari, Firefox, IE should all work with the WebGL rendering)

Use https://github.com/pieper/couchSite to upload design documents and site (html/css/javascript)

Installation
============

* Install a python environment with the prerequisites above (has been tested on mac and linux).
* Install Apache couchdb
* Clone the chronicle respository:
  git clone git://github.com/pieper/chronicle
* Get the couchSite utility
  git clone git://github.com/pieper/couchSite
* Install chronicle into couchdb:
  cd chronicle
  ../couchSite/couchSite.py . chronicle

At this point you should have an empty chonicle database and the web app.  The next step is to install some DICOM data into the database, which can be done as follows from the chronicle directory:

 ./bin/record.py <path to dicom data>

Note that only pixel formats (transfer syntaxes) supported by pydicom can be used, so some compressed images cannot be loaded currently.

The current Chronicle prototype includes functionality for viewing control-point curves on a per-slice basis and for 3D rendering of these structures.  At this point there is no way to create these using the user interface and there are no publicly available datasets that include these annotations.

Status
======

This is a pre-release project and is subject to change at any time with no assurance of
backward compatibility.

Support
=======

This work is supported by NIH National Cancer Institute (NCI), award U24 CA180918 (QIICR: Quantitative Image Informatics for Cancer Research) and the National Institute of Biomedical Imaging and Bioengineering (NIBIB), award P41 EB015902 (NAC: Neuroimage Analysis Center).  Additional support provided by Novartis AG.
