"use client";

import { useState } from "react";

interface PermitResult {
  project_id?: string;
  approval_id?: string;
  record_id?: string;
  title?: string;
  scope?: string;
  description?: string;
  type: string;
  status: string;
  address: string;
  date_created?: string;
  date_issued?: string;
  opened?: string;
  issued?: string;
  valuation?: string;
  contractor?: string;
  owner_builder?: boolean;
  apn?: string;
  source?: string;
}

type DataSource = "city" | "county";

export default function SearchPage() {
  const [address, setAddress] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [parcel, setParcel] = useState("");
  const [results, setResults] = useState<PermitResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dbSize, setDbSize] = useState(0);
  const [source, setSource] = useState<DataSource>("county");
  const [totalMatching, setTotalMatching] = useState(0);
  const [apiSource, setApiSource] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);

    const params = new URLSearchParams();
    if (address) params.set("address", address);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (query && source === "county") params.set("query", query);
    if (dateFrom && source === "city") params.set("date_from", dateFrom);
    if (dateTo && source === "city") params.set("date_to", dateTo);
    if (parcel && source === "city") params.set("parcel", parcel);
    params.set("limit", "50");

    const endpoint = source === "county" ? "/api/search-live" : "/api/search";

    try {
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setDbSize(data.database_size || data.total || 0);
      setTotalMatching(data.total || data.total_matching || data.results?.length || 0);
      setApiSource(data.source || "");
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-r from-primary to-primary-light text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Search Permit Records</h1>
          <p className="text-blue-100">
            Search across San Diego City and County permit databases via live APIs
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 -mt-6">
        <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-lg border border-border p-6">
          {/* Source Toggle */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Data Source:</span>
            <button
              type="button"
              onClick={() => setSource("county")}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                source === "county"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted border-border hover:border-primary"
              }`}
            >
              SD County (Live API)
            </button>
            <button
              type="button"
              onClick={() => setSource("city")}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                source === "city"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted border-border hover:border-primary"
              }`}
            >
              SD City (Live API)
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 1234 Main St"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Permit Type</label>
              {source === "county" ? (
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g., Solar, ADU, Residential"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">All Types</option>
                  <option value="Building Permit">Building Permit</option>
                  <option value="Combination">Combination Building</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Photovoltaic">Photovoltaic/Solar</option>
                  <option value="No-Plan">No-Plan Residential MEP</option>
                  <option value="Traffic Control">Traffic Control</option>
                  <option value="Demolition">Demolition</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {source === "county" ? "Full-Text Search" : "Status"}
              </label>
              {source === "county" ? (
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., ADU garage conversion"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="Issued">Issued</option>
                  <option value="In Review">In Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Finaled">Finaled</option>
                </select>
              )}
            </div>
          </div>

          {/* City-specific filters: Date Range + APN */}
          {source === "city" && (
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">APN (Parcel Number)</label>
                <input
                  type="text"
                  value={parcel}
                  onChange={(e) => setParcel(e.target.value)}
                  placeholder="e.g., 533-651-01-00"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white font-medium py-2 px-6 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search Permits"}
          </button>
        </form>
      </section>

      {searched && (
        <section className="max-w-5xl mx-auto px-4 mt-8 animate-fade-in">
          {results.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p className="text-lg font-medium">No permits found</p>
              <p className="text-sm mt-1">Try broadening your search criteria</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted">
                  Showing {results.length} of {totalMatching.toLocaleString()} results
                  {apiSource && (
                    <span className="ml-2 inline-block bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full">
                      {apiSource.includes("Accela") ? "Accela API" : apiSource.includes("Socrata") ? "Socrata API" : "Live API"}
                    </span>
                  )}
                  {apiSource && apiSource.includes("CSV") && (
                    <span className="ml-2 inline-block bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                      CSV Fallback
                    </span>
                  )}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full bg-white border border-border rounded-xl overflow-hidden text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted">Address</th>
                      <th className="text-left px-4 py-3 font-medium text-muted">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted">Description</th>
                      <th className="text-left px-4 py-3 font-medium text-muted">Date</th>
                      {source === "county" && (
                        <th className="text-left px-4 py-3 font-medium text-muted">Contractor</th>
                      )}
                      {source === "city" && (
                        <th className="text-right px-4 py-3 font-medium text-muted">Valuation</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((p, i) => (
                      <tr
                        key={`${p.record_id || p.approval_id || p.project_id}-${i}`}
                        className="border-t border-border hover:bg-surface-hover"
                      >
                        <td className="px-4 py-3 font-medium">{p.address || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block bg-blue-50 text-primary text-xs px-2 py-0.5 rounded-full">
                            {p.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3 text-muted max-w-xs truncate">
                          {p.description || p.title || p.scope || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDate(p.opened || p.date_created)}
                        </td>
                        {source === "county" && (
                          <td className="px-4 py-3 text-muted text-xs">{p.contractor || "—"}</td>
                        )}
                        {source === "city" && (
                          <td className="px-4 py-3 text-right text-muted">{p.valuation || "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || "";
  let colorClass = "bg-gray-50 text-gray-700";
  if (s.includes("issued") || s.includes("approved") || s.includes("completed")) colorClass = "bg-green-50 text-green-700";
  else if (s.includes("review") || s.includes("active") || s.includes("pending")) colorClass = "bg-amber-50 text-amber-700";
  else if (s.includes("expired") || s.includes("cancel") || s.includes("denied")) colorClass = "bg-red-50 text-red-700";
  else if (s.includes("final")) colorClass = "bg-blue-50 text-blue-700";

  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
      {status}
    </span>
  );
}
