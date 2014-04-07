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
** pydicom
** couchdb
** PIL
** numpy
* For the server
** Apache CouchDB
* For the browser
** HTML5 compliant browser

Use https://github.com/pieper/couchSite to upload design documents and site (html/css/javascript)

Status
======

This is a pre-release project and is subject to change at any time with no assurance of
backward compatibility.

Support
=======

This work is supported by NIH National Cancer Institute (NCI), award U24 CA180918 (QIICR: Quantitative Image Informatics for Cancer Research) 
and the National Institute of Biomedical Imaging and Bioengineering (NIBIB), award P41 EB015902 (NAC: Neuroimage Analysis Center). 
