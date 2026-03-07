import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNavigationContext } from "../../lib/data-layer";

type Situation = "planning" | "applying" | "waiting";
type Category = "adu" | "kitchen-bath" | "room-addition" | "solar" | "deck-fence";
type CanvasType = "verdict" | "checklist" | "status" | "options" | "roadmap";

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
  if (situation === "planning" && isAduOptionsIntent) return "options";
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

  // Phase 1: Return clarifying questions
  if (include_questions && !answers) {
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey });
        const systemPrompt = getNavigationContext();
        const userMsg = property_address
          ? `Project: ${project_description}\nProperty Address: ${property_address}`
          : `Project: ${project_description}`;

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
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
            return NextResponse.json(JSON.parse(match[0]));
          } catch {
            /* fall through */
          }
        }
      } catch (e) {
        console.error("Questions generation error:", e);
      }
    }
    return NextResponse.json(getFallbackQuestions(project_description));
  }

  // Phase 2: Generate roadmap with canvas contract
  const canvasType = selectCanvas(situation, category, project_description);

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
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

      const addressJson = property_address ? `"${String(property_address).replace(/"/g, '\\"')}"` : "null";

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Provide a complete San Diego permit roadmap with canvas card data.\n\n${userMsg}\n\nRespond ONLY with valid JSON. Include ALL top-level fields:\n{"permits_needed":[{"type":"...","name":"...","reason":"..."}],"exemptions":[{"item":"...","code_section":"..."}],"forms_required":[{"form_id":"...","name":"...","purpose":"..."}],"process_steps":["..."],"estimated_timeline":"...","estimated_cost_range":"...","tips":["..."],"special_considerations":["..."],"confidence":"high|medium|low","code_references":["§xxx - desc"],"canvas":"${canvasType}","reliability":{"source":"ai","notes":["AI-generated based on San Diego Municipal Code"]},"verdict":{"level":"green|amber|red","headline":"one sentence verdict","reason":"2-3 sentence explanation","what_changes_everything":"key factor that changes the answer"},"checklist":{"items":[{"id":"c1","label":"...","description":"...","required":true,"category":"documents|plans|fees|inspections"}]},"status":{"permit_number":null,"plain_english_status":"...","stage_description":"...","next_step":"...","workflow_steps":[{"label":"...","status":"done|active|pending"}]},"property":{"address":${addressJson},"zone_code":"...","zone_plain_english":"...","overlays":[],"lot_size_sqft":null,"apn":null,"past_permits":[]},"options":{"adu_types":[{"id":"detached","label":"Detached ADU","description":"...","pros":["..."],"cons":["..."]}],"default_type":"detached","size_range":{"min":150,"max":1200,"default":600}}}`,
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
    getFallbackNavigation(project_description, answers, situation, category)
  );
}

function getFallbackQuestions(description: string) {
  const desc = description.toLowerCase();
  const questions: Array<{ id: string; question: string; why: string; options?: string[] }> = [];

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

  questions.push(
    { id: "q_property_type", question: "Property type?", why: "Different requirements by property type", options: ["Single-family", "Multi-family", "Commercial"] },
    { id: "q_historic", question: "In a historic district?", why: "May need HRB review", options: ["No", "Yes", "Not sure"] },
  );

  return {
    phase: "questions",
    project_summary: description,
    questions,
    preliminary_assessment: getPreliminaryAssessment(desc),
  };
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
  category?: Category
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
    note: answers ? "Roadmap refined with your answers." : "Set ANTHROPIC_API_KEY for AI-powered analysis.",
    canvas,
    reliability: {
      source: "fallback",
      notes: [
        answers
          ? "Rule-based roadmap refined with your answers."
          : "Set ANTHROPIC_API_KEY for AI-powered analysis.",
        "Contact DSD at (619) 446-5000 to confirm current requirements.",
      ],
    },
  };

  if (desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny")) {
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
    result.tips = [
      "No impact fees under 750 sq ft",
      "4-foot setbacks for detached",
      "No parking required near transit",
      "Max 1,200 sq ft detached",
    ];

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
      result.verdict = {
        level: "green",
        headline: "ADUs are generally allowed on single-family lots in San Diego.",
        reason:
          "California law (AB 68, SB 9) and San Diego's ADU ordinance permit detached ADUs up to 1,200 sq ft on most residential lots. The city must approve within 60 days.",
        what_changes_everything:
          "Coastal overlay, hillside designation, or historic district could add requirements. Address-specific zoning verification is recommended.",
      };
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
      result.options = {
        adu_types: [
          {
            id: "detached",
            label: "Detached ADU",
            description: "Standalone structure separate from the main house",
            pros: ["Most privacy for tenant", "Design flexibility", "Higher rental income potential"],
            cons: ["Requires separate utility connections", "Largest site footprint"],
          },
          {
            id: "attached",
            label: "Attached ADU",
            description: "Addition connected to the main house",
            pros: ["Shared walls reduce construction cost", "Less site work required"],
            cons: ["Less privacy", "May affect main house living space"],
          },
          {
            id: "garage",
            label: "Garage Conversion",
            description: "Convert existing attached or detached garage",
            pros: ["Lowest cost option", "No setback changes needed", "Fastest approval path"],
            cons: ["Lose garage space", "Limited square footage"],
          },
          {
            id: "jadu",
            label: "Junior ADU (JADU)",
            description: "Up to 500 sq ft within existing home footprint",
            pros: ["Fastest approvals", "No parking required", "No impact fees"],
            cons: ["Max 500 sq ft", "Owner must occupy primary residence"],
          },
        ],
        default_type: "detached",
        size_range: { min: 150, max: 1200, default: 600 },
      };
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
