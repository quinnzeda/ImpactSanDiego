import { z } from "zod";
import {
  searchCityPermits,
  lookupCityPermit,
  type NormalizedPermit,
} from "../data/accela-api.js";

export const searchPermitsSchema = z.object({
  address: z.string().optional().describe("Street address to search for (partial match, wildcards supported)"),
  approval_type: z.string().optional().describe("Permit/approval type to filter by (e.g., 'Building Permit', 'Solar', 'Electrical')"),
  status: z.string().optional().describe("Approval status to filter by (e.g., 'Issued', 'In Review', 'Approved', 'Open', 'Closed')"),
  project_id: z.string().optional().describe("Specific record ID or custom record number to look up"),
  date_from: z.string().optional().describe("Filter permits opened after this date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Filter permits opened before this date (YYYY-MM-DD)"),
  parcel: z.string().optional().describe("APN (Assessor Parcel Number) to search"),
  limit: z.number().optional().default(20).describe("Maximum number of results to return (default 20)"),
});

export type SearchPermitsInput = z.infer<typeof searchPermitsSchema>;

export async function handleSearchPermits(input: SearchPermitsInput): Promise<string> {
  // If a specific project_id is provided, try direct detail lookup first
  if (input.project_id && !input.address && !input.approval_type && !input.status) {
    const detail = await lookupCityPermit({ record_id: input.project_id });
    if (detail.results.length > 0) {
      return JSON.stringify({
        results: detail.results.map(formatPermit),
        total_found: detail.results.length,
        source: detail.source,
        detail_url: detail.detail_url,
      });
    }
  }

  const { results, total, source } = await searchCityPermits({
    address: input.address,
    approval_type: input.approval_type,
    status: input.status,
    project_id: input.project_id,
    date_from: input.date_from,
    date_to: input.date_to,
    parcel: input.parcel,
    limit: input.limit,
  });

  if (results.length === 0) {
    return JSON.stringify({
      results: [],
      total_found: 0,
      source,
      message: "No permits found matching your criteria. Try broadening your search.",
      suggestions: [
        "Try a partial address (e.g., 'Main St' instead of '123 Main St')",
        "Check spelling of approval type",
        "Try without status filter",
        "Use date_from/date_to for date range filtering",
        "Search by APN using the parcel field",
      ],
    });
  }

  return JSON.stringify({
    results: results.map(formatPermit),
    total_found: total,
    showing: results.length,
    source,
    note: results.length >= (input.limit || 20)
      ? `Showing first ${input.limit || 20} results. Use more specific filters to narrow results.`
      : undefined,
  });
}

function formatPermit(p: NormalizedPermit) {
  return {
    project_id: p.project_id,
    approval_id: p.approval_id,
    title: p.project_title,
    scope: p.project_scope,
    type: p.approval_type,
    status: p.approval_status,
    address: p.address,
    apn: p.apn || undefined,
    date_created: p.date_created,
    date_issued: p.date_issued,
    valuation: p.valuation && parseFloat(p.valuation) > 0
      ? `$${parseFloat(p.valuation).toLocaleString()}`
      : "N/A",
    coordinates: p.lat && p.lng ? `${p.lat}, ${p.lng}` : undefined,
    // Show Accela-specific enrichment when available
    contacts: p.contacts?.length
      ? p.contacts.map((c) => ({
          name: c.fullName,
          type: c.type?.text || c.type?.value,
          email: c.email,
        }))
      : undefined,
    conditions: p.conditions?.length
      ? p.conditions.map((c) => ({
          name: c.name,
          status: c.status?.text || c.status?.value,
          type: c.type?.text || c.type?.value,
        }))
      : undefined,
    source: p.source,
  };
}
