"use client";

import { useState } from "react";

interface PlanStep {
  title: string;
  subtitle?: string;
  detail?: string;
}

interface Phase {
  label: string;
  color: "green" | "violet" | "blue" | "gray";
  steps: PlanStep[];
}

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  category?: string;
}

interface Props {
  phases?: Phase[];
  process_steps?: string[];
  checklist?: { items?: ChecklistItem[] } | Record<string, unknown>;
  estimated_timeline?: string;
  estimated_cost_range?: string;
}

const PHASE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-green-50",  text: "text-green-700",  dot: "🟢" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", dot: "🟣" },
  blue:   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "🔵" },
  gray:   { bg: "bg-stone-100", text: "text-stone-500",  dot: "⚪" },
};

function buildPhasesFromChecklist(items: ChecklistItem[]): Phase[] {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const cat = item.category || "other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  const phases: Phase[] = [];
  for (const [cat, catItems] of groups) {
    const meta = CATEGORY_LABELS[cat] || { label: cat, color: "gray" as const };
    phases.push({
      label: meta.label,
      color: meta.color,
      steps: catItems.map((item) => ({
        title: item.label,
        subtitle: item.required === false ? "Optional" : undefined,
        detail: item.description,
      })),
    });
  }
  return phases;
}

const CATEGORY_LABELS: Record<string, { label: string; color: "green" | "violet" | "blue" | "gray" }> = {
  documents:   { label: "Gather documents", color: "green" },
  plans:       { label: "Plans & drawings", color: "violet" },
  fees:        { label: "Fees & submission", color: "blue" },
  inspections: { label: "Inspections & review", color: "gray" },
};

export function PermitPlan({ phases, process_steps, checklist, estimated_timeline, estimated_cost_range }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Build effective phases from checklist items if no phases/process_steps
  const checklistItems = (checklist as { items?: ChecklistItem[] } | undefined)?.items || [];
  const effectivePhases: Phase[] = phases && phases.length > 0
    ? phases
    : checklistItems.length > 0
    ? buildPhasesFromChecklist(checklistItems)
    : [];

  // Count total steps
  const totalSteps = effectivePhases.length > 0
    ? effectivePhases.reduce((sum, ph) => sum + ph.steps.length, 0)
    : process_steps?.length || 0;

  let globalStepNum = 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Big numbers */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 rounded-[10px] px-3 py-4 text-center">
          <p className="text-[1.25rem] font-bold text-stone-900">{estimated_cost_range || "—"}</p>
          <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Permit fees</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-[10px] px-3 py-4 text-center">
          <p className="text-[1.25rem] font-bold text-stone-900">{estimated_timeline || "—"}</p>
          <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">Timeline</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-[10px] px-3 py-4 text-center">
          <p className="text-[1.25rem] font-bold text-stone-900">{totalSteps} steps</p>
          <p className="text-[0.6875rem] text-stone-500 uppercase tracking-wide font-semibold mt-1">To complete</p>
        </div>
      </div>

      {/* Phased layout */}
      {effectivePhases.length > 0 ? (
        effectivePhases.map((phase, pi) => {
          const style = PHASE_STYLES[phase.color] || PHASE_STYLES.gray;
          return (
            <div key={pi}>
              {/* Phase label */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6875rem] font-bold uppercase tracking-[0.06em] mb-3 ${style.bg} ${style.text}`}
              >
                {style.dot} {phase.label}
              </div>

              {/* Steps */}
              <div className="flex flex-col gap-2">
                {phase.steps.map((step, si) => {
                  globalStepNum++;
                  const key = `${pi}-${si}`;
                  const hasDetail = !!step.detail;
                  const isOpen = expanded[key];

                  return (
                    <div
                      key={key}
                      className="bg-white border border-stone-200 rounded-[14px] overflow-hidden"
                    >
                      <div
                        className={`flex items-center gap-3.5 px-5 py-4 ${hasDetail ? "cursor-pointer" : ""}`}
                        onClick={hasDetail ? () => toggle(key) : undefined}
                      >
                        <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-[0.8125rem] font-bold text-stone-500 shrink-0">
                          {globalStepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.9375rem] font-bold text-stone-900 leading-tight">
                            {step.title}
                          </div>
                          {step.subtitle && (
                            <div className="text-[0.8125rem] text-stone-500 mt-0.5">
                              {step.subtitle}
                            </div>
                          )}
                        </div>
                        {hasDetail && (
                          <span className={`text-stone-300 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                            ›
                          </span>
                        )}
                      </div>
                      {hasDetail && isOpen && (
                        <div className="px-5 pb-4 pl-[4.25rem] text-[0.875rem] text-stone-600 leading-[1.65]">
                          {step.detail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : process_steps && process_steps.length > 0 ? (
        /* Flat fallback */
        <div className="flex flex-col gap-2">
          {process_steps.map((step, i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-[14px] flex items-center gap-3.5 px-5 py-4">
              <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-[0.8125rem] font-bold text-stone-500 shrink-0">
                {i + 1}
              </div>
              <div className="text-[0.9375rem] font-medium text-stone-900">{step}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Final celebration step */}
      <div className="bg-white border border-stone-200 rounded-[14px] flex items-center gap-3.5 px-5 py-4">
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-[0.8125rem] font-bold text-white shrink-0">
          ✓
        </div>
        <div>
          <div className="text-[0.9375rem] font-bold text-stone-900">
            Permit issued — start building! 🎉
          </div>
          <div className="text-[0.8125rem] text-stone-500">
            ~2 days after final approval
          </div>
        </div>
      </div>
    </div>
  );
}
