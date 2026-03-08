/**
 * Accela Civic Platform API client for City of San Diego.
 *
 * Uses the official Accela REST API v4 with OAuth password grant:
 *   - POST /v4/search/records   — search permits by address, type, status, date
 *   - POST /v4/search/addresses — search reference addresses
 *   - POST /v4/search/parcels   — search parcels by APN, owner, address
 *   - GET  /v4/records/{ids}    — get record detail with expand
 *
 * Auth: OAuth2 password grant via auth.accela.com → bearer token.
 * Falls back to CSV (permits-loader) when Accela is unavailable.
 */

import { loadPermits, searchPermits, getPermitStats } from "./permits-loader.js";

// ── Configuration ────────────────────────────────────────

const ACCELA_BASE = "https://apis.accela.com/v4";
const ACCELA_AUTH_URL = "https://auth.accela.com/oauth2/token";
const getAccelaConfig = () => ({
  appId: process.env.ACCELA_APP_ID || "",
  appSecret: process.env.ACCELA_APP_SECRET || "",
  username: process.env.ACCELA_USERNAME || "",
  password: process.env.ACCELA_PASSWORD || "",
  agency: process.env.ACCELA_AGENCY || "SANDIEGO",
  env: process.env.ACCELA_ENVIRONMENT || "PROD",
});

// ── Token Management ─────────────────────────────────────

let _cachedToken: string | null = null;
let _tokenExpiry = 0;
let _refreshToken: string | null = null;

async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 60_000) {
    return _cachedToken;
  }

  const config = getAccelaConfig();
  if (!config.appId || !config.username || !config.password) {
    return null;
  }

  // Try refresh token first
  if (_refreshToken) {
    try {
      const token = await requestToken({
        grant_type: "refresh_token",
        client_id: config.appId,
        client_secret: config.appSecret,
        refresh_token: _refreshToken,
      });
      if (token) return token;
    } catch {
      // Refresh failed, fall through to password grant
    }
  }

  // Password grant
  return requestToken({
    grant_type: "password",
    client_id: config.appId,
    client_secret: config.appSecret,
    username: config.username,
    password: config.password,
    scope: "get_records search_records search_addresses search_parcels",
    agency_name: config.agency,
    environment: config.env,
  });
}

