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
  if (z.startsWith("CCPD")) return "Commercial Community Plan";
  return zoneCode;
}

// ── Geocode ─────────────────────────────────────────────

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formatted: string; city: string } | null> {
  try {
    const query = address.toLowerCase().includes("san diego") ? address : `${address}, San Diego, CA`;
    const url = `${ARCGIS_GEOCODER}?SingleLine=${encodeURIComponent(query)}&outSR=4326&forStorage=false&maxLocations=1&outFields=StAddr,City,RegionAbbr&f=json`;
    const res = await fetch(url, { cache: "no-store" });
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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`ArcGIS query failed (${res.status}): ${serviceUrl}`);
      return null;
    }
    const data = await res.json();
    const attrs = (data.features?.[0]?.attributes as Record<string, unknown>) ?? null;
    if (attrs) {
      console.log(`ArcGIS hit: ${serviceUrl} →`, JSON.stringify(attrs));
    }
    return attrs;
  } catch (e) {
    console.error(`ArcGIS error: ${serviceUrl}`, e);
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
  result.city = geo.city;
  result.lat = geo.lat;
  result.lng = geo.lng;
  result.data_sources.push("ArcGIS Geocoder");

  // 2–6. Run all parallel lookups concurrently after geocoding
  const streetPart = address.split(",")[0].trim();

  async function firstHit(paths: string[], fields: string) {
    for (const path of paths) {
      const r = await arcgisPointQuery(path, geo!.lat, geo!.lng, fields);
      if (r) return r;
    }
    return null;
  }

  const [parcel, zoning, coastal, historic, pastPermits] = await Promise.allSettled([
    firstHit(
      [
        `${SD_WEBMAPS}/DSD/Basemap/MapServer/15`,
        `${SD_WEBMAPS}/Public/Parcel/MapServer/0`,
        `${SD_WEBMAPS}/Basemaps/SD_Parcels/MapServer/0`,
      ],
      "*"
    ),
    firstHit(
      [
        `${SD_WEBMAPS}/DSD/Zoning_Base/MapServer/0`,
        `${SD_WEBMAPS}/Public/Zoning/MapServer/0`,
        `${SD_WEBMAPS}/Zoning/Zoning/MapServer/0`,
      ],
      "*"
    ),
    firstHit(
      [
        `${SD_WEBMAPS}/DSD/Zoning_Overlay/MapServer/2`,
        `${SD_WEBMAPS}/Public/CoastalZone/MapServer/0`,
      ],
      "*"
    ),
    firstHit(
      [
        `${SD_WEBMAPS}/Public/HistoricDistricts/MapServer/0`,
      ],
      "*"
    ),
    fetchPastPermits(streetPart),
  ]);

  // 2. Apply parcel data
  if (parcel.status === "fulfilled" && parcel.value) {
    const p = parcel.value;
    result.apn = String(p.APNID ?? p.APN ?? p.apn ?? "").trim() || undefined;
    const lotSqft = Number(p.LOT_SQFT ?? p.Shape_Area ?? p.SHAPE_Area ?? 0);
    if (lotSqft > 0) result.lot_size_sqft = Math.round(lotSqft);
    const acreage = Number(p.ACREAGE ?? 0);
    if (acreage > 0 && !result.lot_size_sqft) result.lot_size_sqft = Math.round(acreage * 43560);
    const yearBuilt = Number(p.YEAR_BUILT ?? p.YR_BUILT ?? 0);
    if (yearBuilt > 1800) result.year_built = yearBuilt;
    const rawZone = String(p.ZONING ?? p.ZONE_CODE ?? p.ZONE_NAME ?? "").trim();
    if (rawZone) {
      result.zone_code = rawZone;
      result.zone_plain_english = zoneToPlainEnglish(rawZone);
      result.property_type = zoneToPropertyType(rawZone);
    }
    result.data_sources.push("SD Parcel (ArcGIS)");
  }

  // 3. Apply zoning data
  if (zoning.status === "fulfilled" && zoning.value) {
    const z = zoning.value;
    if (!result.zone_code) {
      const rawZone = String(z.ZONE_CODE ?? z.ZONE_NAME ?? "").trim();
      if (rawZone) {
        result.zone_code = rawZone;
        result.zone_plain_english = zoneToPlainEnglish(rawZone);
        result.property_type = zoneToPropertyType(rawZone);
      }
    }
    const coastalVal = z.IS_COASTAL ?? z.COASTAL ?? z.OVERLAYS ?? "";
    if (String(coastalVal).toLowerCase().includes("coastal") || coastalVal === 1 || coastalVal === "Y") {
      result.is_coastal = true;
      if (!result.overlays.includes("Coastal Zone")) result.overlays.push("Coastal Zone");
    }
    const historicVal = z.IS_HISTORIC ?? z.HISTORIC ?? "";
    if (String(historicVal).toLowerCase().includes("historic") || historicVal === 1 || historicVal === "Y") {
      result.is_historic = true;
      if (!result.overlays.includes("Historic District")) result.overlays.push("Historic District");
    }
    result.data_sources.push("SD Zoning (ArcGIS)");
  }

  // 4. Apply coastal overlay
  if (!result.is_coastal && coastal.status === "fulfilled" && coastal.value) {
    result.is_coastal = true;
    if (!result.overlays.includes("Coastal Zone")) result.overlays.push("Coastal Zone");
    result.data_sources.push("SD Coastal Overlay (ArcGIS)");
  }

  // 5. Apply historic overlay
  if (!result.is_historic && historic.status === "fulfilled" && historic.value) {
    result.is_historic = true;
    const districtName = String(historic.value.DISTRICT_NAME ?? "Historic District");
    if (!result.overlays.includes(districtName)) result.overlays.push(districtName);
    result.data_sources.push("SD Historic Districts (ArcGIS)");
  }

  // 6. Apply past permits
  result.past_permits = pastPermits.status === "fulfilled" ? pastPermits.value : [];
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
