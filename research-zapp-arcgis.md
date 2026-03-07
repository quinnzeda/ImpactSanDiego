# ZAPP & ArcGIS REST API — Research

Research compiled 2026-03-04 at 1:00 AM.

## What is ZAPP?

ZAPP (Zoning and Parcel Information Portal) is the City of San Diego's official web viewer for zoning and parcel data. It's built on **ArcGIS Online** and backed by the city's ArcGIS REST services at `webmaps.sandiego.gov`.

- **ZAPP App URL:** https://sandiego.maps.arcgis.com/apps/instant/sidebar/index.html?appid=75f6a5d68aee481f8ff48240bcaa1239
- **ZAPP Webmap:** https://sandiego.maps.arcgis.com/apps/mapviewer/index.html?webmap=6107e432fcad48f08e8b470f1bb7fbf9

## ⭐ CAN WE HIT IT PROGRAMMATICALLY? YES!

ZAPP is just a frontend for standard ArcGIS REST services. The underlying services are **publicly accessible** with no authentication required. We can query them directly via HTTP.

## ArcGIS REST Service Directory

**Root:** `https://webmaps.sandiego.gov/arcgis/rest/services`
**Server version:** 11.5

### Key Services for Permit Buddy

#### 1. Geocoder — Address to Coordinates
**Endpoint:** `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Accela_Locator/GeocodeServer`
- **Type:** GeocodeServer
- **Operations:** `findAddressCandidates`, `geocodeAddresses`, `reverseGeocode`, `suggest`
- **Input field:** `Address` (single-line address string)
- **Use:** Convert user's typed address → XY coordinates → use for spatial queries

```javascript
// Geocode an address
const url = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Accela_Locator/GeocodeServer/findAddressCandidates';
const params = new URLSearchParams({
  SingleLine: '1234 Main St, San Diego, CA',
  f: 'json',
  outFields: '*',
  maxLocations: 5
});
const response = await fetch(`${url}?${params}`);
const data = await response.json();
// data.candidates[0].location = { x: ..., y: ... }
// data.candidates[0].attributes = { ... }
```

**Also available:** `DSD/Accela_Locator_Suggest` for autocomplete/typeahead suggestions.

#### 2. Parcels — Property Boundaries & Info
**Endpoint:** `https://webmaps.sandiego.gov/arcgis/rest/services/GeocoderMerged/MapServer/1`
- **Layer:** PARCELS_ALL (ID: 1)
- **Type:** Feature Layer (Polygon)
- **Display field:** `OWN_NAME1`
- **Key fields:**
  - `APN` — Assessor Parcel Number (10 chars)
  - `APN_8` — 8-digit APN
  - `PARCELID` — Internal polygon ID
  - `OWN_NAME1` — Owner name
  - `SITUS_ADDRESS` — Property address
  - `NUCLEUS_USE_CD` — Land use code (225 types)
  - `NUCLEUS_ZONE_CD` — Generalized zone (9 types)
- **Max records per query:** 2000
- **Supports:** Statistics, OrderBy, Distinct, Pagination, SQL expressions

```javascript
// Query parcel by location (after geocoding)
const url = 'https://webmaps.sandiego.gov/arcgis/rest/services/GeocoderMerged/MapServer/1/query';
const params = new URLSearchParams({
  geometry: JSON.stringify({ x: 6284000, y: 1860000, spatialReference: { wkid: 2230 } }),
  geometryType: 'esriGeometryPoint',
  spatialRel: 'esriSpatialRelIntersects',
  outFields: 'APN,OWN_NAME1,SITUS_ADDRESS,NUCLEUS_USE_CD,NUCLEUS_ZONE_CD',
  returnGeometry: true,
  f: 'json'
});
const response = await fetch(`${url}?${params}`);
const data = await response.json();
// data.features[0].attributes = { APN: "...", ... }
```

**⚠️ Spatial Reference Note:** The coordinate system is WKID 2230 (NAD83 CA Zone 6, US Feet). Geocoder results may be in a different CRS — need to check and transform if needed.

#### 3. Zoning — Base Zone Designation
**Endpoint:** `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0`
- **Layer:** Official Zoning Map (ID: 0)
- **Description:** Base Zoning Map Service for DSD Accela
- **Use:** Get the actual base zone code (e.g., RM-2-4, RS-1-7) for a location

