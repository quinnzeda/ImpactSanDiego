"use client";

import { useState } from "react";

interface Reliability {
  source: "live" | "ai" | "fallback";
  notes: string[];
}

interface AduType {
  id: string;
  label: string;
  description: string;
}

interface OptionsData {
  adu_types?: AduType[];
  default_type?: string;
}

interface Props {
  options?: Record<string, unknown> | OptionsData;
  reliability?: Reliability;
  onSelect?: (typeId: string, label: string) => void;
}

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

const TYPE_META: Record<string, { emoji: string; size: string; cost: string; timeline: string }> = {
  detached:          { emoji: "🏗️", size: "Up to 1,200 sq ft", cost: "$150k–$350k to build", timeline: "6–12 months" },
  attached:          { emoji: "🔗", size: "Up to 1,200 sq ft", cost: "$120k–$280k to build", timeline: "5–10 months" },
  garage_conversion: { emoji: "🚗", size: "Size of your garage", cost: "$80k–$180k to build",  timeline: "3–6 months" },
  garage:            { emoji: "🚗", size: "Size of your garage", cost: "$80k–$180k to build",  timeline: "3–6 months" },
  jadu:              { emoji: "🏠", size: "≤500 sq ft",          cost: "$40k–$100k to build",  timeline: "2–4 months" },
  junior:            { emoji: "🏠", size: "≤500 sq ft",          cost: "$40k–$100k to build",  timeline: "2–4 months" },
};

function getMeta(id: string) {
  const key = id.toLowerCase().replace(/[\s-]+/g, "_");
  return TYPE_META[key] || { emoji: "📋", size: "Varies", cost: "Varies", timeline: "Varies" };
}

export function OptionsExplorer({ options, reliability, onSelect }: Props) {
  const o = options as OptionsData | undefined;
  const types = o?.adu_types || [];
  const [selectedType, setSelectedType] = useState<string>("");

  const rel = reliability ? RELIABILITY_STYLES[reliability.source] : null;

  function handleClick(t: AduType) {
    setSelectedType(t.id);
    onSelect?.(t.id, t.label);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-serif text-xl font-semibold text-stone-900">What kind of ADU works for you?</h2>
          {rel && (
            <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${rel.cls}`}>
              {rel.label}
            </span>
          )}
        </div>
        <p className="text-[0.875rem] text-stone-500 mb-5">
          Each option has different costs, timelines, and requirements. Pick one to explore.
        </p>

        {types.length === 0 ? (
          <p className="text-[0.9375rem] text-stone-400 italic py-4 text-center">
            No ADU options available — set ANTHROPIC_API_KEY for personalized guidance.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {types.map((t) => {
              const meta = getMeta(t.id);
              const isSelected = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleClick(t)}
                  className={`flex gap-4 px-5 py-4 border-[1.5px] rounded-[14px] text-left transition-all duration-150 ${
                    isSelected
                      ? "border-sage-500 bg-sage-50"
                      : "border-stone-200 bg-stone-50 hover:border-sage-200 hover:bg-white"
                  }`}
                >
                  <span className="text-[1.75rem] mt-0.5 shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[1rem] font-bold text-stone-900 leading-[1.3] mb-1">{t.label}</div>
                    <div className="text-[0.8125rem] text-stone-500 leading-[1.5] mb-2.5">{t.description}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[meta.size, meta.cost, meta.timeline].map((tag) => (
                        <span
                          key={tag}
                          className="text-[0.6875rem] font-semibold text-stone-600 bg-white border border-stone-200 px-2.5 py-1 rounded-[6px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Did you know tip */}
        {types.length > 0 && (
          <div className="mt-5 bg-stone-50 border border-stone-200 rounded-[14px] px-5 py-4">
            <div className="text-[0.8125rem] font-bold text-green-700 mb-1">💡 Did you know?</div>
            <div className="text-[0.8125rem] text-stone-500 leading-[1.6]">
              San Diego County offers <strong className="text-stone-700">free pre-approved ADU plans</strong> that skip the architectural design phase and get reviewed faster. This can save you $5,000–$15,000 in architect fees and weeks of review time.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
