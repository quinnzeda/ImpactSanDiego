import { NextRequest, NextResponse } from "next/server";

// ArcGIS World Geocoder (public, no auth required)
const ARCGIS_GEOCODER =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

// City of San Diego ArcGIS REST services
const SD_WEBMAPS = "https://webmaps.sandiego.gov/arcgis/rest/services";

// San Diego County permit records (Socrata)
const SOCRATA_PERMITS = "https://data.sandiegocounty.gov/resource/dyzh-7eat.json";

export interface PropertyData {
  address?: string;
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
  near_transit?: boolean;
  past_permits: Array<{ number: string; type: string; year?: number; status?: string }>;
  data_sources: string[];
}

// Map San Diego zone code prefix to plain-English property type
function zoneToPropertyType(
  zoneCode: string
): PropertyData["property_type"] {
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
  if (z.startsWith("RS-1")) return "Single-Family Residential (low density)";
  if (z.startsWith("RS-1-")) return "Single-Family Residential";
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
  if (z.startsWith("CO")) return "Office Commercial";
  if (z.startsWith("IP")) return "Industrial Park";
  if (z.startsWith("IL")) return "Limited Industrial";
  return zoneCode;
}

// ── Geocode ─────────────────────────────────────────────

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const query = address.toLowerCase().includes("san diego") ? address : `${address}, San Diego, CA`;
    const url = `${ARCGIS_GEOCODER}?SingleLine=${encodeURIComponent(query)}&outSR=4326&forStorage=false&maxLocations=1&outFields=StAddr,City,RegionAbbr&f=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.score < 70) return null;
    return {
      lat: candidate.location.y,
      lng: candidate.location.x,
      formatted: candidate.address,
    };
  } catch {
    return null;
  }
}

// ── ArcGIS spatial query helper ──────────────────────────

async function arcgisPointQuery(
  serviceUrl: string,
  lat: number,
  lng: number,
  outFields = "*"
): Promise<Record<string, unknown> | null> {
  try {
    const geometry = encodeURIComponent(JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    const url = `${serviceUrl}/query?geometry=${geometry}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${encodeURIComponent(outFields)}&returnGeometry=false&f=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.features?.[0]?.attributes as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

// ── Past permits via Socrata ─────────────────────────────

