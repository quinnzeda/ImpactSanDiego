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
  property?: Record<string, unknown>;
}

const RELIABILITY_STYLES = {
  live:     { label: "Live",     cls: "bg-green-100 text-green-700 border-green-200" },
  ai:       { label: "AI",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fallback: { label: "Fallback", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

function calcFees(sqft: number, isCoastal: boolean, isHistoric: boolean) {
  const planCheck = Math.round(2800 + sqft * 2);
  const buildPermit = Math.round(2600 + sqft * 2);
  const waterSewer = 4100;
  const schoolFees = sqft > 500 ? 3100 : 0;
  const coastalPermit = isCoastal ? 1200 : 0;
  const historicReview = isHistoric ? 800 : 0;
  const total = planCheck + buildPermit + waterSewer + schoolFees + coastalPermit + historicReview;
  const buildLow = Math.round((sqft * 300) / 1000) * 1000;
  const buildHigh = Math.round((sqft * 400) / 1000) * 1000;
  const timeline = sqft <= 400 ? "4–6 mo" : sqft <= 700 ? "6–8 mo" : "8–12 mo";
  return { planCheck, buildPermit, waterSewer, schoolFees, coastalPermit, historicReview, total, buildLow, buildHigh, timeline };
}

function fmt(n: number): string {
  return "$" + n.toLocaleString();
}

export function OptionsExplorer({ options, reliability, property }: Props) {
  const o = options as OptionsData | undefined;
  const types = o?.adu_types || [];
  const sizeRange = o?.size_range || { min: 150, max: 1200, default: 600 };

  const [selectedType, setSelectedType] = useState<string>(o?.default_type || types[0]?.id || "");
  const [size, setSize] = useState(sizeRange.default);

  const rel = reliability ? RELIABILITY_STYLES[reliability.source] : null;
  const selectedAdu = types.find((t) => t.id === selectedType) || types[0];

  // Detect coastal/historic from overlays
  const overlays = (property?.overlays as string[] | undefined) || [];
  const isCoastal = overlays.some((ov) => /coastal/i.test(ov));
  const isHistoric = overlays.some((ov) => /historic/i.test(ov));
  const fees = calcFees(size, isCoastal, isHistoric);

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

            {/* Big numbers */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-stone-50 rounded-[10px] px-3 py-2.5 text-center">
                <p className="text-[1.1rem] font-bold text-stone-900">~{fmt(Math.round(fees.total / 100) * 100)}</p>
                <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide mt-0.5">Permit fees</p>
              </div>
              <div className="bg-stone-50 rounded-[10px] px-3 py-2.5 text-center">
                <p className="text-[1.1rem] font-bold text-stone-900">~${Math.round(fees.buildLow / 1000)}k–${Math.round(fees.buildHigh / 1000)}k</p>
                <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide mt-0.5">Construction</p>
              </div>
              <div className="bg-stone-50 rounded-[10px] px-3 py-2.5 text-center">
                <p className="text-[1.1rem] font-bold text-stone-900">{fees.timeline}</p>
                <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide mt-0.5">Timeline</p>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="bg-stone-50 rounded-[10px] px-4 py-3">
              <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2.5">Permit fee breakdown</p>
              {[
                ["Plan check",       fmt(fees.planCheck)],
                ["Building permit",  fmt(fees.buildPermit)],
                ["Water & sewer",    fmt(fees.waterSewer)],
                ["School fees",      fees.schoolFees > 0 ? fmt(fees.schoolFees) : "Exempt"],
                ...(isCoastal  ? [["Coastal permit",  fmt(fees.coastalPermit)]] : []),
                ...(isHistoric ? [["Historic review", fmt(fees.historicReview)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-stone-200 last:border-0 text-[0.8125rem]">
                  <span className="text-stone-500">{label}</span>
                  <span className="text-stone-700 font-medium">{value}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2.5 text-[0.875rem] font-bold text-stone-900">
                <span>Estimated total</span>
                <span>~{fmt(Math.round(fees.total / 100) * 100)}</span>
              </div>
              <p className="text-[0.6875rem] text-stone-400 mt-2">
                Informational only — verify with DSD. {size > 500 && <span className="text-amber-600 font-medium">⚠ Over 500 sq ft adds ~$3,100 in school impact fees.</span>}
              </p>
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
