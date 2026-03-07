"use client";

interface PermitNeeded {
  type?: string;
  name?: string;
  reason?: string;
}

interface FormRequired {
  form_id?: string;
  name?: string;
  purpose?: string;
}

interface Exemption {
  item?: string;
  code_section?: string;
}

interface RoadmapData {
  permits_needed?: PermitNeeded[];
  exemptions?: Exemption[];
  forms_required?: FormRequired[];
  process_steps?: string[];
  estimated_timeline?: string;
  estimated_cost_range?: string;
  tips?: string[];
  special_considerations?: string[];
  note?: string;
  analysis?: string;
}

export function PermitRoadmap({
  data,
  projectDescription,
}: {
  data: Record<string, unknown>;
  projectDescription: string;
}) {
  const roadmap = data as unknown as RoadmapData;

  // If it's just a text analysis (no structured data)
  if (roadmap.analysis && !roadmap.permits_needed) {
    return (
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Permit Analysis</h2>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
          {roadmap.analysis}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold mb-1">Your Permit Roadmap</h2>
        <p className="text-sm text-muted mb-6">
          For: &ldquo;{projectDescription}&rdquo;
        </p>

        {/* Timeline */}
        {roadmap.estimated_timeline && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-primary-dark">Estimated Timeline</p>
              <p className="text-sm text-primary">{roadmap.estimated_timeline}</p>
            </div>
          </div>
        )}

        {/* Permits Needed */}
        {roadmap.permits_needed && roadmap.permits_needed.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary rounded-full text-white text-xs flex items-center justify-center">1</span>
              Permits You&apos;ll Need
            </h3>
            <div className="space-y-2 ml-8">
              {roadmap.permits_needed.map((p, i) => (
                <div key={i} className="bg-surface rounded-lg p-3 border border-border">
                  <p className="font-medium text-foreground">{p.name || p.type}</p>
                  {p.reason && <p className="text-sm text-muted mt-1">{p.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exemptions */}
        {roadmap.exemptions && roadmap.exemptions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Exemptions That May Apply
            </h3>
            <div className="space-y-2 ml-7">
              {roadmap.exemptions.map((e, i) => (
                <div key={i} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">{e.item}</p>
                  {e.code_section && (
                    <p className="text-xs text-green-600 mt-1">Reference: {e.code_section}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required Forms */}
        {roadmap.forms_required && roadmap.forms_required.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary rounded-full text-white text-xs flex items-center justify-center">2</span>
              Required Forms
            </h3>
            <div className="ml-8 space-y-2">
              {roadmap.forms_required.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-muted mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <span className="font-medium text-sm">{f.form_id}</span>
                    {f.name && <span className="text-sm text-muted"> - {f.name}</span>}
                    {f.purpose && <p className="text-xs text-muted">{f.purpose}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Process Steps */}
        {roadmap.process_steps && roadmap.process_steps.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary rounded-full text-white text-xs flex items-center justify-center">3</span>
              Step-by-Step Process
            </h3>
            <ol className="ml-8 space-y-2">
              {roadmap.process_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-surface border border-border rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5 text-muted font-medium">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tips */}
        {roadmap.tips && roadmap.tips.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Helpful Tips
            </h3>
            <ul className="ml-7 space-y-1.5">
              {roadmap.tips.map((tip, i) => (
                <li key={i} className="text-sm text-muted flex items-start gap-2">
                  <span className="text-amber-500 mt-1">&#8226;</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Special Considerations */}
        {roadmap.special_considerations && roadmap.special_considerations.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3">Special Considerations</h3>
            <ul className="ml-4 space-y-1.5">
              {roadmap.special_considerations.map((item, i) => (
                <li key={i} className="text-sm text-muted flex items-start gap-2">
                  <span className="text-primary mt-1">&#8226;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cost Range */}
        {roadmap.estimated_cost_range && (
          <div className="bg-surface border border-border rounded-lg p-4 mb-6">
            <p className="font-medium text-foreground text-sm">Estimated Cost Range</p>
            <p className="text-sm text-muted">{roadmap.estimated_cost_range}</p>
          </div>
        )}

        {/* Note */}
        {roadmap.note && (
          <p className="text-xs text-muted italic border-t border-border pt-4">
            {roadmap.note}
          </p>
        )}

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
          <p className="text-xs text-amber-700">
            <strong>Disclaimer:</strong> This is AI-generated guidance based on San Diego Municipal Code and permit data.
            Always confirm requirements with the Development Services Department at (619) 446-5000 or visit{" "}
            <a href="https://www.sandiego.gov/development-services" className="underline" target="_blank" rel="noopener noreferrer">
              sandiego.gov/development-services
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
