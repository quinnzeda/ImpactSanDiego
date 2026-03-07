"use client";

import { useState } from "react";

interface Reliability {
  source: "live" | "ai" | "fallback";
  notes: string[];
}

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  category?: string;
}

interface Props {
  checklist?: Record<string, unknown> | { items: ChecklistItem[] };
  reliability?: Reliability;
  projectDescription?: string;
}

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

const CATEGORY_LABELS: Record<string, string> = {
  documents:   "Documents",
  plans:       "Plans & Drawings",
  fees:        "Fees",
  inspections: "Inspections",
};

export function PersonalizedChecklist({ checklist, reliability, projectDescription }: Props) {
  const items = (checklist as { items?: ChecklistItem[] } | undefined)?.items || [];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const rel = reliability ? RELIABILITY_STYLES[reliability.source] : null;

  const toggleChecked = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const doneCount = items.filter((it) => checked[it.id]).length;

  // Group by category
  const categories = Array.from(new Set(items.map((it) => it.category || "other")));

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="font-serif text-xl font-semibold text-stone-900">
            Permit Checklist
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {rel && (
              <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${rel.cls}`}>
                {rel.label}
              </span>
            )}
          </div>
        </div>

        {projectDescription && (
          <p className="text-[0.875rem] text-stone-500 mb-4">
            For: &ldquo;{projectDescription}&rdquo;
          </p>
        )}

        {/* Progress bar */}
        {items.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.75rem] font-medium text-stone-500">
                {doneCount} of {items.length} complete
              </span>
              <span className="text-[0.75rem] text-stone-400">
                {Math.round((doneCount / items.length) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-500 rounded-full transition-all duration-300"
                style={{ width: `${(doneCount / items.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-[0.9375rem] text-stone-400 italic py-4 text-center">
            No checklist items available — set ANTHROPIC_API_KEY for a personalized list.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {categories.map((cat) => {
              const catItems = items.filter((it) => (it.category || "other") === cat);
              if (catItems.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2">
                    {CATEGORY_LABELS[cat] || cat}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className={`border rounded-[10px] transition-colors duration-150 ${
                          checked[item.id]
                            ? "border-sage-200 bg-sage-50"
                            : "border-stone-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3 px-3.5 py-2.5">
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleChecked(item.id)}
                            className={`mt-0.5 w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-150 ${
                              checked[item.id]
                                ? "bg-sage-500 border-sage-500"
                                : "border-stone-300 bg-white hover:border-sage-400"
                            }`}
                          >
                            {checked[item.id] && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[0.9375rem] font-medium leading-[1.4] ${checked[item.id] ? "text-stone-400 line-through" : "text-stone-900"}`}>
                                {item.label}
                              </span>
                              {item.required === false && (
                                <span className="text-[0.6875rem] text-stone-400 border border-stone-200 rounded-full px-1.5 py-0.5 font-medium">
                                  Optional
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expand toggle */}
                          {item.description && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              className="text-stone-400 hover:text-stone-600 transition-colors duration-150 mt-0.5 shrink-0"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`transition-transform duration-200 ${expanded[item.id] ? "rotate-180" : ""}`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Expanded description */}
                        {item.description && expanded[item.id] && (
                          <div className="px-3.5 pb-3 pt-0 ml-[42px]">
                            <p className="text-[0.8125rem] text-stone-500 leading-[1.55]">
                              {item.description}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reliability notes */}
        {reliability?.notes && reliability.notes.length > 0 && (
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
