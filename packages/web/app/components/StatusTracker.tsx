"use client";

import { useState } from "react";

interface Reliability {
  source: "live" | "ai" | "fallback";
  notes: string[];
}

interface WorkflowStep {
  label: string;
  status: "done" | "active" | "pending";
}

interface StatusData {
  permit_number?: string;
  plain_english_status?: string;
  stage_description?: string;
  next_step?: string;
  workflow_steps?: WorkflowStep[];
}

interface Props {
  status?: Record<string, unknown> | StatusData;
  reliability?: Reliability;
  address?: string;
}

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function StatusTracker({ status, reliability, address }: Props) {
  const s = status as StatusData | undefined;
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [liveSource, setLiveSource] = useState<"live" | "ai" | "fallback" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const rel = liveSource
    ? RELIABILITY_STYLES[liveSource]
    : reliability
    ? RELIABILITY_STYLES[reliability.source]
    : null;

  const steps = s?.workflow_steps as WorkflowStep[] | undefined;

  async function handleRefresh() {
    const query = s?.permit_number || address || "";
    if (!query.trim()) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/search-live?query=${encodeURIComponent(query)}&limit=5`);
      if (!res.ok) throw new Error("Non-OK response");
      const data = await res.json();
      const results = Array.isArray(data) ? data : data?.results;
      if (results && results.length > 0) {
        setLiveNote(`Live: found ${results.length} record(s) — ${results[0]?.status || results[0]?.description || "see records below"}.`);
        setLiveSource("live");
      } else {
        setLiveNote("No live records found for this permit/address. Showing last known information.");
        setLiveSource("fallback");
      }
    } catch {
      setLiveNote("Could not reach live records right now. Showing last known information.");
      setLiveSource("fallback");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-stone-900">
              Permit Status
            </h2>
            {s?.permit_number && (
              <p className="text-[0.8125rem] text-stone-500 mt-0.5 font-mono">{s.permit_number}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rel && (
              <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${rel.cls}`}>
                {rel.label}
              </span>
            )}
          </div>
        </div>

        {/* Status summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-[10px] px-4 py-3.5 mb-5">
          <p className="text-[0.9375rem] font-medium text-stone-900 leading-[1.5]">
            {s?.plain_english_status || "Status information not available."}
          </p>
          {s?.stage_description && (
            <p className="text-[0.875rem] text-stone-500 mt-1.5 leading-[1.5]">
              {s.stage_description}
            </p>
          )}
        </div>

        {/* Stepper */}
        {steps && steps.length > 0 && (
          <div className="mb-5">
            <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-3">
              Workflow
            </p>
            <div className="flex flex-col gap-0">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        step.status === "done"
                          ? "bg-sage-500 border-sage-500"
                          : step.status === "active"
                          ? "bg-white border-sage-500"
                          : "bg-white border-stone-300"
                      }`}
                    >
                      {step.status === "done" && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {step.status === "active" && (
                        <div className="w-2 h-2 rounded-full bg-sage-500" />
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-px flex-1 min-h-[20px] mt-0.5 mb-0.5 ${step.status === "done" ? "bg-sage-300" : "bg-stone-200"}`} />
                    )}
                  </div>
                  {/* Label */}
                  <p
                    className={`text-[0.875rem] pb-4 leading-[1.4] ${
                      step.status === "active"
                        ? "font-semibold text-stone-900"
                        : step.status === "done"
                        ? "text-stone-500"
                        : "text-stone-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next step */}
        {s?.next_step && (
          <div className="bg-sage-50 border border-sage-200 rounded-[10px] px-4 py-3 mb-5">
            <p className="text-[0.75rem] font-semibold text-sage-700 mb-1 uppercase tracking-wide">Next step</p>
            <p className="text-[0.875rem] text-stone-700 leading-[1.5]">{s.next_step}</p>
          </div>
        )}

        {/* Live refresh */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || (!s?.permit_number && !address)}
            className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-sage-700 bg-sage-50 border border-sage-200 rounded-full px-3.5 py-1.5 hover:bg-sage-100 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? "animate-spin" : ""}
              style={refreshing ? { animationDuration: "1s" } : undefined}
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            {refreshing ? "Checking..." : "Refresh from live records"}
          </button>
          {!s?.permit_number && !address && (
            <span className="text-[0.75rem] text-stone-400">Enter permit number or address to enable refresh</span>
          )}
        </div>

        {/* Live note */}
        {liveNote && (
          <div className={`mt-3 rounded-[10px] px-4 py-3 text-[0.8125rem] leading-[1.5] border ${
            liveSource === "live"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-stone-50 border-stone-200 text-stone-600"
          }`}>
            {liveNote}
          </div>
        )}

        {/* Reliability notes */}
        {reliability?.notes && reliability.notes.length > 0 && !liveNote && (
          <div className="border-t border-stone-100 pt-4 mt-5">
            {reliability.notes.map((note, i) => (
              <p key={i} className="text-[0.75rem] text-stone-400 leading-[1.5]">{note}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
