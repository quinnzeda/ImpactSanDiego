"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CostEstimateResult } from "../lib/cost-estimator";

interface Props {
  selectedType: string;
  selectedLabel: string;
  property?: Record<string, unknown>;
  onGetPlan: (selectedType: string, size: number, costs: { permitFees: string; timeline: string }) => void;
}

const TYPE_MAP: Record<string, string> = {
  detached: "adu_detached",
  attached: "adu_attached",
  garage: "adu_garage_conversion",
  jadu: "jadu",
  conversion: "adu_garage_conversion",
};

function fmt(n: number): string {
  return "$" + n.toLocaleString();
}

function fmtK(n: number): string {
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + n.toLocaleString();
}

const FEE_LABELS: Record<string, string> = {
  building_permit: "Building permit",
  plan_check: "Plan check",
  school_impact: "School fees",
  water_sewer: "Water & sewer",
  smip: "SMIP",
  green_building: "Green building",
  tech_surcharge: "Tech surcharge",
  coastal_permit: "Coastal permit",
  historic_review: "Historic review",
};

export function CostCalculator({ selectedType, selectedLabel, property, onGetPlan }: Props) {
  const maxSize = selectedType === "jadu" ? 500 : 1200;
  const defaultSize = selectedType === "jadu" ? 400 : 500;
  const [size, setSize] = useState(defaultSize);
  const [estimate, setEstimate] = useState<CostEstimateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Clamp size when type changes
  useEffect(() => {
    const newDefault = selectedType === "jadu" ? 400 : 500;
    const newMax = selectedType === "jadu" ? 500 : 1200;
    setSize((prev) => Math.min(prev, newMax) || newDefault);
  }, [selectedType]);

  const overlays = (property?.overlays as string[] | undefined) || [];
  const isCoastal = overlays.some((ov) => /coastal/i.test(ov));
  const isHistoric = overlays.some((ov) => /historic/i.test(ov));

  const fetchEstimate = useCallback(
    (sqft: number) => {
      const projectType = TYPE_MAP[selectedType] || "adu_detached";
      const params = new URLSearchParams({
        project_type: projectType,
        size_sqft: String(sqft),
        coastal_zone: String(isCoastal),
        historic_district: String(isHistoric),
      });
      setLoading(true);
      fetch(`/api/estimate-cost?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setEstimate(data as CostEstimateResult);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [selectedType, isCoastal, isHistoric],
  );

  // Fetch on mount and when type/overlays change
  useEffect(() => {
    fetchEstimate(size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEstimate]);

  const handleSizeChange = (newSize: number) => {
    setSize(newSize);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchEstimate(newSize), 300);
  };

  const permitTotal = estimate ? (estimate.permit_fees.total as number) : 0;
  const profFees = estimate && Array.isArray(estimate.professional_fees) ? estimate.professional_fees : [];

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
            max={maxSize}
            step={50}
            value={size}
            onChange={(e) => handleSizeChange(Number(e.target.value))}
            className="w-full accent-sage-500 cursor-pointer"
          />
          <div className="flex justify-between text-[0.6875rem] text-stone-400 mt-0.5">
            <span>150 sq ft</span>
            <span>{maxSize.toLocaleString()} sq ft</span>
          </div>
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-stone-50 rounded-[10px] px-3 py-4 text-center">
            <p className="text-[1.25rem] font-bold text-stone-900">
              {loading ? "…" : `~${fmt(Math.round(permitTotal / 100) * 100)}`}
            </p>
            <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Permit fees</p>
          </div>
          <div className="bg-stone-50 rounded-[10px] px-3 py-4 text-center">
            <p className="text-[1.25rem] font-bold text-stone-900">
              {loading || !estimate ? "…" : `~${fmtK(estimate.construction_cost.low)}–${fmtK(estimate.construction_cost.high)}`}
            </p>
            <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Construction est.</p>
          </div>
          <div className="bg-stone-50 rounded-[10px] px-3 py-4 text-center">
            <p className="text-[1.25rem] font-bold text-stone-900">
              {loading || !estimate ? "…" : estimate.timeline.total}
            </p>
            <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Total timeline</p>
          </div>
        </div>

        {/* Timeline breakdown */}
        {estimate && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {([["Design", estimate.timeline.design], ["Permitting", estimate.timeline.permit], ["Construction", estimate.timeline.construction]] as const).map(([label, value]) => (
              <div key={label} className="text-center">
                <p className="text-[0.8125rem] font-medium text-stone-700">{value}</p>
                <p className="text-[0.625rem] text-stone-400 uppercase tracking-wide font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fee breakdown */}
        {estimate && !loading && (
          <div className="bg-stone-50 rounded-[10px] px-4 py-3 mb-4">
            <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2.5">Permit fee breakdown</p>
            {Object.entries(estimate.permit_fees)
              .filter(([key]) => key !== "total")
              .map(([key, value]) => (
                <div key={key} className="flex justify-between py-1.5 border-b border-stone-200 last:border-0 text-[0.8125rem]">
                  <span className="text-stone-500">{FEE_LABELS[key] || key}</span>
                  <span className="text-stone-700 font-medium">{value != null ? fmt(value) : "—"}</span>
                </div>
              ))}
            <div className="flex justify-between pt-2.5 text-[0.875rem] font-bold text-stone-900">
              <span>Estimated total</span>
              <span>~{fmt(Math.round(permitTotal / 100) * 100)}</span>
            </div>
          </div>
        )}

        {/* Professional fees */}
        {profFees.length > 0 && !loading && (
          <div className="bg-stone-50 rounded-[10px] px-4 py-3 mb-4">
            <p className="text-[0.6875rem] font-semibold text-stone-400 tracking-[0.06em] uppercase mb-2.5">Professional fees</p>
            {profFees.map((fee) => (
              <div key={fee.service} className="flex justify-between py-1.5 border-b border-stone-200 last:border-0 text-[0.8125rem]">
                <span className="text-stone-500">
                  {fee.service}
                  {fee.note && <span className="text-[0.6875rem] text-stone-400 ml-1">({fee.note})</span>}
                </span>
                <span className="text-stone-700 font-medium">{fmt(fee.low)}–{fmt(fee.high)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {estimate?.warnings && estimate.warnings.length > 0 && !loading && (
          <div className="flex flex-col gap-2 mb-4">
            {estimate.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[0.8125rem] text-amber-800">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Savings tips */}
        {estimate?.savings_tips && estimate.savings_tips.length > 0 && !loading && (
          <div className="flex flex-col gap-2">
            {estimate.savings_tips.map((tip) => (
              <div key={tip} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[0.8125rem] text-green-800">
                <span className="shrink-0 mt-0.5">💡</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ready CTA card */}
      <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-[14px] p-8 text-center">
        <h2 className="font-serif text-[1.25rem] font-bold text-stone-900 mb-2">Ready to see your full plan?</h2>
        <p className="text-[0.9375rem] text-stone-500 mb-5 max-w-md mx-auto">
          Based on your choices, I'll build a step-by-step plan with everything you need to do, in order, with direct links to every form and office.
        </p>
        <button
          type="button"
          onClick={() =>
            onGetPlan(selectedType, size, {
              permitFees: estimate ? `~${fmt(Math.round(permitTotal / 100) * 100)}` : "—",
              timeline: estimate?.timeline.total || "—",
            })
          }
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
