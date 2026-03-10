"use client";

import { useState } from "react";

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
  year_built?: number;
  community_plan_area?: string;
  council_district?: number;
  max_height_ft?: number;
  height_note?: string;
  front_setback_ft?: number;
  side_setback_ft?: number;
  rear_setback_ft?: number;
  setback_note?: string;
  allowed_units_description?: string;
  is_coastal?: boolean;
  is_historic?: boolean;
  in_coastal_height_limit?: boolean;
  past_permits?: PastPermit[];
  data_sources?: string[];
  field_sources?: Record<string, string>;
}

interface Props {
  property?: Record<string, unknown> | PropertyData;
  showCta?: boolean;
}

// Map raw data_sources to friendly names, deduplicating
function friendlySourceNames(sources: string[]): string {
  const friendly = new Set<string>();
  for (const s of sources) {
    if (s.includes("ArcGIS") || s.includes("Geocoder")) {
      friendly.add("City of San Diego GIS");
    } else if (s.includes("Socrata")) {
      friendly.add("County Open Data");
    } else if (s.includes("SDMC")) {
      friendly.add("Municipal Code Ch. 13");
    } else {
      friendly.add(s);
    }
  }
  return Array.from(friendly).join(" · ");
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCompactPermits(permits: PastPermit[]): string {
  return permits
    .slice(0, 5)
    .map((p) => {
      const shortType = (p.type || "Permit").split(/[\s/,-]+/)[0];
      const shortYear = p.year ? `'${String(p.year).slice(-2)}` : "";
      return `${shortType} ${shortYear}`.trim();
    })
    .join(" · ");
}

export function PropertyCard({ property, showCta }: Props) {
  const p = property as PropertyData | undefined;

  const hasAnyData =
    p?.address ||
    p?.zone_code ||
    (p?.overlays && p.overlays.length > 0) ||
    p?.lot_size_sqft ||
    p?.year_built;

  if (!hasAnyData) return null;

  const fs = p?.field_sources ?? {};
  const currentYear = new Date().getFullYear();
  const historicAgeThreshold = currentYear - 45;

  // Build subtitle: "Ocean Beach, San Diego · Council District 2 · Zone RS-1-7"
  const subtitleParts: string[] = [];
  if (p?.community_plan_area) {
    subtitleParts.push(titleCase(p.community_plan_area) + ", San Diego");
  }
  if (p?.council_district) {
    subtitleParts.push(`Council District ${p.council_district}`);
  }
  if (p?.zone_code) {
    subtitleParts.push(`Zone ${p.zone_code}`);
  }
  const subtitle = subtitleParts.join(" · ");

  // Build overlay pills
  const overlayPills: Array<{ label: string; style: string }> = [];
  if (p?.is_coastal || p?.overlays?.some((ov) => /coastal zone/i.test(ov))) {
    overlayPills.push({
      label: "Coastal Zone",
      style: "bg-blue-100 text-blue-700 border-blue-200",
    });
  }
  // Historic district badge — only when actually in a historic overlay
  if (p?.is_historic || p?.overlays?.some((ov) => /historic/i.test(ov))) {
    overlayPills.push({
      label: "Historic District",
      style: "bg-amber-100 text-amber-700 border-amber-200",
    });
  }
  // Other overlays (skip ones already represented by pills above)
  if (p?.overlays) {
    for (const ov of p.overlays) {
      if (/coastal zone/i.test(ov)) continue;
      if (/historic/i.test(ov)) continue;
      // Show coastal height limitation as its own pill
      if (/coastal height/i.test(ov)) {
        overlayPills.push({
          label: "30 ft Height Limit (Prop D)",
          style: "bg-sky-50 text-sky-700 border-sky-200",
        });
        continue;
      }
      overlayPills.push({
        label: ov,
        style: "bg-stone-100 text-stone-600 border-stone-200",
      });
    }
  }

  const hasSetbacks =
    p?.front_setback_ft != null ||
    p?.side_setback_ft != null ||
    p?.rear_setback_ft != null;

  const compactPermits = p?.past_permits?.length
    ? formatCompactPermits(p.past_permits)
    : null;

  // Height note: if in coastal height limit, say so clearly (not "may be lower")
  const heightNote = p?.in_coastal_height_limit
    ? "Coastal Height Limit (Prop D)"
    : p?.height_note
    ? p.height_note.split(";")[0]
    : undefined;

  // Year built note: rolling 45-year threshold per SDMC §143.0212
  const yearBuiltNote =
    p?.year_built && p.year_built <= historicAgeThreshold
      ? "May require historic screening (SDMC §143.0212)"
      : undefined;

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden animate-slide-up">
      <div className="p-5 pb-4">
        {/* Address header */}
        {p?.address && (
          <div className="mb-3">
            <h2 className="font-serif text-[1.375rem] font-semibold text-stone-900 leading-tight">
              {p.address.split(",")[0]}
            </h2>
            {subtitle && (
              <p className="text-[0.8125rem] text-stone-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Overlay pills */}
        {overlayPills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {overlayPills.map((pill, i) => (
              <span
                key={i}
                className={`text-[0.75rem] font-medium px-2.5 py-1 rounded-full border ${pill.style}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        )}

        {/* APN line */}
        {p?.apn && (
          <p className="text-[0.6875rem] text-stone-400 mb-3">
            APN {p.apn}
          </p>
        )}

        {/* Data grid */}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {/* YOUR LOT */}
          {p?.lot_size_sqft && (
            <InfoCard
              label="Your lot"
              value={`${p.lot_size_sqft.toLocaleString()} sq ft`}
              source={fs.lot_size}
            />
          )}

          {/* WHAT YOU CAN BUILD */}
          {p?.allowed_units_description && (
            <InfoCard
              label="What you can build"
              value={p.allowed_units_description}
              note={p.zone_plain_english || undefined}
              source={fs.allowed_units}
            />
          )}

          {/* MAX HEIGHT */}
          {p?.max_height_ft && (
            <InfoCard
              label="Max height"
              value={`${p.max_height_ft} ft`}
              note={heightNote}
              source={fs.max_height}
            />
          )}

          {/* YEAR BUILT */}
          {p?.year_built && (
            <InfoCard
              label="Year built"
              value={String(p.year_built)}
              note={yearBuiltNote}
              source={fs.year_built}
            />
          )}

          {/* SETBACKS */}
          {hasSetbacks && (
            <InfoCard
              label="Setbacks"
              value={[p?.front_setback_ft, p?.side_setback_ft, p?.rear_setback_ft]
                .map((v) => (v != null ? `${v}ft` : "\u2013"))
                .join(" · ")}
              note="Front · Sides · Rear"
              source={fs.setbacks}
            />
          )}

          {/* PAST PERMITS */}
          {compactPermits && (
            <InfoCard
              label="Past permits"
              value={compactPermits}
              source={fs.past_permits}
            />
          )}
        </div>

        {/* Zone info (if no allowed_units but we have zone) */}
        {!p?.allowed_units_description && p?.zone_code && (
          <div className="bg-stone-50 rounded-[10px] px-3.5 py-2.5 mt-3">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Zone
            </p>
            <p className="text-[0.9375rem] font-semibold text-stone-900">
              {p.zone_code}
            </p>
            {p.zone_plain_english && (
              <p className="text-[0.75rem] text-stone-500 mt-0.5">
                {p.zone_plain_english}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Data source footer */}
      {p?.data_sources && p.data_sources.length > 0 && (
        <div className="px-5 py-3 border-t border-stone-100">
          <p className="text-[0.6875rem] text-stone-400 leading-relaxed">
            Sources: {friendlySourceNames(p.data_sources)}
          </p>
        </div>
      )}

      {/* CTA */}
      {showCta && (
        <div className="px-5 pb-5">
          <p className="text-[0.875rem] text-stone-400 text-center">
            Now let&apos;s explore your options &rarr;
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  note,
  source,
}: {
  label: string;
  value: string;
  note?: string;
  source?: string;
}) {
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="bg-stone-50 rounded-[10px] px-3.5 py-2.5 relative group">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide">
          {label}
        </p>
        {source && (
          <button
            type="button"
            className="text-stone-300 hover:text-stone-500 transition-colors text-[0.6875rem] leading-none"
            onClick={() => setShowSource(!showSource)}
            aria-label={`Data source for ${label}`}
          >
            i
          </button>
        )}
      </div>
      <p className="text-[0.9375rem] font-semibold text-stone-900">{value}</p>
      {note && (
        <p className="text-[0.75rem] text-stone-500 mt-0.5">{note}</p>
      )}
      {showSource && source && (
        <p className="text-[0.625rem] text-stone-400 mt-1 italic">
          {source}
        </p>
      )}
    </div>
  );
}
