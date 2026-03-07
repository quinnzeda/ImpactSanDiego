import Papa from "papaparse";

export interface PermitRecord {
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
}

const PERMIT_URLS = {
  active: "https://seshat.datasd.org/development_permits_set2/permits_set2_active_datasd.csv",
  closed: "https://seshat.datasd.org/development_permits_set2/permits_set2_closed_datasd.csv",
};

let permitCache: PermitRecord[] | null = null;
let loadingPromise: Promise<PermitRecord[]> | null = null;

function mapRow(row: Record<string, string>): PermitRecord {
  return {
    project_id: row["PROJECT_ID"] || row["project_id"] || "",
    approval_id: row["APPROVAL_ID"] || row["approval_id"] || "",
    project_title: row["PROJECT_TITLE"] || row["project_title"] || "",
    project_scope: row["PROJECT_SCOPE"] || row["project_scope"] || "",
    approval_type: row["APPROVAL_TYPE"] || row["approval_type"] || "",
    approval_status: row["APPROVAL_STATUS"] || row["approval_status"] || "",
    address: row["ADDRESS_JOB"] || row["address_job"] || "",
    apn: row["JOB_APN"] || row["job_apn"] || "",
    lat: row["LAT_JOB"] || row["lat_job"] || "",
    lng: row["LNG_JOB"] || row["lng_job"] || "",
    date_created: row["DATE_APPROVAL_CREATE"] || row["date_approval_create"] || "",
    date_issued: row["DATE_APPROVAL_ISSUE"] || row["date_approval_issue"] || "",
    valuation: row["APPROVAL_VALUATION"] || row["approval_valuation"] || "",
  };
}

async function fetchCSV(url: string): Promise<PermitRecord[]> {
  console.error(`Fetching permit data from ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch ${url}: ${response.status}`);
    return [];
  }
  const text = await response.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return (result.data as Record<string, string>[]).map(mapRow);
}

export async function loadPermits(): Promise<PermitRecord[]> {
  if (permitCache) return permitCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Only load active permits to keep memory reasonable
      const records = await fetchCSV(PERMIT_URLS.active);
      permitCache = records;
      console.error(`Loaded ${records.length} permit records`);
      return records;
    } catch (error) {
      console.error("Error loading permits:", error);
      permitCache = [];
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export function searchPermits(
  permits: PermitRecord[],
  filters: {
    address?: string;
    approval_type?: string;
    status?: string;
    project_id?: string;
  },
  limit = 20
): PermitRecord[] {
  let results = permits;

  if (filters.address) {
    const addr = filters.address.toLowerCase();
    results = results.filter((p) => p.address.toLowerCase().includes(addr));
  }

  if (filters.approval_type) {
    const type = filters.approval_type.toLowerCase();
    results = results.filter((p) => p.approval_type.toLowerCase().includes(type));
  }

  if (filters.status) {
    const status = filters.status.toLowerCase();
    results = results.filter((p) => p.approval_status.toLowerCase().includes(status));
  }

  if (filters.project_id) {
    results = results.filter((p) => p.project_id === filters.project_id);
  }

  return results.slice(0, limit);
}

export function getPermitStats(
  permits: PermitRecord[],
  filters: { type?: string; area?: string }
): {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  avg_valuation: number;
} {
  let filtered = permits;

  if (filters.type) {
    const type = filters.type.toLowerCase();
    filtered = filtered.filter((p) => p.approval_type.toLowerCase().includes(type));
  }

  if (filters.area) {
    const area = filters.area.toLowerCase();
    filtered = filtered.filter((p) => p.address.toLowerCase().includes(area));
  }

  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  let totalValuation = 0;
  let valuationCount = 0;

  for (const p of filtered) {
    by_type[p.approval_type] = (by_type[p.approval_type] || 0) + 1;
    by_status[p.approval_status] = (by_status[p.approval_status] || 0) + 1;
    const val = parseFloat(p.valuation);
    if (!isNaN(val) && val > 0) {
      totalValuation += val;
      valuationCount++;
    }
  }

  // Keep only top 10 types
  const sortedTypes = Object.entries(by_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topTypes: Record<string, number> = {};
  for (const [k, v] of sortedTypes) topTypes[k] = v;

  return {
    total: filtered.length,
    by_type: topTypes,
    by_status,
    avg_valuation: valuationCount > 0 ? Math.round(totalValuation / valuationCount) : 0,
  };
}
