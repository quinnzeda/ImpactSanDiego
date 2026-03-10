import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNavigationContext } from "../../lib/data-layer";
import { lookupProperty, type PropertyLookupData } from "../property-lookup/route";

type Situation = "planning" | "applying" | "waiting";
type Category = "adu" | "kitchen-bath" | "room-addition" | "solar" | "deck-fence";
type CanvasType = "verdict" | "checklist" | "status" | "options" | "roadmap";

function isAduProject(description: string): boolean {
  const desc = description.toLowerCase();
  return desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny") || desc.includes("in-law");
}

function isAduIneligibleZone(property: PropertyLookupData | null): boolean {
  return property?.property_type === "commercial" || property?.property_type === "industrial";
}

function isOutsideSanDiego(property: PropertyLookupData | null): boolean {
  return !!property?.city && property.city.toLowerCase() !== "san diego";
}

function buildVerdictResponse(opts: {
  level: string;
  headline: string;
  reason: string;
  whatChanges: string;
  tips: string[];
  property: PropertyLookupData;
  notes: string[];
}) {
  return {
    permits_needed: [],
    exemptions: [],
    forms_required: [],
    process_steps: [],
    estimated_timeline: "N/A",
    estimated_cost_range: "N/A",
    tips: opts.tips,
    canvas: "verdict" as CanvasType,
    verdict: {
      level: opts.level,
      headline: opts.headline,
      reason: opts.reason,
      what_changes_everything: opts.whatChanges,
    },
    property: mergePropertyData(undefined, opts.property),
    reliability: { source: "live", notes: opts.notes },
  };
}

function buildOutsideJurisdictionResponse(property: PropertyLookupData) {
  const city = property.city ?? "this city";
  return buildVerdictResponse({
    level: "amber",
    headline: `This address is in ${city}, not the City of San Diego.`,
    reason: `Our zoning data and permit guidance covers the City of San Diego only. ${city} has its own building department, zoning codes, and permit processes.`,
    whatChanges: "If you have an address within San Diego city limits, try that instead.",
    tips: [
      `Contact ${city}'s building department for permit requirements.`,
      "San Diego County unincorporated areas are handled by the County Planning & Development Services: (858) 694-2960.",
      "Each city in San Diego County has its own zoning codes and permit processes.",
    ],
    property,
    notes: [
      `Address geocoded to ${city} (outside City of San Diego jurisdiction)`,
      ...property.data_sources.map((s) => `Data from: ${s}`),
    ],
  });
}

function buildAduIneligibleResponse(property: PropertyLookupData) {
  const zoneLabel = property.zone_code
    ? `${property.zone_code} (${property.zone_plain_english ?? property.property_type})`
    : property.property_type ?? "this zone";

  return buildVerdictResponse({
    level: "red",
    headline: `ADUs are not permitted in ${zoneLabel}.`,
    reason: `This property is zoned ${zoneLabel}, which is a ${property.property_type} zone. Traditional Accessory Dwelling Units (ADUs) are only permitted on residential properties (single-family and multi-family zones) under San Diego Municipal Code §141.0302 and California Government Code §65852.2.`,
    whatChanges: "A zone change or community plan amendment could potentially enable residential use, but this requires a separate discretionary process. Consult DSD for options.",
    tips: [
      "If this is a mixed-use zone, residential units may be possible through a different permit pathway — consult DSD.",
      "Contact the Development Services Department at (619) 446-5000 for site-specific guidance.",
      "Visit https://www.sandiego.gov/development-services for more information.",
    ],
    property,
    notes: [
      `Zoning verified via City of San Diego ArcGIS: ${property.zone_code}`,
      ...property.data_sources.map((s) => `Property data from: ${s}`),
    ],
  });
}

