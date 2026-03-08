import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getNavigationContext } from "../data/permit-knowledge.js";
import { lookupPropertyZoning } from "../data/property-lookup.js";
import { checkAduEligibility, AduEligibility } from "../data/adu-eligibility.js";

export const navigatePermitsSchema = z.object({
  project_description: z.string().describe("Plain-English description of the project (e.g., 'I want to build an ADU in my backyard')"),
  property_address: z.string().optional().describe("Property address for location-specific guidance"),
  include_questions: z.boolean().optional().default(false).describe("If true, returns clarifying questions first instead of the full roadmap. Use for human-in-the-loop Q&A flow."),
  answers: z.record(z.string()).optional().describe("Answers to previously returned clarifying questions. Provide these along with the original project_description to get a refined roadmap."),
});

export type NavigatePermitsInput = z.infer<typeof navigatePermitsSchema>;

function isAduProject(description: string): boolean {
  const desc = description.toLowerCase();
  return desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny flat") || desc.includes("in-law");
}

function formatZoningContext(eligibility: AduEligibility): string {
  const lines = [
    `\nZONING DATA (verified via City of San Diego ArcGIS):`,
    `- Zone: ${eligibility.zone_code} (${eligibility.zone_description})`,
    `- Property Type: ${eligibility.property_type}`,
    `- ADU Eligibility: ${eligibility.eligible ? "eligible" : "NOT eligible"}`,
    `- Details: ${eligibility.message}`,
  ];
  if (eligibility.rules.length > 0) {
    lines.push(`- Applicable Rules: ${eligibility.rules.join("; ")}`);
  }
  if (eligibility.warnings.length > 0) {
    lines.push(`- Warnings: ${eligibility.warnings.join("; ")}`);
  }
  return lines.join("\n");
}

export async function handleNavigatePermits(input: NavigatePermitsInput): Promise<string> {
  // Check ADU eligibility via zoning when address is provided
  let aduEligibility: AduEligibility | null = null;
  if (isAduProject(input.project_description) && input.property_address) {
    try {
      const zoning = await lookupPropertyZoning(input.property_address);
      if (zoning.zone_code) {
        aduEligibility = checkAduEligibility(zoning);
      }
    } catch {
      // Continue without zoning data
    }
  }

  // Short-circuit: if property is clearly ineligible for ADU
  if (aduEligibility && !aduEligibility.eligible) {
    return JSON.stringify({
      zoning_check: {
        zone_code: aduEligibility.zone_code,
        zone_description: aduEligibility.zone_description,
        property_type: aduEligibility.property_type,
        adu_eligible: false,
      },
      result: aduEligibility.message,
      alternatives: aduEligibility.alternatives,
      recommendation: "Based on the zoning for this address, a traditional ADU is not permitted here. See alternatives above.",
    }, null, 2);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    if (input.include_questions && !input.answers) {
      return JSON.stringify(getQuestionsForProject(input.project_description, aduEligibility), null, 2);
    }
    return getFallbackNavigation(input, aduEligibility);
  }

  try {
    const client = new Anthropic({ apiKey });
    const systemPrompt = getNavigationContext();

    if (input.include_questions && !input.answers) {
      return await generateQuestions(client, systemPrompt, input, aduEligibility);
    }

    return await generateRoadmap(client, systemPrompt, input, aduEligibility);
  } catch (error) {
    console.error("Claude API error:", error);
    if (input.include_questions && !input.answers) {
      return JSON.stringify(getQuestionsForProject(input.project_description, aduEligibility), null, 2);
    }
    return getFallbackNavigation(input, aduEligibility);
  }
}

