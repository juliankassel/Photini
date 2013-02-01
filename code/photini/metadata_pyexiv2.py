##  Photini - a simple photo metadata editor.
##  http://github.com/jim-easterbrook/Photini
##  Copyright (C) 2012-13  Jim Easterbrook  jim@jim-easterbrook.me.uk
##
##  This program is free software: you can redistribute it and/or
##  modify it under the terms of the GNU General Public License as
##  published by the Free Software Foundation, either version 3 of the
##  License, or (at your option) any later version.
##
##  This program is distributed in the hope that it will be useful,
##  but WITHOUT ANY WARRANTY; without even the implied warranty of
##  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
##  General Public License for more details.
##
##  You should have received a copy of the GNU General Public License
##  along with this program.  If not, see
##  <http://www.gnu.org/licenses/>.

import datetime
import fractions
import os

import pyexiv2
from PyQt4 import QtCore

from version import version, release

class GPSvalue(object):
    def __init__(self, degrees=0.0, latitude=True):
        self.degrees = degrees
        self.latitude = latitude

    def from_xmp_string(self, value):
        degrees, residue = value.split(',')
        minutes = residue[:-1]
        direction = residue[-1]
        self.degrees = float(degrees) + (float(minutes) / 60.0)
        if direction in ('S', 'W'):
            self.degrees = -self.degrees
        self.latitude = direction in ('S', 'N')
        return self

    def to_xmp_string(self):
        if self.degrees >= 0.0:
            ref = ('E', 'N')[self.latitude]
            value = self.degrees
        else:
            ref = ('W', 'S')[self.latitude]
            value = -self.degrees
        degrees = int(value)
        minutes = (value - degrees) * 60.0
        return '%d,%.13f%s' % (degrees, minutes, ref)

    def from_exif_string(self, value, direction):
        parts = map(fractions.Fraction, value.split())
        self.degrees = float(parts[0])
        if len(parts) > 1:
            self.degrees += float(parts[1]) / 60.0
        if len(parts) > 2:
            self.degrees += float(parts[2]) / 3600.0
        if direction in ('S', 'W'):
            self.degrees = -self.degrees
        self.latitude = direction in ('S', 'N')
        return self

    def to_exif_string(self):
        if self.degrees >= 0.0:
            ref = ('E', 'N')[self.latitude]
            value = self.degrees
        else:
            ref = ('W', 'S')[self.latitude]
            value = -self.degrees
        degrees = int(value)
        value = (value - degrees) * 60.0
        minutes = int(value)
        seconds = (value - minutes) * 60.0
        degrees = fractions.Fraction(degrees).limit_denominator(1000000)
        minutes = fractions.Fraction(minutes).limit_denominator(1000000)
        seconds = fractions.Fraction(seconds).limit_denominator(1000000)
        return '%d/%d %d/%d %d/%d' % (
            degrees.numerator, degrees.denominator,
            minutes.numerator, minutes.denominator,
            seconds.numerator, seconds.denominator), ref