function selectCanvas(
  situation?: Situation,
  category?: Category,
  description?: string
): CanvasType {
  const desc = (description || "").toLowerCase();
  const aduOptionsTerms = ["size", "sqft", "sq ft", "detached", "attached", "garage", "jadu", "option"];
  const isAduOptionsIntent = category === "adu" && aduOptionsTerms.some((t) => desc.includes(t));

  if (situation === "waiting") return "status";
  if (situation === "applying") return "checklist";
  // ADU planning always shows verdict first (with options embedded for ADU category)
  if (situation === "planning") return "verdict";
  return "roadmap";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    project_description,
    property_address,
    include_questions,
    answers,
    situation,
    category,
  } = body;

  if (!project_description) {
    return NextResponse.json(
      { error: "project_description is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fetch real property data when address is provided (runs for both phases)
  let propertyData: PropertyLookupData | null = null;
  if (property_address) {
    try {
      propertyData = await lookupProperty(property_address);
    } catch (e) {
      console.error("Property lookup error:", e);
    }
  }

  // Short-circuit: address outside City of San Diego → can't provide guidance
  if (isOutsideSanDiego(propertyData)) {
    return NextResponse.json(buildOutsideJurisdictionResponse(propertyData!));
  }

  // Short-circuit: ADU in commercial/industrial zone → not eligible
  if (isAduProject(project_description) && isAduIneligibleZone(propertyData)) {
    return NextResponse.json(buildAduIneligibleResponse(propertyData!));
  }

  // Phase 1: Return clarifying questions
  if (include_questions && !answers) {
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey, timeout: 15000, maxRetries: 0 });
        const systemPrompt = getNavigationContext();
        let userMsg = property_address
          ? `Project: ${project_description}\nProperty Address: ${property_address}`
          : `Project: ${project_description}`;

        if (propertyData?.zone_code) {
          userMsg += `\n\nProperty data already confirmed from public records:`;
          userMsg += `\n- Zone: ${propertyData.zone_code} (${propertyData.zone_plain_english ?? ""})`;
          if (propertyData.property_type) userMsg += `\n- Property type: ${propertyData.property_type}`;
          if (propertyData.lot_size_sqft) userMsg += `\n- Lot size: ${propertyData.lot_size_sqft.toLocaleString()} sq ft`;
          if (propertyData.year_built) userMsg += `\n- Year built: ${propertyData.year_built}`;
          if (propertyData.is_coastal) userMsg += `\n- In Coastal Zone: YES`;
          if (propertyData.is_historic) userMsg += `\n- In Historic District: YES`;
          if (propertyData.overlays.length > 0) userMsg += `\n- Overlays: ${propertyData.overlays.join(", ")}`;
          if (propertyData.past_permits.length > 0) {
            userMsg += `\n- Past permits: ${propertyData.past_permits.map((p) => `${p.type} (${p.year ?? "?"}, ${p.status})`).join(", ")}`;
          }
          userMsg += `\n\nDo NOT ask about property type, historic district, or coastal zone — these are already known. Only ask questions about project-specific details the user must provide.`;
        }

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Analyze this project and generate 3-6 clarifying questions for more precise permit guidance. Focus on details that affect which permits are needed.\n\nProject: ${userMsg}\n\nRespond ONLY with valid JSON:\n{"phase":"questions","project_summary":"...","questions":[{"id":"q1","question":"...","why":"...","options":["a","b","c"]}],"preliminary_assessment":"..."}`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            // Attach property data to questions phase so the frontend can show it immediately
            if (propertyData && propertyData.data_sources.length > 0) {
              parsed.property_preview = propertyData;
            }
            return NextResponse.json(parsed);
          } catch {
            /* fall through */
          }
        }
      } catch (e) {
        console.error("Questions generation error:", e);
      }
    }
    return NextResponse.json(getFallbackQuestions(project_description, propertyData));
  }

  // Phase 2: Generate roadmap with canvas contract
  const canvasType = selectCanvas(situation, category, project_description);

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey, timeout: 50000, maxRetries: 0 });
      const systemPrompt = getNavigationContext();
      let userMsg = property_address
        ? `Project: ${project_description}\nProperty Address: ${property_address}`
        : `Project: ${project_description}`;

      if (answers && Object.keys(answers).length > 0) {
        userMsg += "\n\nAdditional details from Q&A:\n";
        for (const [key, value] of Object.entries(answers)) {
          userMsg += `- ${key}: ${value}\n`;
        }
      }

      if (situation) userMsg += `\nUser situation: ${situation}`;
      if (category) userMsg += `\nProject category: ${category}`;

      // Inject real property data into AI context
      if (propertyData && propertyData.data_sources.length > 0) {
        userMsg += `\n\nConfirmed property data (from public records — do not ask about these):`;
        if (propertyData.zone_code) userMsg += `\n- Zone: ${propertyData.zone_code} (${propertyData.zone_plain_english ?? ""})`;
        if (propertyData.property_type) userMsg += `\n- Property type: ${propertyData.property_type}`;
        if (propertyData.lot_size_sqft) userMsg += `\n- Lot size: ${propertyData.lot_size_sqft.toLocaleString()} sq ft`;
        if (propertyData.year_built) userMsg += `\n- Year built: ${propertyData.year_built}`;
        userMsg += `\n- In Coastal Zone: ${propertyData.is_coastal ? "YES" : "NO"}`;
        userMsg += `\n- In Historic District: ${propertyData.is_historic ? "YES" : "NO"}`;
        if (propertyData.overlays.length > 0) userMsg += `\n- Special overlays: ${propertyData.overlays.join(", ")}`;
        if (propertyData.past_permits.length > 0) {
          userMsg += `\n- Past permits: ${propertyData.past_permits.map((p) => `${p.type} (${p.year ?? "?"}, ${p.status})`).join("; ")}`;
        }
      }

      // Build a focused prompt based on canvas type — avoid requesting ALL fields
      const coreFields = `"permits_needed":[{"type":"...","name":"...","reason":"..."}],"exemptions":[{"item":"...","code_section":"..."}],"forms_required":[{"form_id":"...","name":"..."}],"process_steps":["step 1","step 2"],"estimated_timeline":"...","estimated_cost_range":"...","tips":["..."]`;
      const verdictField = `"verdict":{"level":"green|amber|red","headline":"one sentence","reason":"2-3 sentences","what_changes_everything":"key factor"}`;
      const phasesField = canvasType === "checklist"
        ? `,"phases":[{"label":"phase name with timing and cost e.g. 'Preparation · Do this now · Free · 1–2 weeks'","color":"green|violet|blue|gray","steps":[{"title":"specific action","subtitle":"time estimate e.g. '30 minutes' or '5–7 day wait'","detail":"1-2 sentences: WHY this matters for THIS property. Include property-specific notes (coastal zone → submit coastal + building permits together; historic → photograph all 4 sides; year built triggers historic review). Include URLs: OpenDSD portal (https://aca-prod.accela.com/SANDIEGO/Default.aspx), Assessor records (https://arcc-public.sandiegocounty.gov/), DSD office 1222 First Ave."}]}]`
        : "";
      const optionsField = (canvasType === "options" || (canvasType === "verdict" && category === "adu"))
        ? `,"options":{"adu_types":[{"id":"detached|attached|garage|jadu|conversion","label":"...","description":"one sentence","pros":["..."],"cons":["..."]}],"default_type":"...","size_range":{"min":150,"max":1200,"default":600}}`
        : "";
      const checklistField = canvasType === "checklist"
        ? `,"checklist":{"items":[{"id":"c1","label":"document or task name","description":"why it's needed","required":true,"category":"documents|plans|fees|inspections"}]}`
        : "";

      const needsLargeResponse = canvasType === "checklist" || canvasType === "options" || (canvasType === "verdict" && category === "adu");
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: needsLargeResponse ? 4000 : 2000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Provide a concise San Diego permit roadmap.\n\n${userMsg}\n\nRespond ONLY with valid JSON:\n{${coreFields},${verdictField}${phasesField}${optionsField}${checklistField},"canvas":"${canvasType}"}`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (!parsed.canvas) parsed.canvas = canvasType;
          if (!parsed.reliability)
            parsed.reliability = { source: "ai", notes: ["AI-generated guidance"] };
          // Ensure ADU options are populated when canvas is "options" or verdict+adu
          if ((parsed.canvas === "options" || (parsed.canvas === "verdict" && category === "adu")) &&
              (!parsed.options?.adu_types || parsed.options.adu_types.length === 0)) {
            parsed.options = getDefaultAduOptions(propertyData);
          }
          // Ensure checklist items are populated when canvas is "checklist"
          if (parsed.canvas === "checklist" && (!parsed.checklist?.items || parsed.checklist.items.length === 0)) {
            const fallback = getFallbackNavigation(project_description, answers, situation, category, propertyData) as Record<string, unknown>;
            const fallbackChecklist = fallback["checklist"] as { items?: unknown[] } | undefined;
            if (fallbackChecklist?.items) {
              parsed.checklist = fallbackChecklist;
            }
          }
          // Merge real property data over AI-guessed property fields
          if (propertyData && propertyData.data_sources.length > 0) {
            parsed.property = mergePropertyData(parsed.property, propertyData, property_address);
            parsed.reliability.source = "live";
            if (propertyData.is_coastal || propertyData.is_historic) {
              parsed.reliability.notes = [
                ...(parsed.reliability.notes ?? []),
                ...propertyData.data_sources.map((s) => `Property data from: ${s}`),
              ];
            }
          }
          return NextResponse.json(parsed);
        } catch {
          /* fall through */
        }
      }
      return NextResponse.json({
        analysis: text,
        canvas: "roadmap",
        reliability: { source: "ai", notes: [] },
      });
    } catch (e) {
      console.error("Roadmap generation error:", e);
    }
  }

  return NextResponse.json(
    getFallbackNavigation(project_description, answers, situation, category, propertyData)
  );
}