async function generateQuestions(
  client: Anthropic,
  systemPrompt: string,
  input: NavigatePermitsInput,
  aduEligibility: AduEligibility | null,
): Promise<string> {
  let userMessage = input.property_address
    ? `Project: ${input.project_description}\nProperty Address: ${input.property_address}`
    : `Project: ${input.project_description}`;

  if (aduEligibility) {
    userMessage += formatZoningContext(aduEligibility);
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `A user wants to do the following project. Analyze it and generate 3-6 clarifying questions that will help you give more precise permit guidance. Focus on details that affect which permits are needed, whether exemptions apply, and what the process will look like.

Project: ${userMessage}

Respond ONLY with valid JSON (no markdown):
{
  "phase": "questions",
  "project_summary": "brief summary of what you understand so far",
  "questions": [
    {
      "id": "q1",
      "question": "the question text",
      "why": "why this matters for permit determination",
      "options": ["option1", "option2", "option3"] // optional suggested answers
    }
  ],
  "preliminary_assessment": "brief initial thoughts on what permits might be needed"
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.stringify(JSON.parse(jsonMatch[0]), null, 2);
    } catch { /* fall through */ }
  }
  return JSON.stringify(getQuestionsForProject(input.project_description, aduEligibility), null, 2);
}

async function generateRoadmap(
  client: Anthropic,
  systemPrompt: string,
  input: NavigatePermitsInput,
  aduEligibility: AduEligibility | null,
): Promise<string> {
  let userMessage = input.property_address
    ? `Project: ${input.project_description}\nProperty Address: ${input.property_address}`
    : `Project: ${input.project_description}`;

  if (aduEligibility) {
    userMessage += formatZoningContext(aduEligibility);
  }

  if (input.answers && Object.keys(input.answers).length > 0) {
    userMessage += "\n\nAdditional details from Q&A:\n";
    for (const [key, value] of Object.entries(input.answers)) {
      userMessage += `- ${key}: ${value}\n`;
    }
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Please analyze this project and provide a complete permit roadmap:\n\n${userMessage}\n\nRespond ONLY with valid JSON (no markdown):
{
  "permits_needed": [{"type": "...", "name": "...", "reason": "..."}],
  "exemptions": [{"item": "...", "code_section": "..."}],
  "forms_required": [{"form_id": "...", "name": "...", "purpose": "..."}],
  "process_steps": ["step 1", "step 2", ...],
  "estimated_timeline": "...",
  "estimated_cost_range": "...",
  "tips": ["tip 1", "tip 2", ...],
  "special_considerations": ["..."],
  "confidence": "high/medium/low",
  "code_references": ["§xxx.xxxx - description", ...]
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.stringify(JSON.parse(jsonMatch[0]), null, 2);
    } catch { /* fall through */ }
  }
  return JSON.stringify({ analysis: text });
}

// ── Fallback rule-based functions ──

function getQuestionsForProject(
  description: string,
  aduEligibility: AduEligibility | null,
): {
  phase: string;
  project_summary: string;
  questions: Array<{ id: string; question: string; why: string; options?: string[] }>;
  preliminary_assessment: string;
  zoning_check?: { zone_code: string | undefined; property_type: string | undefined; adu_eligible: boolean };
} {
  const desc = description.toLowerCase();

  // Base questions — skip zoning/property-type questions if we already looked them up
  const baseQuestions: Array<{ id: string; question: string; why: string; options?: string[] }> = [];
  if (!aduEligibility) {
    baseQuestions.push(
      {
        id: "q_property_type",
        question: "Is this a single-family home, multi-family, or commercial property?",
        why: "Different property types have different permit requirements and review processes",
        options: ["Single-family home", "Multi-family (2-4 units)", "Multi-family (5+ units)", "Commercial"],
      },
      {
        id: "q_zone",
        question: "Do you know your property's zoning designation? (e.g., RS-1-7, RM-1-1, CC-3-5)",
        why: "Zoning determines setback requirements, height limits, and allowed uses",
        options: ["I don't know", "RS (Residential Single)", "RM (Residential Multi)", "Commercial zone", "Other"],
      },
    );
  }
  baseQuestions.push({
    id: "q_historic",
    question: "Is your property in a historic district or designated as a historic resource?",
    why: "Historic properties may need Historic Resources Board review even for exempt work",
    options: ["No", "Yes", "I'm not sure"],
  });

  const specificQuestions: Array<{ id: string; question: string; why: string; options?: string[] }> = [];

  if (desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny flat")) {
    if (aduEligibility?.eligibility_type === "multi-family") {
      specificQuestions.push(
        { id: "q_adu_type", question: "What type of ADU are you considering?", why: "Multi-family properties have specific rules for ADU types", options: ["Convert non-livable space (storage, laundry, etc.)", "Detached new construction", "Attached addition"] },
        { id: "q_existing_units", question: "How many existing dwelling units are on the property?", why: "The number of allowed detached ADUs is based on 25% of existing units (minimum 1)", options: ["2-4 units", "5-10 units", "11-20 units", "20+ units"] },
        { id: "q_adu_size", question: "What approximate square footage are you planning?", why: "Units under 750 sq ft are exempt from impact fees.", options: ["Under 500 sq ft", "500-750 sq ft", "750-800 sq ft", "Over 800 sq ft"] },
      );
    } else {
      specificQuestions.push(
        { id: "q_adu_type", question: "What type of ADU? Detached new construction, attached addition, or garage conversion?", why: "Each ADU type has different requirements for setbacks, size limits, and parking", options: ["Detached (new build)", "Attached (addition)", "Garage conversion", "Junior ADU (within existing home)"] },
        { id: "q_adu_size", question: "What approximate square footage are you planning?", why: "Units under 750 sq ft are exempt from impact fees. Max is 1,200 sq ft for detached.", options: ["Under 500 sq ft", "500-750 sq ft", "750-1,000 sq ft", "1,000-1,200 sq ft"] },
        { id: "q_transit", question: "Is the property within 1/2 mile of a public transit stop?", why: "No parking replacement required for ADUs near transit", options: ["Yes", "No", "I'm not sure"] },
      );
    }
  } else if (desc.includes("solar") || desc.includes("photovoltaic")) {
    specificQuestions.push(
      { id: "q_solar_size", question: "What is the system size in kW?", why: "Affects fee calculation and review process" },
      { id: "q_battery", question: "Will you include battery storage (e.g., Tesla Powerwall)?", why: "Battery systems may need additional electrical and fire safety review", options: ["Yes", "No"] },
      { id: "q_roof_type", question: "What type of roof? (composition shingle, tile, flat)", why: "Affects structural attachment requirements and plan review", options: ["Composition shingle", "Tile", "Flat/low-slope", "Metal"] },
    );
  } else if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom")) {
    specificQuestions.push(
      { id: "q_structural", question: "Will you be removing or modifying any walls?", why: "Structural changes require engineering review and may need separate structural permit", options: ["No", "Yes - non-load-bearing only", "Yes - load-bearing walls", "I'm not sure"] },
      { id: "q_plumbing", question: "Will plumbing fixtures be moved to new locations?", why: "Moving plumbing significantly increases scope and may require sewer lateral inspection", options: ["No - staying in same locations", "Yes - moving fixtures", "Adding new fixtures"] },
      { id: "q_scope", question: "What's the approximate project valuation?", why: "Affects permit fees and may determine review process (Rapid Review for smaller projects)", options: ["Under $25,000", "$25,000-$75,000", "$75,000-$150,000", "Over $150,000"] },
    );
  } else {
    specificQuestions.push(
      { id: "q_scope", question: "Can you describe the scope of structural work involved?", why: "Determines whether a standard building permit or combination permit is needed" },
      { id: "q_contractor", question: "Will you hire a licensed contractor or do the work yourself (owner-builder)?", why: "Owner-builders must file form DS-16 and accept liability for code compliance", options: ["Licensed contractor", "Owner-builder", "Haven't decided"] },
    );
  }

  const result: {
    phase: string;
    project_summary: string;
    questions: Array<{ id: string; question: string; why: string; options?: string[] }>;
    preliminary_assessment: string;
    zoning_check?: { zone_code: string | undefined; property_type: string | undefined; adu_eligible: boolean };
  } = {
    phase: "questions",
    project_summary: `Project: ${description}`,
    questions: [...specificQuestions, ...baseQuestions],
    preliminary_assessment: getPreliminaryAssessment(desc, aduEligibility),
  };

  if (aduEligibility) {
    result.zoning_check = {
      zone_code: aduEligibility.zone_code,
      property_type: aduEligibility.property_type,
      adu_eligible: aduEligibility.eligible,
    };
  }

  return result;
}

function getPreliminaryAssessment(desc: string, aduEligibility: AduEligibility | null): string {
  if (desc.includes("adu") || desc.includes("accessory dwelling")) {
    if (aduEligibility?.eligibility_type === "multi-family") {
      return `This property is zoned ${aduEligibility.zone_code} (${aduEligibility.zone_description}). Multi-family properties can add ADUs by converting non-livable space or building detached units (up to 25% of existing unit count). Different rules apply compared to single-family ADUs.`;
    }
    if (aduEligibility?.eligibility_type === "single-family") {
      return `This property is zoned ${aduEligibility.zone_code} (${aduEligibility.zone_description}) and is eligible for an ADU. One ADU + one JADU allowed. California state law requires 60-day processing.`;
    }
    return "This likely requires an ADU Permit with plan review. California state law requires 60-day processing. We need more details about the type and size to give specific guidance.";
  }
  if (desc.includes("solar") || desc.includes("photovoltaic")) {
    return "Solar installations require a PV permit. Review is typically expedited (1-3 weeks). Details about system size and roof type will help refine the guidance.";
  }
  if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom")) {
    return "Remodels typically need a Combination Building Permit. The scope of structural and plumbing work determines complexity and timeline.";
  }
  if (desc.includes("fence") || desc.includes("wall")) {
    return "Fences under 6 feet (3 feet in front yard) are typically exempt from permits per §129.0203. We need to know the height and location.";
  }
  return "Most construction work requires a building permit. We need more details to determine the specific permit type and process.";
}

function getFallbackNavigation(input: NavigatePermitsInput, aduEligibility: AduEligibility | null): string {
  const desc = input.project_description.toLowerCase();
  const result: {
    permits_needed: Array<{ type: string; name: string; reason: string }>;
    exemptions: Array<{ item: string; code_section: string }>;
    forms_required: Array<{ form_id: string; name: string }>;
    process_steps: string[];
    estimated_timeline: string;
    tips: string[];
    note: string;
    zoning_check?: { zone_code: string | undefined; property_type: string | undefined; adu_eligible: boolean };
  } = {
    permits_needed: [],
    exemptions: [],
    forms_required: [{ form_id: "DS-345", name: "Application for Building Permit" }],
    process_steps: [],
    estimated_timeline: "",
    tips: [],
    note: "This is a basic analysis. For AI-powered detailed guidance, set ANTHROPIC_API_KEY environment variable.",
  };

  if (aduEligibility) {
    result.zoning_check = {
      zone_code: aduEligibility.zone_code,
      property_type: aduEligibility.property_type,
      adu_eligible: aduEligibility.eligible,
    };
  }

  if (desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny flat") || desc.includes("in-law")) {
    result.permits_needed.push({ type: "adu_permit", name: "ADU Permit", reason: "Required for accessory dwelling unit construction" });
    result.forms_required.push({ form_id: "DS-530", name: "ADU Supplemental Application" });
    result.forms_required.push({ form_id: "DS-560", name: "Plan Submittal Requirements" });
    result.estimated_timeline = "60 days maximum for plan review (state mandate)";
    result.process_steps = ["Pre-application consultation (recommended)", "Prepare plans per DS-560 requirements", "Submit DS-345, DS-530, and plans", "Plan review (60-day max)", "Permit issuance", "Construction with inspections", "Final inspection and certificate of occupancy"];

    if (aduEligibility?.eligibility_type === "multi-family") {
      result.tips = [
        "Multi-family ADUs: convert non-livable space (storage, laundry, etc.) or build detached",
        "At least one 800 sq ft detached ADU is always allowed",
        "Additional detached ADUs up to 25% of existing unit count",
        "JADUs do not apply to multi-family properties",
        "No impact fees for ADUs under 750 sq ft",
        "No parking required within 1/2 mile of transit",
      ];
    } else {
      result.tips = ["No impact fees for ADUs under 750 sq ft", "4-foot setbacks for detached ADUs", "No parking required within 1/2 mile of transit", "Maximum 1,200 sq ft for detached ADU"];
    }

    if (aduEligibility?.warnings) {
      result.tips.push(...aduEligibility.warnings);
    }
  } else if (desc.includes("solar") || desc.includes("photovoltaic") || desc.includes("pv")) {
    result.permits_needed.push({ type: "photovoltaic_solar", name: "Solar/PV Permit", reason: "Required for solar panel installation" });
    result.estimated_timeline = "1-3 weeks";
    result.process_steps = ["Submit application with system specs and plans", "Plan review (expedited available)", "Permit issuance", "Installation", "Final inspection", "Utility interconnection"];
    result.tips = ["Expedited review available for residential solar", "Include electrical single-line diagram in plans"];
  } else if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom") || desc.includes("renovation")) {
    result.permits_needed.push({ type: "combination_building_permit", name: "Combination Building Permit", reason: "Covers building, electrical, mechanical, and plumbing for remodel" });
    result.estimated_timeline = "4-8 weeks for plan review";
    result.process_steps = ["Submit combined application with plans", "Plan review", "Permit issuance", "Construction with multi-trade inspections", "Final inspection"];
    result.tips = ["Rapid Review available for faster processing (50% surcharge)", "Cosmetic-only work may not need a permit"];
  } else if (desc.includes("fence") || desc.includes("wall")) {
    if (desc.includes("under 6") || desc.includes("less than 6") || desc.includes("short")) {
      result.exemptions.push({ item: "Fences under 6 feet in side/rear yards", code_section: "§129.0203" });
      result.estimated_timeline = "No permit needed";
    } else {
      result.permits_needed.push({ type: "fence_permit", name: "Fence/Wall Permit", reason: "Required for fences over 6 feet or front yard walls over 3 feet" });
      result.estimated_timeline = "2-4 weeks";
    }
  } else if (desc.includes("water heater") || desc.includes("hvac") || desc.includes("furnace") || desc.includes("air condition")) {
    result.permits_needed.push({ type: "no_plan_residential_mep", name: "No-Plan Residential MEP Permit", reason: "Simplified permit for like-for-like equipment replacement" });
    result.estimated_timeline = "Same day to 1 week";
    result.process_steps = ["Submit DS-345 application (no plans needed for like-for-like)", "Permit issuance (often same day)", "Complete the work", "Schedule and pass final inspection"];
    result.tips = ["Like-for-like replacements qualify for no-plan permit", "If changing fuel type or location, standard permit may be needed"];
  } else if (desc.includes("garage") && (desc.includes("convert") || desc.includes("living"))) {
    result.permits_needed.push({ type: "adu_permit", name: "ADU/JADU Permit", reason: "Garage conversions to living space qualify as Junior ADU (JADU) under state law" });
    result.forms_required.push({ form_id: "DS-530", name: "ADU Supplemental Application" });
    result.estimated_timeline = "60 days maximum for plan review";
    result.process_steps = ["Determine if it qualifies as JADU (under 500 sq ft, within existing footprint)", "Submit DS-345, DS-530, and plans", "Plan review (60-day max)", "Permit issuance", "Construction with inspections", "Final inspection"];
    result.tips = ["JADUs must be under 500 sq ft", "Must be within existing structure footprint", "Efficiency kitchen allowed", "Interior connection to primary home required for JADU"];
  } else {
    result.permits_needed.push({ type: "building_permit", name: "Building Permit", reason: "Required for construction, additions, and alterations" });
    result.forms_required.push({ form_id: "DS-560", name: "Plan Submittal Requirements" });
    result.estimated_timeline = "4-12 weeks depending on complexity";
    result.process_steps = ["Submit application with plans (DS-345, DS-560)", "Plan review", "Corrections if needed", "Permit issuance", "Construction with inspections", "Final inspection"];
  }

  if (input.answers && Object.keys(input.answers).length > 0) {
    result.note = "Roadmap generated with your additional details. For AI-powered analysis, set ANTHROPIC_API_KEY.";
  }

  return JSON.stringify(result, null, 2);
}