async function requestToken(params: Record<string, string>): Promise<string | null> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(ACCELA_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Accela auth error: ${res.status} — ${err.error_description || err.error || "unknown"}`);
    return null;
  }

  const data = await res.json();
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 900) * 1000;
  _refreshToken = data.refresh_token || _refreshToken;
  console.error(`Accela: Token acquired (expires in ${data.expires_in}s)`);
  return _cachedToken;
}

async function getHeaders(): Promise<Record<string, string>> {
  const config = getAccelaConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-accela-appid": config.appId,
    "x-accela-agency": config.agency,
    "x-accela-environment": config.env,
  };
  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = token;
  }
  return headers;
}

// ── Rate Limiting ────────────────────────────────────────

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 150; // ~6 requests/sec max

async function throttledFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

// ── Interfaces ───────────────────────────────────────────

export interface AccelaAddress {
  id?: number;
  addressLine1?: string;
  addressLine2?: string;
  streetAddress?: string;
  streetName?: string;
  streetPrefix?: string;
  streetSuffix?: string;
  streetSuffixDirection?: string;
  streetStart?: number;
  streetEnd?: number;
  houseAlphaStart?: string;
  houseAlphaEnd?: string;
  unitStart?: string;
  unitEnd?: string;
  unitType?: string;
  city?: string;
  county?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  direction?: string;
  description?: string;
  inspectionDistrict?: string;
  neighborhood?: string;
  xCoordinate?: number;
  yCoordinate?: number;
  status?: string;
  isPrimary?: string;
}

export interface AccelaParcel {
  id?: string;
  parcelNumber?: string;
  parcel?: string;
  block?: string;
  lot?: string;
  legalDescription?: string;
  subdivision?: string;
  status?: string;
  isPrimary?: string;
  parcelArea?: number;
  landValue?: number;
  improvedValue?: number;
  exemptionValue?: number;
  censusTract?: string;
  councilDistrict?: string;
  supervisorDistrict?: string;
  township?: string;
  range?: string;
  section?: string;
  book?: string;
  page?: string;
  mapNumber?: string;
  tract?: string;
  planArea?: string;
  addresses?: AccelaAddress[];
  owners?: AccelaOwner[];
}

export interface AccelaOwner {
  id?: number;
  ownerFullName?: string;
  mailAddress1?: string;
  mailCity?: string;
  mailState?: string;
  mailZip?: string;
  phone?: string;
  email?: string;
  status?: string;
  isPrimary?: string;
}

export interface AccelaContact {
  id?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone1?: string;
  type?: { value?: string; text?: string };
  isPrimary?: string;
}

export interface AccelaCondition {
  id?: number;
  name?: string;
  description?: string;
  status?: { value?: string; text?: string };
  type?: { value?: string; text?: string };
  severity?: { value?: string; text?: string };
  issuedDate?: string;
}

export interface AccelaRecord {
  id?: string;
  customId?: string;
  module?: string;
  name?: string;
  description?: string;
  type?: {
    group?: string;
    type?: string;
    subType?: string;
    category?: string;
    value?: string;
    text?: string;
  };
  status?: {
    value?: string;
    text?: string;
  };
  openedDate?: string;
  closedDate?: string;
  completedDate?: string;
  statusDate?: string;
  priority?: { value?: string; text?: string };
  jobValue?: number;
  estimatedTotalJobCost?: number;
  totalFee?: number;
  balance?: number;
  assignedUser?: string;
  assignedToDepartment?: string;
  addresses?: AccelaAddress[];
  parcels?: AccelaParcel[];
  contacts?: AccelaContact[];
  conditions?: AccelaCondition[];
  owners?: AccelaOwner[];
}

/** Normalized permit — superset compatible with old PermitRecord shape */
export interface NormalizedPermit {
  // Backward-compatible fields (match old PermitRecord)
  project_id: string;
  approval_id: string;
  project_title: string;
  project_scope: string;
  approval_type: string;
  approval_status: string;
  address: string;
  apn: string;
  lat: string;
  lng: string;
  date_created: string;
  date_issued: string;
  valuation: string;
  // New Accela-specific fields
  accela_record_id?: string;
  module?: string;
  contacts?: AccelaContact[];
  conditions?: AccelaCondition[];
  owners?: AccelaOwner[];
  parcels?: AccelaParcel[];
  source: "accela" | "csv";
}

// ── Status & Type Mapping ────────────────────────────────

const STATUS_MAP: Record<string, string[]> = {
  issued: ["APPROVED"],
  approved: ["APPROVED"],
  active: ["OPEN"],
  open: ["OPEN"],
  "in review": ["OPEN", "PENDING"],
  pending: ["PENDING"],
  closed: ["CLOSED", "COMPLETE"],
  completed: ["COMPLETE"],
  finaled: ["COMPLETE"],
  expired: ["CLOSED"],
  denied: ["DENIED"],
  cancelled: ["VOID"],
  void: ["VOID"],
};

function mapStatusToAccela(status: string): string[] | undefined {
  const key = status.toLowerCase().trim();
  return STATUS_MAP[key];
}

// ── Connection Validation ────────────────────────────────

let _accelaAvailable: boolean | null = null;

export function isAccelaConfigured(): boolean {
  const config = getAccelaConfig();
  return config.appId.length > 0 && config.username.length > 0 && config.password.length > 0;
}

export async function validateAccelaConnection(): Promise<boolean> {
  if (!isAccelaConfigured()) {
    console.error("Accela API: No ACCELA_APP_ID configured. Using CSV fallback.");
    _accelaAvailable = false;
    return false;
  }

  try {
    const res = await throttledFetch(
      `${ACCELA_BASE}/search/addresses?limit=1`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({ city: "San Diego" }),
      }
    );

    if (res.ok) {
      console.error(`Accela API: Connection verified (agency: ${getAccelaConfig().agency}, env: ${getAccelaConfig().env})`);
      _accelaAvailable = true;
      return true;
    }

    const data = await res.json().catch(() => ({}));
    console.error(`Accela API: Connection check returned ${res.status} — ${data.message || data.code || "unknown error"}`);

    // anonymous_user_unavailable means app ID works but agency hasn't enabled citizen access
    if (data.code === "anonymous_user_unavailable") {
      console.error("Accela API: Agency has not enabled anonymous citizen access. Will attempt with access token if available.");
    }

    _accelaAvailable = false;
    return false;
  } catch (err) {
    console.error("Accela API: Unreachable —", err);
    _accelaAvailable = false;
    return false;
  }
}

async function isAccelaAvailable(): Promise<boolean> {
  if (_accelaAvailable !== null) return _accelaAvailable;
  return validateAccelaConnection();
}

// ── Search Addresses ─────────────────────────────────────

export async function accelaSearchAddresses(params: {
  streetName?: string;
  streetStart?: number;
  city?: string;
  postalCode?: string;
  neighborhood?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: AccelaAddress[]; total: number }> {
  if (!(await isAccelaAvailable())) {
    return { results: [], total: 0 };
  }

  const limit = params.limit || 20;
  const offset = params.offset || 0;

  const body: Record<string, unknown> = {};
  if (params.streetName) body.streetName = `%${params.streetName}%`;
  if (params.streetStart) body.streetStart = params.streetStart;
  if (params.city) body.city = params.city;
  if (params.postalCode) body.postalCode = params.postalCode;
  if (params.neighborhood) body.neighborhood = `%${params.neighborhood}%`;

  try {
    const url = `${ACCELA_BASE}/search/addresses?limit=${limit}&offset=${offset}`;
    const res = await throttledFetch(url, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Accela search/addresses error: ${res.status} — ${err.message || ""}`);
      return { results: [], total: 0 };
    }

    const data = await res.json();
    const results = (data.result || []) as AccelaAddress[];
    return { results, total: results.length };
  } catch (error) {
    console.error("Accela search/addresses error:", error);
    return { results: [], total: 0 };
  }
}