async function fetchPastPermits(
  address: string
): Promise<Array<{ number: string; type: string; year?: number; status?: string }>> {
  try {
    const escaped = address.replace(/'/g, "''");
    const url = `${SOCRATA_PERMITS}?$where=upper(full_address) like upper('%25${encodeURIComponent(escaped)}%25')&$limit=10&$order=open_date DESC`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();
    return data.slice(0, 5).map((r) => ({
      number: String(r.record_id ?? ""),
      type: String(r.record_category ?? r.record_type ?? ""),
      year: r.open_date ? new Date(String(r.open_date)).getFullYear() : undefined,
      status: String(r.record_status ?? ""),
    }));
  } catch {
    return [];
  }
}

// ── Main lookup ──────────────────────────────────────────

async function lookupProperty(address: string): Promise<PropertyData> {
  const result: PropertyData = {
    overlays: [],
    is_coastal: false,
    is_historic: false,
    past_permits: [],
    data_sources: [],
  };

  // 1. Geocode
  const geo = await geocodeAddress(address);
  if (!geo) {
    return result; // can't do anything without coordinates
  }
  result.address = geo.formatted;
  result.lat = geo.lat;
  result.lng = geo.lng;
  result.data_sources.push("ArcGIS Geocoder");

  // 2. Parcel data (lot size, APN, year built) — try multiple known SD service paths
  const parcelServicePaths = [
    `${SD_WEBMAPS}/Webmaps/SD_WM_BoundaryParcels/MapServer/0`,
    `${SD_WEBMAPS}/Public/Parcel/MapServer/0`,
    `${SD_WEBMAPS}/Basemaps/SD_Parcels/MapServer/0`,
  ];

  for (const path of parcelServicePaths) {
    const parcel = await arcgisPointQuery(path, geo.lat, geo.lng, "APN,LOT_SQFT,SHAPE_Area,YEAR_BUILT,YR_BUILT,ZONING,ZONE_CODE,ZONE_NAME");
    if (parcel) {
      result.apn = String(parcel.APN ?? parcel.apn ?? "").trim() || undefined;
      const lotSqft = Number(parcel.LOT_SQFT ?? parcel.SHAPE_Area ?? 0);
      if (lotSqft > 0) result.lot_size_sqft = Math.round(lotSqft);
      const yearBuilt = Number(parcel.YEAR_BUILT ?? parcel.YR_BUILT ?? 0);
      if (yearBuilt > 1800) result.year_built = yearBuilt;
      const rawZone = String(parcel.ZONING ?? parcel.ZONE_CODE ?? parcel.ZONE_NAME ?? "").trim();
      if (rawZone) {
        result.zone_code = rawZone;
        result.zone_plain_english = zoneToPlainEnglish(rawZone);
        result.property_type = zoneToPropertyType(rawZone);
      }
      result.data_sources.push("SD Parcel (ArcGIS)");
      break;
    }
  }

  // 3. Zoning / overlay data
  const zoningServicePaths = [
    `${SD_WEBMAPS}/Webmaps/SD_WM_ZoningInfo/MapServer/0`,
    `${SD_WEBMAPS}/Public/Zoning/MapServer/0`,
    `${SD_WEBMAPS}/Zoning/Zoning/MapServer/0`,
  ];

  for (const path of zoningServicePaths) {
    const zoning = await arcgisPointQuery(path, geo.lat, geo.lng, "ZONE_NAME,ZONE_CODE,OVERLAYS,IS_HISTORIC,HISTORIC,IS_COASTAL,COASTAL,OVERLAY_ZONES");
    if (zoning) {
      if (!result.zone_code) {
        const rawZone = String(zoning.ZONE_CODE ?? zoning.ZONE_NAME ?? "").trim();
        if (rawZone) {
          result.zone_code = rawZone;
          result.zone_plain_english = zoneToPlainEnglish(rawZone);
          result.property_type = zoneToPropertyType(rawZone);
        }
      }
      // Check coastal
      const coastal = zoning.IS_COASTAL ?? zoning.COASTAL ?? zoning.OVERLAYS ?? "";
      if (String(coastal).toLowerCase().includes("coastal") || coastal === 1 || coastal === "Y") {
        result.is_coastal = true;
        if (!result.overlays.includes("Coastal Zone")) result.overlays.push("Coastal Zone");
      }
      // Check historic
      const historic = zoning.IS_HISTORIC ?? zoning.HISTORIC ?? "";
      if (String(historic).toLowerCase().includes("historic") || historic === 1 || historic === "Y") {
        result.is_historic = true;
        if (!result.overlays.includes("Historic District")) result.overlays.push("Historic District");
      }
      result.data_sources.push("SD Zoning (ArcGIS)");
      break;
    }
  }

  // 4. Coastal overlay — separate layer check
  if (!result.is_coastal) {
    const coastalPaths = [
      `${SD_WEBMAPS}/Webmaps/SD_WM_CoastalZone/MapServer/0`,
      `${SD_WEBMAPS}/Public/CoastalZone/MapServer/0`,
    ];
    for (const path of coastalPaths) {
      const coastal = await arcgisPointQuery(path, geo.lat, geo.lng, "OBJECTID");
      if (coastal) {
        result.is_coastal = true;
        if (!result.overlays.includes("Coastal Zone")) result.overlays.push("Coastal Zone");
        result.data_sources.push("SD Coastal Overlay (ArcGIS)");
        break;
      }
    }
  }

  // 5. Historic overlay — separate layer check
  if (!result.is_historic) {
    const historicPaths = [
      `${SD_WEBMAPS}/Webmaps/SD_WM_HistoricDistricts/MapServer/0`,
      `${SD_WEBMAPS}/Public/HistoricDistricts/MapServer/0`,
    ];
    for (const path of historicPaths) {
      const historic = await arcgisPointQuery(path, geo.lat, geo.lng, "OBJECTID,DISTRICT_NAME");
      if (historic) {
        result.is_historic = true;
        const districtName = String(historic.DISTRICT_NAME ?? "Historic District");
        if (!result.overlays.includes(districtName)) result.overlays.push(districtName);
        result.data_sources.push("SD Historic Districts (ArcGIS)");
        break;
      }
    }
  }

  // 6. Past permits via Socrata
  const streetPart = address.split(",")[0].trim();
  result.past_permits = await fetchPastPermits(streetPart);
  if (result.past_permits.length > 0) {
    result.data_sources.push("SD County Permits (Socrata)");
  }

  return result;
}

// ── Route handler ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address") || "";
  if (!address.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const data = await lookupProperty(address);
  return NextResponse.json(data);
}

// Export for internal use by other routes
export { lookupProperty };
export type { PropertyData as PropertyLookupData };
