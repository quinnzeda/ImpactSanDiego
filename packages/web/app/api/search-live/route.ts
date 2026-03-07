import { NextRequest, NextResponse } from "next/server";

const SOCRATA_BASE = "https://data.sandiegocounty.gov/resource/dyzh-7eat.json";

function escapeSoql(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = params.get("address") || "";
  const type = params.get("type") || "";
  const status = params.get("status") || "";
  const query = params.get("query") || "";
  const limit = parseInt(params.get("limit") || "20", 10);

  const conditions: string[] = [];
  if (address) conditions.push(`upper(full_address) like upper('%${escapeSoql(address)}%')`);
  if (type) conditions.push(`upper(record_category) like upper('%${escapeSoql(type)}%')`);
  if (status) conditions.push(`upper(record_status) like upper('%${escapeSoql(status)}%')`);

  let url: string;
  if (query && conditions.length === 0) {
    url = `${SOCRATA_BASE}?$q=${encodeURIComponent(query)}&$limit=${limit}&$order=open_date DESC`;
  } else if (conditions.length > 0) {
    url = `${SOCRATA_BASE}?$where=${encodeURIComponent(conditions.join(" AND "))}&$limit=${limit}&$order=open_date DESC`;
  } else {
    url = `${SOCRATA_BASE}?$limit=${limit}&$order=open_date DESC`;
  }

  try {
    // Fetch results and count in parallel
    const countWhere = conditions.length > 0
      ? `?$where=${encodeURIComponent(conditions.join(" AND "))}&$select=count(*)`
      : query
        ? `?$q=${encodeURIComponent(query)}&$select=count(*)`
        : `?$select=count(*)`;

    const [dataRes, countRes] = await Promise.all([
      fetch(url),
      fetch(`${SOCRATA_BASE}${countWhere}`),
    ]);

    if (!dataRes.ok) {
      return NextResponse.json({ results: [], total: 0, error: `Socrata API: ${dataRes.status}` });
    }

    const data = await dataRes.json();
    const countData = countRes.ok ? await countRes.json() : [{ count: "0" }];
    const total = parseInt(countData[0]?.count || "0", 10);

    const results = data.map((r: Record<string, unknown>) => ({
      record_id: r.record_id,
      type: r.record_category || r.record_type,
      subtype: r.record_subtype,
      status: r.record_status,
      description: r.use,
      address: r.full_address,
      contractor: r.contractor_name || "N/A",
      opened: r.open_date,
      issued: r.issued_date,
      owner_builder: r.homeowner_biz_owner,
      scope_code: r.primary_scope_code,
      lat: (r.geocoded_column as { latitude?: string })?.latitude,
      lng: (r.geocoded_column as { longitude?: string })?.longitude,
    }));

    return NextResponse.json({
      source: "San Diego County (Socrata API, live)",
      results,
      total,
      showing: results.length,
    });
  } catch (error) {
    console.error("Socrata search error:", error);
    return NextResponse.json({ results: [], total: 0, error: "Failed to fetch from Socrata API" });
  }
}