// ── Search Parcels ───────────────────────────────────────

export async function accelaSearchParcels(params: {
  parcelNumber?: string;
  ownerName?: string;
  streetName?: string;
  city?: string;
  block?: string;
  lot?: string;
  subdivision?: string;
  limit?: number;
  offset?: number;
  expand?: string[];
}): Promise<{ results: AccelaParcel[]; total: number }> {
  if (!(await isAccelaAvailable())) {
    return { results: [], total: 0 };
  }

  const limit = params.limit || 20;
  const offset = params.offset || 0;
  const expand = params.expand || ["addresses", "owners"];

  const body: Record<string, unknown> = {};
  if (params.parcelNumber) body.parcelNumber = `%${params.parcelNumber}%`;
  if (params.block) body.block = params.block;
  if (params.lot) body.lot = params.lot;
  if (params.subdivision) body.subdivision = `%${params.subdivision}%`;
  if (params.ownerName) {
    body.owner = { ownerFullName: `%${params.ownerName}%` };
  }
  if (params.streetName || params.city) {
    const address: Record<string, string> = {};
    if (params.streetName) address.streetName = `%${params.streetName}%`;
    if (params.city) address.city = params.city;
    body.address = address;
  }

  try {
    const expandStr = expand.join(",");
    const url = `${ACCELA_BASE}/search/parcels?limit=${limit}&offset=${offset}&expand=${expandStr}`;
    const res = await throttledFetch(url, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Accela search/parcels error: ${res.status} — ${err.message || ""}`);
      return { results: [], total: 0 };
    }

    const data = await res.json();
    const results = (data.result || []) as AccelaParcel[];
    return { results, total: results.length };
  } catch (error) {
    console.error("Accela search/parcels error:", error);
    return { results: [], total: 0 };
  }
}

// ── Search Records ───────────────────────────────────────

export async function accelaSearchRecords(params: {
  address?: string;
  type?: string;
  status?: string;
  customId?: string;
  dateFrom?: string;
  dateTo?: string;
  parcel?: string;
  module?: string;
  query?: string;
  limit?: number;
  offset?: number;
  expand?: string[];
}): Promise<{ results: AccelaRecord[]; total: number }> {
  if (!(await isAccelaAvailable())) {
    return { results: [], total: 0 };
  }

  const limit = params.limit || 20;
  const offset = params.offset || 0;
  const expand = params.expand || ["addresses"];

  const body: Record<string, unknown> = {};

  // Module — default to Building for San Diego permits
  if (params.module) body.module = params.module;

  // Address — use wildcard matching
  if (params.address) {
    body.address = { addressLine1: `%${params.address}%` };
  }

  // Type — pass as-is, Accela uses hierarchical type (e.g., "Building/Residential/Permit/NA")
  if (params.type) {
    body.type = { value: `%${params.type}%` };
  }

  // Status — map user-friendly names to Accela status types
  if (params.status) {
    const mapped = mapStatusToAccela(params.status);
    if (mapped) {
      body.statusTypes = mapped;
    } else {
      body.status = { value: `%${params.status}%` };
    }
  }

  // Direct record number lookup
  if (params.customId) {
    body.customId = params.customId;
  }

  // Date range — openedDate
  if (params.dateFrom) body.openedDateFrom = `${params.dateFrom} 00:00:00`;
  if (params.dateTo) body.openedDateTo = `${params.dateTo} 23:59:59`;

  // Parcel (APN)
  if (params.parcel) {
    body.parcel = { parcelNumber: `%${params.parcel}%` };
  }

  // Description wildcard search
  if (params.query) {
    body.description = `%${params.query}%`;
  }

  // Sort by newest first
  body.sort = "openedDate";
  body.direction = "DESC";

  try {
    const expandStr = expand.join(",");
    const url = `${ACCELA_BASE}/search/records?limit=${limit}&offset=${offset}&expand=${expandStr}`;
    const res = await throttledFetch(url, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Accela search/records error: ${res.status} — ${err.message || ""}`);
      return { results: [], total: 0 };
    }

    const data = await res.json();
    const results = (data.result || []) as AccelaRecord[];
    return { results, total: results.length };
  } catch (error) {
    console.error("Accela search/records error:", error);
    return { results: [], total: 0 };
  }
}