// Merge confirmed ArcGIS/Socrata property data over AI-guessed property fields
function mergePropertyData(
  aiProperty: Record<string, unknown> | undefined,
  real: PropertyLookupData,
  rawAddress?: string
): Record<string, unknown> {
  const base = aiProperty ?? {};
  return {
    ...base,
    address: real.address ?? rawAddress ?? base.address,
    apn: real.apn ?? base.apn ?? null,
    zone_code: real.zone_code ?? base.zone_code ?? null,
    zone_plain_english: real.zone_plain_english ?? base.zone_plain_english ?? null,
    lot_size_sqft: real.lot_size_sqft ?? base.lot_size_sqft ?? null,
    year_built: real.year_built ?? base.year_built ?? null,
    overlays: real.overlays.length > 0 ? real.overlays : (base.overlays ?? []),
    past_permits: real.past_permits.length > 0 ? real.past_permits : (base.past_permits ?? []),
    community_plan_area: real.community_plan_area ?? base.community_plan_area ?? null,
    council_district: real.council_district ?? base.council_district ?? null,
    max_height_ft: real.max_height_ft ?? base.max_height_ft ?? null,
    height_note: real.height_note ?? base.height_note ?? null,
    front_setback_ft: real.front_setback_ft ?? base.front_setback_ft ?? null,
    side_setback_ft: real.side_setback_ft ?? base.side_setback_ft ?? null,
    rear_setback_ft: real.rear_setback_ft ?? base.rear_setback_ft ?? null,
    setback_note: real.setback_note ?? base.setback_note ?? null,
    allowed_units_description: real.allowed_units_description ?? base.allowed_units_description ?? null,
    is_coastal: real.is_coastal ?? base.is_coastal ?? false,
    is_historic: real.is_historic ?? base.is_historic ?? false,
    in_coastal_height_limit: real.in_coastal_height_limit ?? base.in_coastal_height_limit ?? null,
    data_sources: real.data_sources,
  };
}