```javascript
// Query base zoning at a point
const url = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0/query';
const params = new URLSearchParams({
  geometry: JSON.stringify({ x: 6284000, y: 1860000, spatialReference: { wkid: 2230 } }),
  geometryType: 'esriGeometryPoint',
  spatialRel: 'esriSpatialRelIntersects',
  outFields: '*',
  returnGeometry: false,
  f: 'json'
});
const response = await fetch(`${url}?${params}`);
// Returns zone designation for that point
```

Also available: **Zoning Action Index** (layer 1) — predates Official Zoning Map, historical zoning changes.

#### 4. Zoning Overlays — Special Restrictions ⭐ CRITICAL
**Endpoint:** `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Overlay/MapServer`
- **Layers (11 total):**
  - `0` — Clairemont Mesa Height Limitation Overlay Zone
  - `1` — Coastal Height Limitation Overlay Zone
  - `2` — Coastal Overlay Zone (Permit Jurisdictions) ⚠️
  - `3` — Community Plan Implementation Overlay Zone (CPIOZ)
  - `4` — Mission Trails Design District
  - `5` — Mobile Home Park Overlay Zone
  - `6` — Outdoor Lighting Zones
  - `7` — Parking Impact Overlay Zone
  - `8` — Residential Tandem Parking Overlay Zone
  - `9` — Transit Area Overlay Zone
  - `10` — Urban Village Overlay Zone

```javascript
// Check ALL overlay zones at once using identify
const url = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Overlay/MapServer/identify';
const params = new URLSearchParams({
  geometry: JSON.stringify({ x: 6284000, y: 1860000 }),
  geometryType: 'esriGeometryPoint',
  sr: '2230',
  layers: 'all',
  tolerance: 3,
  mapExtent: '6280000,1856000,6290000,1866000',
  imageDisplay: '600,400,96',
  returnGeometry: false,
  f: 'json'
});
const response = await fetch(`${url}?${params}`);
// Returns which overlay zones apply to that point
```

#### 5. Other Useful DSD Layers
**`DSD/Planning`** — `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Planning/MapServer`
- Community plan areas, historic districts, etc.

**`DSD/Environment`** — `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Environment/MapServer`
- Environmental constraints, sensitive areas

**`DSD/Airports`** — `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Airports/MapServer`
- Airport influence areas (height restrictions)

**`DSD/Fire`** — `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Fire/MapServer`
- Very High Fire Hazard Severity Zones (affects building requirements)

**`DSD/Regulatory`** — `https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Regulatory/MapServer`
- Additional regulatory boundaries

### County-Level Parcels (Alternative)
**Endpoint:** `https://gis-public.sandiegocounty.gov/arcgis/rest/services/sdep_warehouse/PARCELS_ALL/MapServer`
- Covers entire county (city parcels are a subset)
- Has `NUCLEUS_ZONE_CD` for generalized zoning

## Recommended Query Flow for Permit Buddy

```
User types address
    ↓
1. Geocode: DSD/Accela_Locator/GeocodeServer/findAddressCandidates
    → Get XY coordinates + address candidates for autocomplete
    ↓
2. Parcel lookup: GeocoderMerged/MapServer/1/query (point-in-polygon)
    → Get APN, owner name, address, land use code, lot geometry
    ↓
3. Base zone: DSD/Zoning_Base/MapServer/0/query (point-in-polygon)
    → Get zone designation (e.g., RM-2-4, RS-1-7)
    ↓
4. Overlays: DSD/Zoning_Overlay/MapServer/identify (all layers)
    → Get Coastal, CPIOZ, Transit, Height Limit, Parking Impact overlays
    ↓
5. Additional checks: DSD/Fire, DSD/Environment, DSD/Airports
    → Fire zone, environmental constraints, airport restrictions
    ↓
6. Combine all data → Generate property card + pre-flight check
```

## Important Notes

- **No auth required** — all services are publicly accessible
- **Rate limits:** Unknown, but should be fine for hackathon demo
- **Spatial reference:** WKID 2230 (NAD83 CA Zone 6, US Feet) — NOT WGS84 lat/long
- **May need coordinate transformation** — geocoder might return lat/long, spatial queries need 2230
- **Max 2000 records per query** — fine for point queries, pagination needed for bulk
- **JSON format:** All endpoints support `f=json` parameter
