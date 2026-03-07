"use client";

interface Reliability {
  source: "live" | "ai" | "fallback";
  notes: string[];
}

interface VerdictData {
  level?: "green" | "amber" | "red";
  headline?: string;
  reason?: string;
  what_changes_everything?: string;
}

interface Props {
  verdict?: Record<string, unknown> | VerdictData;
  estimated_timeline?: string;
  estimated_cost_range?: string;
  reliability?: Reliability;
}

const LEVEL_STYLES = {
  green: {
    bar: "bg-green-500",
    badge: "bg-green-100 text-green-800 border-green-200",
    icon: "✓",
  },
  amber: {
    bar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "~",
  },
  red: {
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-800 border-red-200",
    icon: "!",
  },
};

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function PermitVerdictCard({ verdict, estimated_timeline, estimated_cost_range, reliability }: Props) {
  const v = verdict as VerdictData | undefined;
  const level = v?.level || "amber";
  const styles = LEVEL_STYLES[level] || LEVEL_STYLES.amber;
  const rel = reliability ? RELIABILITY_STYLES[reliability.source] : null;

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      {/* Color bar */}
      <div className={`h-1.5 w-full ${styles.bar}`} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-serif text-xl font-semibold text-stone-900 leading-[1.25]">
            {v?.headline || "Permit Guidance"}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${styles.badge}`}>
              {styles.icon} {level}
            </span>
            {rel && (
              <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${rel.cls}`}>
                {rel.label}
              </span>
            )}
          </div>
        </div>

        {/* Reason */}
        {v?.reason ? (
          <p className="text-[0.9375rem] text-stone-700 leading-[1.65] mb-5">
            {v.reason}
          </p>
        ) : (
          <p className="text-[0.9375rem] text-stone-400 leading-[1.65] mb-5 italic">
            No details available — set ANTHROPIC_API_KEY for AI guidance.
          </p>
        )}

        {/* Timeline + cost */}
        {(estimated_timeline || estimated_cost_range) && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {estimated_timeline && (
              <div className="flex items-center gap-2 bg-sage-50 border border-sage-200 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 text-sage-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[0.875rem] text-stone-700">
                  <span className="font-medium">Timeline:</span> {estimated_timeline}
                </span>
              </div>
            )}
            {estimated_cost_range && (
              <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 text-stone-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[0.875rem] text-stone-700">
                  <span className="font-medium">Est. cost:</span> {estimated_cost_range}
                </span>
              </div>
            )}
          </div>
        )}

        {/* What changes everything */}
        {v?.what_changes_everything && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
            <p className="text-[0.8125rem] font-semibold text-amber-800 mb-1">Key factor</p>
            <p className="text-[0.875rem] text-amber-700 leading-[1.5]">{v.what_changes_everything}</p>
          </div>
        )}

        {/* Reliability notes */}
        {reliability?.notes && reliability.notes.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            {reliability.notes.map((note, i) => (
              <p key={i} className="text-[0.75rem] text-stone-400 leading-[1.5]">{note}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
