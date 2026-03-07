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
  pros?: string[];
  cons?: string[];
}

interface OptionsData {
  adu_types?: AduType[];
  default_type?: string;
  size_range?: { min: number; max: number; default: number };
}

interface Props {
  options?: Record<string, unknown> | OptionsData;
  reliability?: Reliability;
}

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

// Rough fee hint thresholds (San Diego, informational only)
function getFeeHint(sqft: number): string {
  if (sqft < 500) return "No impact fees (state exemption for ADUs under 500 sq ft). Permit fees ~$3,000–$6,000.";
  if (sqft < 750) return "No impact fees (under 750 sq ft threshold). Permit fees ~$4,000–$8,000.";
  if (sqft < 1000) return "Impact fees may apply (~$20,000–$40,000+). Verify with DSD.";
  return "Impact fees likely apply (~$40,000–$80,000+). Engineering review required. Verify with DSD.";
}

export function OptionsExplorer({ options, reliability }: Props) {
  const o = options as OptionsData | undefined;
  const types = o?.adu_types || [];
  const sizeRange = o?.size_range || { min: 150, max: 1200, default: 600 };

  const [selectedType, setSelectedType] = useState<string>(o?.default_type || types[0]?.id || "");
  const [size, setSize] = useState(sizeRange.default);

  const rel = reliability ? RELIABILITY_STYLES[reliability.source] : null;
  const selectedAdu = types.find((t) => t.id === selectedType) || types[0];

  return (
    <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <h2 className="font-serif text-xl font-semibold text-stone-900">ADU Options</h2>
          {rel && (
            <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${rel.cls}`}>
              {rel.label}
            </span>
          )}
        </div>

        {types.length === 0 ? (
          <p className="text-[0.9375rem] text-stone-400 italic py-4 text-center">
            No ADU options available — set ANTHROPIC_API_KEY for personalized guidance.
          </p>
        ) : (
          <>
            {/* Type selector */}
            <div className="mb-5">
              <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2.5">
                ADU type
              </p>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    className={`flex flex-col gap-1 px-3.5 py-2.5 border-[1.5px] rounded-[10px] text-left transition-all duration-150 ${
                      selectedType === t.id
                        ? "border-sage-500 bg-sage-50"
                        : "border-stone-200 hover:border-sage-200 hover:bg-sage-50"
                    }`}
                  >
                    <span className="text-[0.9375rem] font-semibold text-stone-900 leading-[1.3]">
                      {t.label}
                    </span>
                    <span className="text-[0.75rem] text-stone-500 leading-[1.4]">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pros/cons for selected */}
            {selectedAdu && (selectedAdu.pros?.length || selectedAdu.cons?.length) && (
              <div className="grid grid-cols-2 gap-3 mb-5 max-sm:grid-cols-1">
                {selectedAdu.pros && selectedAdu.pros.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-[10px] px-3.5 py-3">
                    <p className="text-[0.6875rem] font-semibold text-green-700 uppercase tracking-wide mb-2">Pros</p>
                    <ul className="flex flex-col gap-1">
                      {selectedAdu.pros.map((pro, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[0.8125rem] text-green-800">
                          <span className="mt-1 shrink-0">✓</span>
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedAdu.cons && selectedAdu.cons.length > 0 && (
                  <div className="bg-stone-50 border border-stone-200 rounded-[10px] px-3.5 py-3">
                    <p className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-wide mb-2">Cons</p>
                    <ul className="flex flex-col gap-1">
                      {selectedAdu.cons.map((con, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[0.8125rem] text-stone-600">
                          <span className="mt-1 shrink-0">–</span>
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Size slider */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase">
                  Size estimate
                </p>
                <span className="text-[0.9375rem] font-semibold text-stone-900">
                  {size.toLocaleString()} sq ft
                </span>
              </div>
              <input
                type="range"
                min={sizeRange.min}
                max={sizeRange.max}
                step={50}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-sage-500 cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[0.6875rem] text-stone-400">{sizeRange.min} sq ft</span>
                <span className="text-[0.6875rem] text-stone-400">{sizeRange.max} sq ft</span>
              </div>
            </div>

            {/* Fee hint */}
            <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3">
              <p className="text-[0.75rem] font-semibold text-amber-800 mb-1">Fee estimate for {size.toLocaleString()} sq ft</p>
              <p className="text-[0.8125rem] text-amber-700 leading-[1.5]">{getFeeHint(size)}</p>
              <p className="text-[0.6875rem] text-amber-600 mt-1.5">Informational only — verify with DSD.</p>
            </div>
          </>
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