function getDefaultAduOptions(property?: PropertyLookupData | null) {
  const isMultiFamily = property?.property_type === "multi-family";
  if (isMultiFamily) {
    return {
      adu_types: [
        { id: "conversion", label: "Convert Non-Livable Space", description: "Convert storage, laundry, or boiler rooms into dwelling units", pros: ["Uses existing structure", "No additional footprint", "Often lower cost"], cons: ["Limited to existing non-livable areas", "May displace shared amenities"] },
        { id: "detached", label: "Detached ADU", description: "New standalone structure on the property", pros: ["Design flexibility", "Privacy for tenants", "At least one always allowed"], cons: ["Requires available lot space", "Higher construction cost"] },
        { id: "attached", label: "Attached ADU", description: "Addition connected to the existing building", pros: ["Shared walls reduce cost", "Less site work"], cons: ["May affect existing building layout", "Design constraints"] },
      ],
      default_type: "conversion",
      size_range: { min: 150, max: 800, default: 500 },
    };
  }
  return {
    adu_types: [
      { id: "detached", label: "Detached ADU", description: "Standalone structure separate from the main house", pros: ["Most privacy for tenant", "Design flexibility", "Higher rental income potential"], cons: ["Requires separate utility connections", "Largest site footprint"] },
      { id: "attached", label: "Attached ADU", description: "Addition connected to the main house", pros: ["Shared walls reduce construction cost", "Less site work required"], cons: ["Less privacy", "May affect main house living space"] },
      { id: "garage", label: "Garage Conversion", description: "Convert existing attached or detached garage", pros: ["Lowest cost option", "No setback changes needed", "Fastest approval path"], cons: ["Lose garage space", "Limited square footage"] },
      { id: "jadu", label: "Junior ADU (JADU)", description: "Up to 500 sq ft within existing home footprint", pros: ["Fastest approvals", "No parking required", "No impact fees"], cons: ["Max 500 sq ft", "Owner must occupy primary residence"] },
    ],
    default_type: "detached",
    size_range: { min: 150, max: 1200, default: 600 },
  };
}

