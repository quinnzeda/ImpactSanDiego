/**
 * Socrata API client for San Diego County permit data.
 * REST API, no auth required, 236K+ records.
 */

const SOCRATA_BASE = "https://data.sandiegocounty.gov/resource/dyzh-7eat.json";

export interface SocrataPermit {
  id: string;
  record_id: string;
  open_date: string;
  issued_date: string;
  record_status: string;
  record_group: string;
  record_type: string;
  record_subtype: string;
  record_category: string;
  primary_scope_code: string;
  use: string;
  homeowner_biz_owner: boolean;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  full_address: string;
  contractor_name: string;
  contractor_address: string;
  contractor_phone: string;
  created_online: boolean;
  last_updated: string;
  geocoded_column?: { latitude: string; longitude: string };
}

export async function socrataSearch(params: {
  address?: string;
  type?: string;
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: SocrataPermit[]; total: number }> {
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  const conditions: string[] = [];

  if (params.address) {
    conditions.push(`upper(full_address) like upper('%${escapeSoql(params.address)}%')`);
  }

  if (params.type) {
    conditions.push(`upper(record_category) like upper('%${escapeSoql(params.type)}%')`);
  }

  if (params.status) {
    conditions.push(`upper(record_status) like upper('%${escapeSoql(params.status)}%')`);
  }

  let url: string;
  if (params.query && conditions.length === 0) {
    url = `${SOCRATA_BASE}?$q=${encodeURIComponent(params.query)}&$limit=${limit}&$offset=${offset}&$order=open_date DESC`;
  } else if (conditions.length > 0) {
    const where = conditions.join(" AND ");
    url = `${SOCRATA_BASE}?$where=${encodeURIComponent(where)}&$limit=${limit}&$offset=${offset}&$order=open_date DESC`;
  } else {
    url = `${SOCRATA_BASE}?$limit=${limit}&$offset=${offset}&$order=open_date DESC`;
  }

  try {
    const [dataRes, countRes] = await Promise.all([
      fetch(url),
      fetchCount(conditions, params.query),
    ]);

    if (!dataRes.ok) {
      console.error(`Socrata API error: ${dataRes.status}`);
      return { results: [], total: 0 };
    }

    const results = (await dataRes.json()) as SocrataPermit[];
    return { results, total: countRes };
  } catch (error) {
    console.error("Socrata search error:", error);
    return { results: [], total: 0 };
  }
}

async function fetchCount(conditions: string[], query?: string): Promise<number> {
  try {
    let url: string;
    if (query && conditions.length === 0) {
      url = `${SOCRATA_BASE}?$q=${encodeURIComponent(query)}&$select=count(*)`;
    } else if (conditions.length > 0) {
      url = `${SOCRATA_BASE}?$where=${encodeURIComponent(conditions.join(" AND "))}&$select=count(*)`;
    } else {
      url = `${SOCRATA_BASE}?$select=count(*)`;
    }
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return parseInt(data[0]?.count || "0", 10);
  } catch {
    return 0;
  }
}

export async function socrataGetStats(params: {
  type?: string;
  area?: string;
}): Promise<{
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  recent_trend: { month: string; count: number }[];
}> {
  const conditions: string[] = [];
  if (params.type) {
    conditions.push(`upper(record_category) like upper('%${escapeSoql(params.type)}%')`);
  }
  if (params.area) {
    conditions.push(`upper(full_address) like upper('%${escapeSoql(params.area)}%')`);
  }

  const whereClause = conditions.length > 0
    ? `&$where=${encodeURIComponent(conditions.join(" AND "))}`
    : "";

  try {
    const [typeRes, statusRes, countRes, trendRes] = await Promise.all([
      fetch(`${SOCRATA_BASE}?$select=record_category,count(*) as cnt&$group=record_category&$order=cnt DESC&$limit=10${whereClause}`),
      fetch(`${SOCRATA_BASE}?$select=record_status,count(*) as cnt&$group=record_status&$order=cnt DESC${whereClause}`),
      fetch(`${SOCRATA_BASE}?$select=count(*)${whereClause}`),
      fetch(`${SOCRATA_BASE}?$select=date_trunc_ym(open_date) as month,count(*) as cnt&$group=date_trunc_ym(open_date)&$order=month DESC&$limit=12${whereClause}`),
    ]);

    const types = typeRes.ok ? await typeRes.json() : [];
    const statuses = statusRes.ok ? await statusRes.json() : [];
    const total = countRes.ok ? parseInt((await countRes.json())[0]?.count || "0", 10) : 0;
    const trends = trendRes.ok ? await trendRes.json() : [];

    const by_type: Record<string, number> = {};
    for (const t of types) {
      if (t.record_category) by_type[t.record_category] = parseInt(t.cnt, 10);
    }

    const by_status: Record<string, number> = {};
    for (const s of statuses) {
      if (s.record_status) by_status[s.record_status] = parseInt(s.cnt, 10);
    }

    const recent_trend = trends.map((t: { month: string; cnt: string }) => ({
      month: t.month,
      count: parseInt(t.cnt, 10),
    }));

    return { total, by_type, by_status, recent_trend };
  } catch (error) {
    console.error("Socrata stats error:", error);
    return { total: 0, by_type: {}, by_status: {}, recent_trend: [] };
  }
}

function escapeSoql(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}
