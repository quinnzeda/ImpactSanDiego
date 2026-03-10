"use client";

import { useState } from "react";

interface Props {
  selectedType: string;
  selectedLabel: string;
  property?: Record<string, unknown>;
  onGetPlan: (selectedType: string, size: number) => void;
}

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

export function CostCalculator({ selectedType, selectedLabel, property, onGetPlan }: Props) {
  const [size, setSize] = useState(500);

  const overlays = (property?.overlays as string[] | undefined) || [];
  const isCoastal = overlays.some((ov) => /coastal/i.test(ov));
  const isHistoric = overlays.some((ov) => /historic/i.test(ov));
  const fees = calcFees(size, isCoastal, isHistoric);

  return (
    <div className="flex flex-col gap-5">
      {/* Calculator card */}
      <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden p-6">
        <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">Cost & timeline calculator</h2>
        <p className="text-[0.875rem] text-stone-500 mb-6">Adjust the size and see how it changes your costs in real time</p>

        {/* Size slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.9375rem] font-semibold text-stone-900">ADU size</span>
            <span className="text-[0.9375rem] font-bold text-sage-600">{size.toLocaleString()} sq ft</span>
          </div>
          <input
            type="range"
            min={150}
            max={1200}
            step={50}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-sage-500 cursor-pointer"
          />
          {size > 500 && (
            <p className="text-[0.75rem] text-amber-600 font-semibold mt-1.5">
              ⚠️ Over 500 sq ft adds ~$3,100 in school impact fees
            </p>
          )}
          {size > 800 && (
            <p className="text-[0.75rem] text-amber-600 font-semibold mt-1">
              ⚠️ Over 800 sq ft must comply with floor area ratio limits
            </p>
          )}
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-stone-50 rounded-[10px] px-3 py-4 text-center">
            <p className="text-[1.25rem] font-bold text-stone-900">~{fmt(Math.round(fees.total / 100) * 100)}</p>
            <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Permit fees</p>
          </div>
          <div className="bg-stone-50 rounded-[10px] px-3 py-4 text-center">
            <p className="text-[1.25rem] font-bold text-stone-900">~${Math.round(fees.buildLow / 1000)}k–${Math.round(fees.buildHigh / 1000)}k</p>
            <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Construction est.</p>
          </div>
          <div className="bg-stone-50 rounded-[10px] px-3 py-4 text-center">
            <p className="text-[1.25rem] font-bold text-stone-900">{fees.timeline}</p>
            <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Total timeline</p>
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="bg-stone-50 rounded-[10px] px-4 py-3">
          <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2.5">Permit fee breakdown</p>
          {[
            ["Plan check", fmt(fees.planCheck)],
            ["Building permit", fmt(fees.buildPermit)],
            ["Water & sewer", fmt(fees.waterSewer)],
            ["School fees", fees.schoolFees > 0 ? fmt(fees.schoolFees) : "Exempt"],
            ...(isCoastal ? [["Coastal permit", fmt(fees.coastalPermit)]] : []),
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
        </div>
      </div>

      {/* Ready CTA card */}
      <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-[14px] p-8 text-center">
        <h2 className="font-serif text-[1.25rem] font-bold text-stone-900 mb-2">Ready to see your full plan?</h2>
        <p className="text-[0.9375rem] text-stone-500 mb-5 max-w-md mx-auto">
          Based on your choices, I'll build a step-by-step plan with everything you need to do, in order, with direct links to every form and office.
        </p>
        <button
          type="button"
          onClick={() => onGetPlan(selectedType, size)}
          className="inline-flex items-center gap-2 text-[1rem] font-semibold text-white bg-stone-900 border-none rounded-full py-3.5 px-8 transition-all duration-150 hover:bg-black hover:-translate-y-px active:translate-y-0 cursor-pointer"
        >
          Show me my plan
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
