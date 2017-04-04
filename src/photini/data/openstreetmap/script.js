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

var map;
var markers = {};

function initialize()
{
  map = L.map("mapDiv", {
    center: [initData.lat, initData.lng],
    zoom: initData.zoom,
    attributionControl: false
  });
  var tiles = new L.StamenTileLayer("terrain");
  map.addLayer(tiles);
  map.on('moveend zoomend', newBounds);
  python.initialize_finished();
}

function newBounds(event)
{
  var centre = map.getCenter();
  python.new_bounds(centre.lat, centre.lng, map.getZoom());
}

function setView(lat, lng, zoom)
{
  map.setView(new L.LatLng(lat, lng), zoom);
}

function getMapBounds()
{
  var map_bounds = map.getBounds();
  var map_sw = map_bounds.getSouthWest();
  var map_ne = map_bounds.getNorthEast();
  return [map_sw.lng, map_ne.lat, map_ne.lng, map_sw.lat];
}

function adjustBounds(lat0, lng0, lat1, lng1)
{
    map.fitBounds([[lat0, lng0], [lat1, lng1]]);
}

function fitPoints(points)
{
    var bounds = L.latLngBounds(points);
    map.fitBounds(bounds,
        {paddingTopLeft: [15, 50], paddingBottomRight: [15, 10], maxZoom: map.getZoom()});
}

function enableMarker(id, active)
{
  var marker = markers[id];
  if (marker)
  {
    if (active)
    {
      marker.setZIndexOffset(1000);
      marker.setIcon(new L.Icon.Default());
    }
    else
    {
      marker.setZIndexOffset(0);
      marker.setIcon(new L.Icon({
        iconUrl: 'grey_marker.png',
        iconSize: [25, 40],
        iconAnchor: [13, 40],
      }));
    }
  }
}

function addMarker(id, lat, lng, active)
{
  if (markers[id])
  {
    markers[id].setLatLng([lat, lng]);
    return;
  }
  var marker =  L.marker([lat, lng], {
    draggable: true,
  });
  marker.addTo(map);
  markers[id] = marker;
  marker._id = id;
  marker.on('click', markerClick);
  marker.on('drag', markerDrag);
  marker.on('dragend', markerDragEnd);
  enableMarker(id, active)
}

function markerClick(event)
{
  python.marker_click(this._id);
}

function markerDrag(event)
{
  var loc = this.getLatLng();
  python.marker_click(this._id);
  python.marker_drag(loc.lat, loc.lng, this._id);
}

function markerDragEnd(event)
{
  var loc = this.getLatLng();
  python.marker_drag(loc.lat, loc.lng, this._id);
}

function delMarker(id)
{
  if (markers[id])
  {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
}

function removeMarkers()
{
  for (var id in markers)
    map.removeLayer(markers[id]);
  markers = {};
}

function latLngFromPixel(x, y)
{
  var position = map.containerPointToLatLng([x, y]);
  return [position.lat, position.lng];
}
