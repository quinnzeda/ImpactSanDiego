// ArcGIS World Geocoder (public, no auth required)
const ARCGIS_GEOCODER =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

// City of San Diego ArcGIS REST services
const SD_WEBMAPS = "https://webmaps.sandiego.gov/arcgis/rest/services";

export interface PropertyZoningData {
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  apn?: string;
  zone_code?: string;
  zone_plain_english?: string;
  lot_size_sqft?: number;
  year_built?: number;
  property_type?: "single-family" | "multi-family" | "commercial" | "industrial" | "unknown";
  overlays: string[];
  is_coastal: boolean;
  is_historic: boolean;
  data_sources: string[];
}

function zoneToPropertyType(zoneCode: string): PropertyZoningData["property_type"] {
  const z = zoneCode.toUpperCase();
  if (z.startsWith("RS") || z.startsWith("RE") || z.startsWith("RX")) return "single-family";
  if (z.startsWith("RM") || z.startsWith("RT") || z.startsWith("RV")) return "multi-family";
  if (
    z.startsWith("CX") ||
    z.startsWith("CN") ||
    z.startsWith("CV") ||
    z.startsWith("CO") ||
    z.startsWith("CC") ||
    z.startsWith("CR") ||
    z.startsWith("CT")
  )
    return "commercial";
  if (z.startsWith("IP") || z.startsWith("IL") || z.startsWith("IS")) return "industrial";
  return "unknown";
}

function zoneToPlainEnglish(zoneCode: string): string {
  const z = zoneCode.toUpperCase();
  if (z.startsWith("RS-1-")) return "Single-Family Residential";
  if (z.startsWith("RS-1")) return "Single-Family Residential (low density)";
  if (z.startsWith("RS")) return "Single-Family Residential";
  if (z.startsWith("RE")) return "Residential Estate";
  if (z.startsWith("RM-1")) return "Multi-Family Residential (low density)";
  if (z.startsWith("RM-2")) return "Multi-Family Residential (medium density)";
  if (z.startsWith("RM-3")) return "Multi-Family Residential (high density)";
  if (z.startsWith("RM")) return "Multi-Family Residential";
  if (z.startsWith("RT")) return "Residential Two-Family";
  if (z.startsWith("CX")) return "Mixed Commercial";
  if (z.startsWith("CN")) return "Neighborhood Commercial";
  if (z.startsWith("CV")) return "Visitor Commercial";
  if (z.startsWith("CC")) return "Commercial Community";
  if (z.startsWith("CO")) return "Office Commercial";
  if (z.startsWith("CR")) return "Regional Commercial";
  if (z.startsWith("CT")) return "Tourist Commercial";
  if (z.startsWith("IP")) return "Industrial Park";
  if (z.startsWith("IL")) return "Limited Industrial";
  if (z.startsWith("IS")) return "Scientific Research Industrial";
  return zoneCode;
}

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formatted: string; city: string } | null> {
  try {
    const query = address.toLowerCase().includes("san diego") ? address : `${address}, San Diego, CA`;
    const url = `${ARCGIS_GEOCODER}?SingleLine=${encodeURIComponent(query)}&outSR=4326&forStorage=false&maxLocations=1&outFields=StAddr,City,RegionAbbr&f=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.score < 70) return null;
    return {
      lat: candidate.location.y,
      lng: candidate.location.x,
      formatted: candidate.address,
      city: candidate.attributes?.City ?? "",
    };
  } catch {
    return null;
  }
}

async function arcgisPointQuery(
  serviceUrl: string,
  lat: number,
  lng: number,
  outFields = "*"
): Promise<Record<string, unknown> | null> {
  try {
    const geometry = encodeURIComponent(JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    const url = `${serviceUrl}/query?geometry=${geometry}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${encodeURIComponent(outFields)}&returnGeometry=false&f=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.features?.[0]?.attributes as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function lookupPropertyZoning(address: string): Promise<PropertyZoningData> {
  const result: PropertyZoningData = {
    overlays: [],
    is_coastal: false,
    is_historic: false,
    data_sources: [],
  };

  // 1. Geocode
  const geo = await geocodeAddress(address);
  if (!geo) {
    return result;
  }
  result.address = geo.formatted;
  result.city = geo.city;
  result.lat = geo.lat;
  result.lng = geo.lng;
  result.data_sources.push("ArcGIS Geocoder");

  // Early return: skip expensive SD-specific queries for out-of-jurisdiction addresses
  if (geo.city && geo.city.toLowerCase() !== "san diego") {
    return result;
  }

  // 2. Parcel data (lot size, APN) from DSD/Basemap Lots layer
  const lotsUrl = `${SD_WEBMAPS}/DSD/Basemap/MapServer/15`;
  const parcel = await arcgisPointQuery(lotsUrl, geo.lat, geo.lng, "APNID,Shape_Area,ACREAGE");
  if (parcel) {
    const apnId = String(parcel.APNID ?? "").trim();
    if (apnId) result.apn = apnId;
    // Shape_Area is in sq feet (projected CRS)
    const area = Number(parcel.Shape_Area ?? 0);
    if (area > 0) result.lot_size_sqft = Math.round(area);
    const acreage = Number(parcel.ACREAGE ?? 0);
    if (acreage > 0 && !result.lot_size_sqft) result.lot_size_sqft = Math.round(acreage * 43560);
    result.data_sources.push("SD Parcels (ArcGIS DSD/Basemap)");
  }

  // 3. Base zoning from DSD/Zoning_Base
  const zoningUrl = `${SD_WEBMAPS}/DSD/Zoning_Base/MapServer/0`;
  const zoning = await arcgisPointQuery(zoningUrl, geo.lat, geo.lng, "ZONE_NAME");
  if (zoning) {
    const rawZone = String(zoning.ZONE_NAME ?? "").trim();
    if (rawZone) {
      result.zone_code = rawZone;
      result.zone_plain_english = zoneToPlainEnglish(rawZone);
      result.property_type = zoneToPropertyType(rawZone);
    }
    result.data_sources.push("SD Zoning Base (ArcGIS DSD/Zoning_Base)");
  }

  // 4. Zoning overlays from DSD/Zoning_Overlay (11 layers)
  const overlayLayers = [
    { id: 0, name: "Clairemont Mesa Height Limitation" },
    { id: 1, name: "Coastal Height Limitation" },
    { id: 2, name: "Coastal Zone" },
    { id: 3, name: "Community Plan Implementation" },
    { id: 4, name: "Mission Trails Design District" },
    { id: 5, name: "Mobile Home Park" },
    { id: 7, name: "Parking Impact" },
    { id: 8, name: "Residential Tandem Parking" },
    { id: 9, name: "Transit Area" },
    { id: 10, name: "Urban Village" },
  ];

  const overlayChecks = overlayLayers.map(async (layer) => {
    const url = `${SD_WEBMAPS}/DSD/Zoning_Overlay/MapServer/${layer.id}`;
    const hit = await arcgisPointQuery(url, geo.lat, geo.lng, "OBJECTID");
    if (hit) {
      result.overlays.push(layer.name);
      if (layer.id === 2) result.is_coastal = true;
    }
  });
  await Promise.all(overlayChecks);
  if (result.overlays.length > 0) {
    result.data_sources.push("SD Zoning Overlays (ArcGIS DSD/Zoning_Overlay)");
  }

  return result;
}
