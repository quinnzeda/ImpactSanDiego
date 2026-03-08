"use client";

interface Reliability {
  source: "live" | "ai" | "fallback";
  notes: string[];
}

interface PastPermit {
  number: string;
  type?: string;
  year?: number;
  status?: string;
}

interface PropertyData {
  address?: string;
  zone_code?: string;
  zone_plain_english?: string;
  overlays?: string[];
  lot_size_sqft?: number;
  apn?: string;
  past_permits?: PastPermit[];
}

interface Props {
  property?: Record<string, unknown> | PropertyData;
  reliability?: Reliability;
}

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function PropertyCard({ property, reliability }: Props) {
  const p = property as PropertyData | undefined;
  const rel = reliability ? RELIABILITY_STYLES[reliability.source] : null;

  const hasAnyData =
    p?.address ||
    p?.zone_code ||
    p?.zone_plain_english ||
    (p?.overlays && p.overlays.length > 0) ||
    p?.lot_size_sqft ||
    p?.apn ||
    (p?.past_permits && p.past_permits.length > 0);

  if (!hasAnyData) return null;

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-stone-100 rounded-[8px] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(50% 0.014 75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h3 className="font-serif text-base font-semibold text-stone-900">Property Context</h3>
          </div>
          {rel && (
            <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${rel.cls}`}>
              {rel.label}
            </span>
          )}
        </div>

        {/* Address */}
        {p?.address && (
          <p className="text-[0.875rem] text-stone-600 mb-4 leading-[1.5]">{p.address}</p>
        )}

        {/* Data grid */}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {p?.zone_code && (
            <div className="bg-stone-50 rounded-[10px] px-3.5 py-2.5">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide mb-1">Zone</p>
              <p className="text-[0.9375rem] font-semibold text-stone-900">{p.zone_code}</p>
              {p.zone_plain_english && (
                <p className="text-[0.75rem] text-stone-500 mt-0.5">{p.zone_plain_english}</p>
              )}
            </div>
          )}

          {p?.lot_size_sqft && (
            <div className="bg-stone-50 rounded-[10px] px-3.5 py-2.5">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide mb-1">Lot size</p>
              <p className="text-[0.9375rem] font-semibold text-stone-900">
                {p.lot_size_sqft.toLocaleString()} sq ft
              </p>
            </div>
          )}

          {p?.apn && (
            <div className="bg-stone-50 rounded-[10px] px-3.5 py-2.5">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide mb-1">APN</p>
              <p className="text-[0.875rem] font-mono text-stone-700">{p.apn}</p>
            </div>
          )}

          {p?.overlays && p.overlays.length > 0 && (
            <div className="bg-stone-50 rounded-[10px] px-3.5 py-2.5">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide mb-1">Overlays</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {p.overlays.map((ov, i) => (
                  <span key={i} className="text-[0.75rem] bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5">
                    {ov}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Past permits */}
        {p?.past_permits && p.past_permits.length > 0 && (
          <div className="mt-4">
            <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2">
              Past permits
            </p>
            <div className="flex flex-col gap-1.5">
              {p.past_permits.map((permit, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-stone-100 last:border-0">
                  <div>
                    <span className="text-[0.875rem] font-mono text-stone-700">{permit.number}</span>
                    {permit.type && (
                      <span className="text-[0.8125rem] text-stone-500 ml-2">{permit.type}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {permit.year && (
                      <span className="text-[0.75rem] text-stone-400">{permit.year}</span>
                    )}
                    {permit.status && (
                      <span className="text-[0.6875rem] font-medium text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">
                        {permit.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