class Metadata(QtCore.QObject):
    _keys = {
        'date_digitised' : (('Exif.Photo.DateTimeDigitized',     True),),
        'date_modified'  : (('Exif.Image.DateTime',              True),),
        'date_taken'     : (('Exif.Photo.DateTimeOriginal',      True),
                            ('Exif.Image.DateTimeOriginal',      True),),
        'title'          : (('Xmp.dc.title',                     True),
                            ('Iptc.Application2.ObjectName',     True),
                            ('Exif.Image.ImageDescription',      True),),
        'creator'        : (('Xmp.dc.creator',                   True),
                            ('Xmp.tiff.Artist',                  False),
                            ('Iptc.Application2.Byline',         True),
                            ('Exif.Image.Artist',                True),),
        'description'    : (('Xmp.dc.description',               True),
                            ('Iptc.Application2.Caption',        True),),
        'keywords'       : (('Xmp.dc.subject',                   True),
                            ('Iptc.Application2.Keywords',       True),),
        'copyright'      : (('Xmp.dc.rights',                    True),
                            ('Xmp.tiff.Copyright',               False),
                            ('Iptc.Application2.Copyright',      True),
                            ('Exif.Image.Copyright',             True),),
        'latitude'       : (('Exif.GPSInfo.GPSLatitude',         True),
                            ('Xmp.exif.GPSLatitude',             True),),
        'longitude'      : (('Exif.GPSInfo.GPSLongitude',        True),
                            ('Xmp.exif.GPSLongitude',            True),),
        'orientation'    : (('Exif.Image.Orientation',           True),),
        'soft_full'      : (('Exif.Image.ProcessingSoftware',    True),),
        'soft_name'      : (('Iptc.Application2.Program',        True),),
        'soft_vsn'       : (('Iptc.Application2.ProgramVersion', True),),
        }
    _list_items = ('keywords',)
    def __init__(self, path, parent=None):
        QtCore.QObject.__init__(self, parent)
        self._md = pyexiv2.ImageMetadata(path)
        self._md.read()
        self._new = False

    def save(self):
        if not self._new:
            return
        self.set_item('soft_full', 'Photini editor v%s_%s' % (version, release))
        self.set_item('soft_name', 'Photini editor')
        self.set_item('soft_vsn', '%s_%s' % (version, release))
        self._md.write()
        self._set_status(False)

    def has_GPS(self):
        return (('Xmp.exif.GPSLatitude' in self._md.xmp_keys) or
                ('Exif.GPSInfo.GPSLatitude' in self._md.exif_keys))

    def get_item(self, name):
        for key, required in self._keys[name]:
            family, group, tag = key.split('.')
            if key in self._md.xmp_keys:
                item = self._md[key]
                if item.type.split()[0] in ('bag', 'seq'):
                    return '; '.join(item.value)
                if item.type == 'Lang Alt':
                    return '; '.join(item.value.values())
                if item.type == 'GPSCoordinate':
                    return GPSvalue().from_xmp_string(item.raw_value)
                print key, item.type, item.value
                return item.value
            if key in self._md.iptc_keys:
                return '; '.join(map(lambda x: unicode(x, 'iso8859_1'),
                                     self._md[key].value))
            if key in self._md.exif_keys:
                value = self._md[key].value
                if isinstance(value, (datetime.datetime, (int, long))):
                    return value
                elif group == 'GPSInfo':
                    return GPSvalue().from_exif_string(
                        self._md[key].raw_value, self._md['%sRef' % key].value)
                else:
                    return unicode(value, 'iso8859_1')
        return None

    def set_item(self, name, value):
        if value == self.get_item(name):
            return
        if name in self._list_items:
            value = map(lambda x: x.strip(), value.split(';'))
            for i in reversed(range(len(value))):
                if not value[i]:
                    del value[i]
        elif isinstance(value, (str, unicode)):
            value = [value.strip()]
        if not value:
            self.del_item(name)
            return
        for key, required in self._keys[name]:
            if required or key in (self._md.xmp_keys +
                                   self._md.iptc_keys +
                                   self._md.exif_keys):
                family, group, tag = key.split('.')
                if family == 'Xmp':
                    new_tag = pyexiv2.XmpTag(key)
                    if new_tag.type.split()[0] in ('bag', 'seq'):
                        new_tag = pyexiv2.XmpTag(key, value)
                    elif new_tag.type == 'Lang Alt':
                        new_tag = pyexiv2.XmpTag(key, {'x-default': value[0]})
                    elif new_tag.type == 'GPSCoordinate':
                        new_tag.raw_value = value.to_xmp_string()
                    else:
                        raise KeyError("Unknown type %s" % new_tag.type)
                elif family == 'Iptc':
                    new_tag = pyexiv2.IptcTag(key, value)
                elif family == 'Exif':
                    new_tag = pyexiv2.ExifTag(key)
                    if group == 'GPSInfo':
                        new_tag.raw_value, ref = value.to_exif_string()
                        self._md['%sRef' % key] = ref
                    elif isinstance(value, (datetime.datetime, int, long)):
                        new_tag = pyexiv2.ExifTag(key, value)
                    else:
                        new_tag = pyexiv2.ExifTag(key, value[0])
                self._md[key] = new_tag
        self._set_status(True)

    def del_item(self, name):
        changed = False
        for key, required in self._keys[name]:
            if key in (self._md.xmp_keys +
                       self._md.iptc_keys +
                       self._md.exif_keys):
                del self._md[key]
                changed = True
        if changed:
            self._set_status(True)

    new_status = QtCore.pyqtSignal(bool)
    def _set_status(self, status):
        self._new = status
        self.new_status.emit(self._new)

    def changed(self):
        return self._new