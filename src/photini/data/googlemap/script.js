//  Photini - a simple photo metadata editor.
//  http://github.com/jim-easterbrook/Photini
//  Copyright (C) 2012-17  Jim Easterbrook  jim@jim-easterbrook.me.uk
//
//  This program is free software: you can redistribute it and/or
//  modify it under the terms of the GNU General Public License as
//  published by the Free Software Foundation, either version 3 of the
//  License, or (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
//  General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see
//  <http://www.gnu.org/licenses/>.

var geocoder;
var map;
var markers = {};

function initialize()
{
    var mapOptions = {
        center: new google.maps.LatLng(initData.lat, initData.lng),
        panControl: true,
        streetViewControl: false,
        zoom: initData.zoom,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        };
    map = new google.maps.Map(document.getElementById("mapDiv"), mapOptions);
    geocoder = new google.maps.Geocoder();
    google.maps.event.addListener(map, 'idle', newBounds);
    python.initialize_finished();
}

function newBounds()
{
    var centre = map.getCenter();
    python.new_bounds(centre.lat(), centre.lng(), map.getZoom());
}

function setView(lat, lng, zoom)
{
    map.setZoom(zoom)
    map.panTo(new google.maps.LatLng(lat, lng));
}

function getMapBounds()
{
    var map_bounds = map.getBounds();
    var map_sw = map_bounds.getSouthWest();
    var map_ne = map_bounds.getNorthEast();
    return [map_sw.lng(), map_ne.lat(), map_ne.lng(), map_sw.lat()];
}

function adjustBounds(lat0, lng0, lat1, lng1)
{
    map.fitBounds({north: lat0, east: lng0, south: lat1, west: lng1});
}

function fitPoints(points)
{
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < points.length; i++)
    {
        bounds.extend({lat: points[i][0], lng: points[i][1]});
    }
    var mapBounds = map.getBounds();
    var mapSpan = mapBounds.toSpan();
    var ne = bounds.getNorthEast();
    var sw = bounds.getSouthWest();
    bounds.extend({lat: ne.lat() + (mapSpan.lat() * 0.13),
                   lng: ne.lng() + (mapSpan.lng() * 0.04)});
    bounds.extend({lat: sw.lat() - (mapSpan.lat() * 0.04),
                   lng: sw.lng() - (mapSpan.lng() * 0.04)});
    ne = bounds.getNorthEast();
    sw = bounds.getSouthWest();
    if (mapBounds.contains(ne) && mapBounds.contains(sw))
        return;
    var span = bounds.toSpan();
    if (span.lat() > mapSpan.lat() || span.lng() > mapSpan.lng())
        map.fitBounds(bounds);
    else if (mapBounds.intersects(bounds))
        map.panToBounds(bounds);
    else
        map.panTo(bounds.getCenter());
}

function enableMarker(id, active)
{
    var marker = markers[id];
    if (!marker)
        return;
    if (active)
        marker.setOptions({
            icon: '',
            zIndex: 1
            });
    else
        marker.setOptions({
            icon: 'grey_marker.png',
            zIndex: 0
            });
}

function addMarker(id, lat, lng, active)
{
    var position = new google.maps.LatLng(lat, lng);
    if (markers[id])
    {
        markers[id].setPosition(position);
        return;
    }
    var marker = new google.maps.Marker({
        position: position,
        map: map,
        draggable: true,
        });
    markers[id] = marker;
    marker._id = id;
    google.maps.event.addListener(marker, 'click', function(event) {
            python.marker_click(this._id)
            });
    google.maps.event.addListener(marker, 'dragstart', function(event) {
        python.marker_click(this._id)
        });
    google.maps.event.addListener(marker, 'drag', function(event) {
        var loc = event.latLng;
        python.marker_drag(loc.lat(), loc.lng(), this._id);
        });
    google.maps.event.addListener(marker, 'dragend', function(event) {
        var loc = event.latLng;
        python.marker_drag(loc.lat(), loc.lng(), this._id);
        });
    enableMarker(id, active)
}

function delMarker(id)
{
    if (markers[id])
    {
        google.maps.event.clearInstanceListeners(markers[id]);
        markers[id].setMap(null);
        delete markers[id];
    }
}

function removeMarkers()
{
    for (var id in markers)
    {
        google.maps.event.clearInstanceListeners(markers[id]);
        markers[id].setMap(null);
    }
    markers = {};
}

function latLngFromPixel(x, y)
{
    // convert x, y to world coordinates
    var scale = Math.pow(2, map.getZoom());
    var nw = new google.maps.LatLng(
        map.getBounds().getNorthEast().lat(),
        map.getBounds().getSouthWest().lng()
        );
    var worldCoordinateNW = map.getProjection().fromLatLngToPoint(nw);
    var worldX = worldCoordinateNW.x + (x / scale);
    var worldY = worldCoordinateNW.y + (y / scale);
    // convert world coordinates to lat & lng
    var position = map.getProjection().fromPointToLatLng(
        new google.maps.Point(worldX, worldY));
    return [position.lat(), position.lng()];
}

function search(search_string)
{
    geocoder.geocode(
        {address: search_string, bounds: map.getBounds()},
        function(results, status) {
            if (status == google.maps.GeocoderStatus.OK)
            {
                for (i in results)
                {
                    var ne = results[i].geometry.viewport.getNorthEast();
                    var sw = results[i].geometry.viewport.getSouthWest();
                    python.search_result(ne.lat(), ne.lng(), sw.lat(), sw.lng(),
                                         results[i].formatted_address);
                }
            }
            else
                alert("Search fail, code:" + status);
            });
}