// ── Get Record Detail ────────────────────────────────────

export async function accelaGetRecord(
  recordId: string,
  expand?: string[]
): Promise<AccelaRecord | null> {
  if (!(await isAccelaAvailable())) {
    return null;
  }

  const expandList = expand || ["addresses", "parcels", "contacts", "conditions"];
  const expandStr = expandList.join(",");

  try {
    const url = `${ACCELA_BASE}/records/${encodeURIComponent(recordId)}?expand=${expandStr}`;
    const res = await throttledFetch(url, {
      method: "GET",
      headers: await getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Accela GET record error: ${res.status} — ${err.message || ""}`);
      return null;
    }

    const data = await res.json();
    return (data.result?.[0] || data.result || null) as AccelaRecord | null;
  } catch (error) {
    console.error("Accela GET record error:", error);
    return null;
  }
}

// ── Normalization ────────────────────────────────────────

export function normalizeAccelaRecord(record: AccelaRecord): NormalizedPermit {
  const addr = record.addresses?.[0];
  const parcel = record.parcels?.[0];

  const streetNum = addr?.streetStart || addr?.streetEnd || "";
  const streetName = addr?.streetName || "";
  const addressLine = addr?.addressLine1 || addr?.streetAddress || `${streetNum} ${streetName}`.trim();
  const city = addr?.city || "San Diego";
  const fullAddress = addressLine ? `${addressLine}, ${city}` : "";

  return {
    project_id: record.id || "",
    approval_id: record.customId || record.id || "",
    project_title: record.name || record.description || "",
    project_scope: record.description || "",
    approval_type: record.type?.text || record.type?.value || record.type?.type || "",
    approval_status: record.status?.text || record.status?.value || "",
    address: fullAddress,
    apn: parcel?.parcelNumber || "",
    lat: addr?.yCoordinate?.toString() || "",
    lng: addr?.xCoordinate?.toString() || "",
    date_created: record.openedDate || "",
    date_issued: record.closedDate || record.completedDate || "",
    valuation: (record.jobValue || record.estimatedTotalJobCost || 0).toString(),
    // Extended fields
    accela_record_id: record.id,
    module: record.module,
    contacts: record.contacts,
    conditions: record.conditions,
    owners: record.owners,
    parcels: record.parcels,
    source: "accela",
  };
}

// ── Unified Search (Accela-first, CSV fallback) ──────────

export async function searchCityPermits(params: {
  address?: string;
  approval_type?: string;
  status?: string;
  project_id?: string;
  date_from?: string;
  date_to?: string;
  parcel?: string;
  query?: string;
  limit?: number;
}): Promise<{
  results: NormalizedPermit[];
  total: number;
  source: string;
}> {
  const limit = params.limit || 20;

  // Try Accela first
  if (isAccelaConfigured()) {
    const { results, total } = await accelaSearchRecords({
      address: params.address,
      type: params.approval_type,
      status: params.status,
      customId: params.project_id,
      dateFrom: params.date_from,
      dateTo: params.date_to,
      parcel: params.parcel,
      query: params.query,
      limit,
      expand: ["addresses", "parcels"],
    });

    if (results.length > 0 || _accelaAvailable) {
      return {
        results: results.map(normalizeAccelaRecord),
        total,
        source: "City of San Diego (Accela API, live)",
      };
    }
  }

  // Fallback to CSV
  console.error("Accela unavailable — falling back to CSV bulk data");
  const permits = await loadPermits();
  if (permits.length === 0) {
    return { results: [], total: 0, source: "CSV (loading)" };
  }

  const filtered = searchPermits(
    permits,
    {
      address: params.address,
      approval_type: params.approval_type,
      status: params.status,
      project_id: params.project_id,
    },
    limit
  );

  return {
    results: filtered.map((p) => ({
      ...p,
      source: "csv" as const,
    })),
    total: filtered.length,
    source: "City of San Diego (Open Data CSV, cached)",
  };
}

// ── Unified Detail Lookup (Accela-first, CSV fallback) ───

export async function lookupCityPermit(params: {
  record_id?: string;
  address?: string;
}): Promise<{
  results: NormalizedPermit[];
  source: string;
  detail_url?: string;
}> {
  // Try Accela direct lookup
  if (params.record_id && isAccelaConfigured()) {
    const record = await accelaGetRecord(params.record_id, [
      "addresses", "parcels", "contacts", "conditions",
    ]);
    if (record) {
      return {
        results: [normalizeAccelaRecord(record)],
        source: "City of San Diego (Accela API, live)",
      };
    }
  }

  // Try Accela search by address
  if (params.address && isAccelaConfigured()) {
    const { results } = await accelaSearchRecords({
      address: params.address,
      limit: 10,
      expand: ["addresses", "parcels", "contacts", "conditions"],
    });
    if (results.length > 0) {
      return {
        results: results.map(normalizeAccelaRecord),
        source: "City of San Diego (Accela API, live)",
      };
    }
  }

  // Fallback to CSV
  const permits = await loadPermits();
  const filtered = searchPermits(
    permits,
    {
      project_id: params.record_id,
      address: params.address,
    },
    10
  );

  return {
    results: filtered.map((p) => ({
      ...p,
      source: "csv" as const,
    })),
    source: "City of San Diego (Open Data CSV, cached)",
    detail_url: filtered[0]
      ? `https://opendsd.sandiego.gov/Web/Approvals/Details/${filtered[0].approval_id}`
      : undefined,
  };
}

// ── Stats (Accela parallel queries + CSV fallback) ───────

const statsCache = new Map<string, { data: unknown; expires: number }>();
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCityPermitStats(params: {
  type?: string;
  area?: string;
}): Promise<{
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  avg_valuation: number;
  source: string;
}> {
  const cacheKey = `stats:${params.type || ""}:${params.area || ""}`;
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as ReturnType<typeof getCityPermitStats> extends Promise<infer T> ? T : never;
  }

  // Always use CSV for stats — Accela doesn't support bulk aggregation efficiently
  // CSV gives us 256K+ records for proper breakdowns
  console.error("Stats: Using CSV bulk data for aggregation");
  const permits = await loadPermits();
  if (permits.length === 0) {
    return {
      total: 0,
      by_type: {},
      by_status: {},
      avg_valuation: 0,
      source: "CSV (loading)",
    };
  }

  const stats = getPermitStats(permits, { type: params.type, area: params.area });
  const result = {
    ...stats,
    source: "City of San Diego (Open Data, 256K+ records)",
  };

  statsCache.set(cacheKey, { data: result, expires: Date.now() + STATS_CACHE_TTL });
  return result;
}