function getFallbackQuestions(description: string, property?: PropertyLookupData | null) {
  const desc = description.toLowerCase();
  const questions: Array<{ id: string; question: string; why: string; options?: string[] }> = [];
  // Questions we can skip because we already have the answer from property lookup
  const knownPropertyType = !!property?.property_type && property.property_type !== "unknown";
  const knownHistoric = property != null; // if we ran lookup, we know one way or another

  if (desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny")) {
    questions.push(
      { id: "q_adu_type", question: "What type of ADU?", why: "Each type has different requirements", options: ["Detached (new build)", "Attached (addition)", "Garage conversion", "Junior ADU (within existing home)"] },
      { id: "q_adu_size", question: "What approximate square footage?", why: "Under 750 sq ft = no impact fees", options: ["Under 500 sq ft", "500-750 sq ft", "750-1,000 sq ft", "1,000-1,200 sq ft"] },
      { id: "q_transit", question: "Is the property within 1/2 mile of a public transit stop?", why: "No parking required near transit", options: ["Yes", "No", "Not sure"] },
    );
  } else if (desc.includes("solar") || desc.includes("photovoltaic")) {
    questions.push(
      { id: "q_solar_size", question: "What system size (kW)?", why: "Affects fees and review process" },
      { id: "q_battery", question: "Will you include battery storage?", why: "Batteries need additional fire safety review", options: ["Yes", "No"] },
      { id: "q_roof_type", question: "What type of roof?", why: "Affects structural attachment plan", options: ["Comp shingle", "Tile", "Flat/low-slope", "Metal"] },
    );
  } else if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom")) {
    questions.push(
      { id: "q_structural", question: "Will you remove or modify any walls?", why: "Structural changes need engineering review", options: ["No", "Non-load-bearing only", "Load-bearing walls", "Not sure"] },
      { id: "q_plumbing", question: "Will plumbing fixtures be moved?", why: "Moving plumbing increases scope", options: ["No", "Yes", "Adding new fixtures"] },
      { id: "q_scope", question: "Approximate project cost?", why: "Affects fees and review tier", options: ["Under $25K", "$25K-$75K", "$75K-$150K", "Over $150K"] },
    );
  } else {
    questions.push(
      { id: "q_scope", question: "What structural work is involved?", why: "Determines permit type needed" },
      { id: "q_contractor", question: "Hiring a contractor or owner-builder?", why: "Owner-builders need DS-16 form", options: ["Licensed contractor", "Owner-builder", "Undecided"] },
    );
  }

  // Only ask property type / historic if we couldn't determine them from the address lookup
  if (!knownPropertyType) {
    questions.push({ id: "q_property_type", question: "Property type?", why: "Different requirements by property type", options: ["Single-family", "Multi-family", "Commercial"] });
  }
  if (!knownHistoric) {
    questions.push({ id: "q_historic", question: "In a historic district?", why: "May need HRB review", options: ["No", "Yes", "Not sure"] });
  }

  const result: Record<string, unknown> = {
    phase: "questions",
    project_summary: description,
    questions,
    preliminary_assessment: getPreliminaryAssessment(desc),
  };
  if (property && property.data_sources.length > 0) {
    result.property_preview = property;
  }
  return result;
}

