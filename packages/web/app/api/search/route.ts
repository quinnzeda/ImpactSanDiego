import { NextRequest, NextResponse } from "next/server";

/**
 * City of San Diego permit search.
 *
 * Calls the Accela Civic Platform API directly (no-auth endpoints).
 * Falls back to the CSV bulk download when Accela is unconfigured or fails.
 */

const ACCELA_BASE = "https://apis.accela.com/v4";
const ACCELA_APP_ID = process.env.ACCELA_APP_ID || "";
const ACCELA_AGENCY = process.env.ACCELA_AGENCY || "SANDIEGO";
const ACCELA_ENV = process.env.ACCELA_ENVIRONMENT || "PROD";

// CSV fallback
const CSV_URL =
  "https://seshat.datasd.org/development_permits_set2/permits_set2_active_datasd.csv";
let csvCache: Record<string, string>[] | null = null;

function accelaHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-accela-appid": ACCELA_APP_ID,
    "x-accela-agency": ACCELA_AGENCY,
    "x-accela-environment": ACCELA_ENV,
  };
}

// ── Accela search ───────────────────────────────────────

async function searchAccela(
  address: string,
  type: string,
  status: string,
  dateFrom: string,
  dateTo: string,
  parcel: string,
  limit: number
) {
  const body: Record<string, unknown> = {};
  if (address) body["address"] = { addressLine1: `%${address}%` };
  if (type) body["type"] = { value: `%${type}%` };
  if (status) body["status"] = { value: status };
  if (parcel) body["parcel"] = { parcelNumber: parcel };
  if (dateFrom || dateTo) {
    body["openedDateFrom"] = dateFrom || undefined;
    body["openedDateTo"] = dateTo || undefined;
  }

  const url = `${ACCELA_BASE}/search/records?limit=${limit}&offset=0&expand=addresses,parcels`;

  const res = await fetch(url, {
    method: "POST",
    headers: accelaHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Accela ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const records: unknown[] = json.result || [];
  const total: number = json.page?.totalRecords ?? records.length;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const results = records.map((r: any) => {
    const addr = r.addresses?.[0];
    return {
      project_id: r.id || "",
      approval_id: r.customId || r.id || "",
      title: r.description?.[0] || r.name || "",
      scope: Array.isArray(r.description) ? r.description.join(" ") : (r.description || ""),
      type: r.type?.value || r.type?.text || r.module || "",
      status: r.status?.text || r.status?.value || "",
      address: addr
        ? [addr.streetNumber, addr.streetName, addr.streetSuffix, addr.city, addr.state, addr.postalCode]
            .filter(Boolean)
            .join(" ")
        : "",
      date_created: r.openedDate || "",
      date_issued: r.closedDate || "",
      valuation:
        r.jobValue || r.estimatedTotalJobCost
          ? `$${parseFloat(r.jobValue || r.estimatedTotalJobCost).toLocaleString()}`
          : "N/A",
      apn: r.parcels?.[0]?.parcelNumber || "",
      lat: addr?.xCoordinate || "",
      lng: addr?.yCoordinate || "",
      source: "accela",
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { results, total, source: "City of San Diego (Accela API, live)" };
}

// ── CSV fallback ────────────────────────────────────────

async function loadCSV(): Promise<Record<string, string>[]> {
  if (csvCache) return csvCache;
  const Papa = (await import("papaparse")).default;
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`CSV fetch ${response.status}`);
  const text = await response.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  csvCache = result.data as Record<string, string>[];
  return csvCache;
}

function searchCSV(
  rows: Record<string, string>[],
  address: string,
  type: string,
  status: string,
  limit: number
) {
  let results = rows;
  if (address) {
    const a = address.toLowerCase();
    results = results.filter(
      (r) =>
        (r["ADDRESS_JOB"] || r["address_job"] || "").toLowerCase().includes(a)
    );
  }
  if (type) {
    const t = type.toLowerCase();
    results = results.filter(
      (r) =>
        (r["APPROVAL_TYPE"] || r["approval_type"] || "").toLowerCase().includes(t)
    );
  }
  if (status) {
    const s = status.toLowerCase();
    results = results.filter(
      (r) =>
        (r["APPROVAL_STATUS"] || r["approval_status"] || "").toLowerCase().includes(s)
    );
  }
  return results.slice(0, limit).map((r) => ({
    project_id: r["PROJECT_ID"] || r["project_id"] || "",
    approval_id: r["APPROVAL_ID"] || r["approval_id"] || "",
    title: r["PROJECT_TITLE"] || r["project_title"] || "",
    scope: r["PROJECT_SCOPE"] || r["project_scope"] || "",
    type: r["APPROVAL_TYPE"] || r["approval_type"] || "",
    status: r["APPROVAL_STATUS"] || r["approval_status"] || "",
    address: r["ADDRESS_JOB"] || r["address_job"] || "",
    date_created: r["DATE_APPROVAL_CREATE"] || r["date_approval_create"] || "",
    date_issued: r["DATE_APPROVAL_ISSUE"] || r["date_approval_issue"] || "",
    valuation: (r["APPROVAL_VALUATION"] || r["approval_valuation"])
      ? `$${parseFloat(r["APPROVAL_VALUATION"] || r["approval_valuation"] || "0").toLocaleString()}`
      : "N/A",
    source: "csv",
  }));
}

// ── Route handler ───────────────────────────────────────

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = params.get("address") || "";
  const type = params.get("type") || "";
  const status = params.get("status") || "";
  const dateFrom = params.get("date_from") || "";
  const dateTo = params.get("date_to") || "";
  const parcel = params.get("parcel") || "";
  const limit = parseInt(params.get("limit") || "20", 10);

  // Try Accela first
  if (ACCELA_APP_ID) {
    try {
      const { results, total, source } = await searchAccela(
        address,
        type,
        status,
        dateFrom,
        dateTo,
        parcel,
        limit
      );
      return NextResponse.json({ results, total, showing: results.length, source });
    } catch (error) {
      console.error("Accela API error, falling back to CSV:", error);
    }
  }

  // Fallback to CSV
  try {
    const rows = await loadCSV();
    if (rows.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        source: "CSV (loading)",
        message: "Permit data is loading. Please try again in a moment.",
      });
    }

    const results = searchCSV(rows, address, type, status, limit);
    return NextResponse.json({
      results,
      total: results.length,
      showing: results.length,
      database_size: rows.length,
      source: "City of San Diego (Open Data CSV, cached)",
    });
  } catch (error) {
    console.error("CSV fallback error:", error);
    return NextResponse.json({
      results: [],
      total: 0,
      error: "Failed to fetch permit data",
    });
  }
}