function getPreliminaryAssessment(desc: string): string {
  if (desc.includes("adu") || desc.includes("accessory dwelling")) return "Likely requires an ADU Permit (60-day state-mandated processing).";
  if (desc.includes("solar")) return "Requires a PV permit (1-3 weeks, expedited available).";
  if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom")) return "Likely needs a Combination Building Permit (4-8 weeks).";
  if (desc.includes("water heater") || desc.includes("hvac")) return "Likely a No-Plan MEP permit (same day to 1 week).";
  return "Permit requirements depend on scope. Answer the questions below for specific guidance.";
}

function getFallbackNavigation(
  description: string,
  answers?: Record<string, string>,
  situation?: Situation,
  category?: Category,
  property?: PropertyLookupData | null
) {
  const desc = description.toLowerCase();
  const canvas = selectCanvas(situation, category, description);

  const result: Record<string, unknown> = {
    permits_needed: [] as Array<{ type: string; name: string; reason: string }>,
    exemptions: [] as Array<{ item: string; code_section: string }>,
    forms_required: [{ form_id: "DS-345", name: "Application for Building Permit" }],
    process_steps: [] as string[],
    estimated_timeline: "",
    tips: [] as string[],
    note: answers ? "Roadmap refined with your answers." : "Based on San Diego Municipal Code and state ADU law.",
    canvas,
    reliability: {
      source: "fallback",
      notes: [
        "Rule-based estimate using San Diego Municipal Code data.",
        "AI analysis was temporarily unavailable.",
        "Contact DSD at (619) 446-5000 to confirm current requirements.",
      ],
    },
  };

  if (desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny")) {
    // Safety net: ineligible zones should have been caught by early return, but handle here too
    if (isAduIneligibleZone(property ?? null)) {
      return buildAduIneligibleResponse(property!);
    }

    const isMultiFamily = property?.property_type === "multi-family";

    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push(
      { type: "adu_permit", name: "ADU Permit", reason: "Required for ADU construction" }
    );
    (result.forms_required as Array<{ form_id: string; name: string }>).push(
      { form_id: "DS-530", name: "ADU Supplemental Application" },
      { form_id: "DS-560", name: "Plan Submittal Requirements" }
    );
    result.estimated_timeline = "60 days max (state mandate)";
    result.process_steps = [
      "Pre-application consultation",
      "Prepare plans per DS-560",
      "Submit DS-345 + DS-530 + plans",
      "Plan review (60-day max)",
      "Permit issuance",
      "Construction with inspections",
      "Final inspection + certificate of occupancy",
    ];

    if (isMultiFamily) {
      result.tips = [
        "Multi-family ADUs: convert non-livable space (storage, laundry, etc.) or build detached",
        "At least one 800 sq ft detached ADU is always allowed",
        "Additional detached ADUs up to 25% of existing unit count",
        "JADUs do not apply to multi-family properties",
        "No impact fees under 750 sq ft",
        "No parking required near transit",
      ];
    } else {
      result.tips = [
        "No impact fees under 750 sq ft",
        "4-foot setbacks for detached",
        "No parking required near transit",
        "Max 1,200 sq ft detached",
      ];
    }

    if (answers?.q_adu_type === "Garage conversion") {
      result.tips = [
        ...(result.tips as string[]),
        "Garage conversions often qualify as JADU (simpler process)",
        "No setback changes needed for existing structure",
      ];
    }
    if (answers?.q_adu_size?.includes("Under") || answers?.q_adu_size?.includes("500")) {
      result.tips = [
        ...(result.tips as string[]),
        "Your unit size qualifies for waived impact fees",
      ];
    }

    if (canvas === "verdict") {
      if (isMultiFamily) {
        result.verdict = {
          level: "green",
          headline: "ADUs are allowed on multi-family properties with specific rules.",
          reason:
            "California law permits ADUs on multi-family lots by converting non-livable space or adding detached units (up to 25% of existing unit count, minimum 1). The city must approve within 60 days.",
          what_changes_everything:
            "The number of existing units determines how many new ADUs are allowed. Coastal overlay or historic district could add requirements.",
        };
      } else {
        result.verdict = {
          level: "green",
          headline: "ADUs are generally allowed on single-family lots in San Diego.",
          reason:
            "California law (AB 68, SB 9) and San Diego's ADU ordinance permit detached ADUs up to 1,200 sq ft on most residential lots. The city must approve within 60 days.",
          what_changes_everything:
            "Coastal overlay, hillside designation, or historic district could add requirements. Address-specific zoning verification is recommended.",
        };
      }
      // Also include options so verdict + options render together for ADU
      result.options = getDefaultAduOptions(property);
    } else if (canvas === "checklist") {
      result.checklist = {
        items: [
          { id: "c1", label: "DS-345 Building Permit Application", description: "Base application for all building permits", required: true, category: "documents" },
          { id: "c2", label: "DS-530 ADU Supplemental Application", description: "Required for all ADU projects", required: true, category: "documents" },
          { id: "c3", label: "DS-560 Plan Submittal Requirements", description: "Checklist of plan requirements", required: true, category: "documents" },
          { id: "c4", label: "Site plan with property lines", description: "Show existing structures, setbacks, and proposed ADU footprint", required: true, category: "plans" },
          { id: "c5", label: "Floor plans (all levels)", description: "Include dimensions and room labels", required: true, category: "plans" },
          { id: "c6", label: "Elevation drawings (4 sides)", description: "Show height and exterior design", required: true, category: "plans" },
          { id: "c7", label: "Title 24 energy compliance report", description: "Required for new construction", required: true, category: "plans" },
          { id: "c8", label: "Permit fees payment", description: "Fees based on valuation; no impact fees under 750 sq ft", required: true, category: "fees" },
        ],
      };
    } else if (canvas === "options") {
      result.options = getDefaultAduOptions(property);
    }
  } else if (desc.includes("solar") || desc.includes("photovoltaic")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push(
      { type: "photovoltaic_solar", name: "Solar/PV Permit", reason: "Required for solar installation" }
    );
    result.estimated_timeline = "1-3 weeks";
    result.process_steps = [
      "Submit application with system specs",
      "Plan review (expedited)",
      "Permit issuance",
      "Installation",
      "Final inspection",
      "Utility interconnection",
    ];
    result.tips = ["Expedited review available", "Include single-line diagram"];
    if (answers?.q_battery === "Yes") {
      result.tips = [
        ...(result.tips as string[]),
        "Battery storage needs fire code review",
        "ESS labeling required",
      ];
    }

    if (canvas === "verdict") {
      result.verdict = {
        level: "green",
        headline: "Solar permits are routine and often approved in 1–3 weeks.",
        reason:
          "San Diego offers an expedited solar permit process. Standard rooftop installations follow a streamlined review path.",
        what_changes_everything:
          "Battery storage, structural upgrades, or historic overlay designation may extend timeline.",
      };
    } else if (canvas === "checklist") {
      result.checklist = {
        items: [
          { id: "c1", label: "DS-345 Building Permit Application", description: "Base application", required: true, category: "documents" },
          { id: "c2", label: "Single-line electrical diagram", description: "Required for all PV permits", required: true, category: "plans" },
          { id: "c3", label: "Module and inverter spec sheets", description: "Product documentation for all equipment", required: true, category: "documents" },
          { id: "c4", label: "Site plan with array layout", description: "Show roof layout with panel positions", required: true, category: "plans" },
          { id: "c5", label: "Structural calculations (if needed)", description: "Required if roof framing needs upgrades", required: false, category: "plans" },
          { id: "c6", label: "Permit fees payment", description: "Residential solar: ~$250–$500", required: true, category: "fees" },
        ],
      };
    }
  } else if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push(
      { type: "combination_building_permit", name: "Combination Building Permit", reason: "Covers all trades for remodel" }
    );
    result.estimated_timeline = "4-8 weeks";
    result.process_steps = [
      "Submit combined application + plans",
      "Plan review",
      "Permit issuance",
      "Multi-trade inspections",
      "Final inspection",
    ];
    result.tips = [
      "Rapid Review available (50% surcharge)",
      "Cosmetic-only work may be exempt",
    ];

    if (canvas === "verdict") {
      result.verdict = {
        level: "amber",
        headline: "A permit is likely required, but scope determines the process.",
        reason:
          "Remodels involving plumbing, electrical, or structural changes require a Combination Building Permit. Cosmetic-only work (painting, cabinet replacement) may be exempt.",
        what_changes_everything:
          "Moving plumbing fixtures or load-bearing walls significantly increases scope and review time.",
      };
    } else if (canvas === "checklist") {
      result.checklist = {
        items: [
          { id: "c1", label: "DS-345 Building Permit Application", description: "Base application", required: true, category: "documents" },
          { id: "c2", label: "Floor plan showing existing and proposed layout", description: "Dimensions, room labels, fixture locations", required: true, category: "plans" },
          { id: "c3", label: "Plumbing plan (if relocating fixtures)", description: "Show existing and new fixture locations", required: false, category: "plans" },
          { id: "c4", label: "Electrical plan (if modifying circuits)", description: "Panel schedule and circuit diagram", required: false, category: "plans" },
          { id: "c5", label: "Structural plan (if removing walls)", description: "Engineering required for load-bearing changes", required: false, category: "plans" },
          { id: "c6", label: "Permit fees payment", description: "Based on project valuation", required: true, category: "fees" },
        ],
      };
    }
  } else if (desc.includes("water heater") || desc.includes("hvac")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push(
      { type: "no_plan_residential_mep", name: "No-Plan Residential MEP", reason: "Simplified permit for like-for-like replacement" }
    );
    result.estimated_timeline = "Same day to 1 week";
    result.process_steps = [
      "Submit DS-345 (no plans needed)",
      "Permit issuance (often same day)",
      "Complete work",
      "Final inspection",
    ];

    if (canvas === "verdict") {
      result.verdict = {
        level: "green",
        headline: "Same-day permit possible for like-for-like replacement.",
        reason:
          "Water heater and HVAC replacements qualify for the No-Plan Residential MEP permit, often issued same day or within a week.",
        what_changes_everything:
          "Changing fuel type (gas to electric) or adding new capacity may require additional review.",
      };
    }
  } else {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push(
      { type: "building_permit", name: "Building Permit", reason: "Required for construction/alterations" }
    );
    result.estimated_timeline = "4-12 weeks";
    result.process_steps = [
      "Submit DS-345 + DS-560 + plans",
      "Plan review",
      "Corrections if needed",
      "Permit issuance",
      "Construction + inspections",
      "Final inspection",
    ];

    if (canvas === "verdict") {
      result.verdict = {
        level: "amber",
        headline: "A building permit is likely required for this project.",
        reason:
          "Most structural construction and significant alterations require a permit in San Diego.",
        what_changes_everything:
          "Project scope and location determine exact requirements. Contact DSD for pre-application guidance.",
      };
    }
  }

  // Merge real property data if available
  if (property && property.data_sources.length > 0) {
    result.property = mergePropertyData(undefined, property, description);
  }

  // Status fallback — applies when situation === "waiting"
  if (canvas === "status") {
    result.status = {
      plain_english_status:
        "Provide your permit number or address to look up current status.",
      stage_description:
        "Permit status lookup requires a permit number (PDS2024-xxxxxx) or property address.",
      next_step:
        "Visit sdpermits.sandiego.gov or call DSD at (619) 446-5000 for current status.",
      workflow_steps: [
        { label: "Application Submitted", status: "done" },
        { label: "Plan Check", status: "active" },
        { label: "Corrections / Approval", status: "pending" },
        { label: "Permit Issued", status: "pending" },
        { label: "Construction", status: "pending" },
        { label: "Final Inspection", status: "pending" },
      ],
    };
  }

  return result;
}
