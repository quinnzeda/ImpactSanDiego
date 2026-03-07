import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNavigationContext } from "../../lib/data-layer";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { project_description, property_address, include_questions, answers } = body;

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
          messages: [{
            role: "user",
            content: `Analyze this project and generate 3-6 clarifying questions for more precise permit guidance. Focus on details that affect which permits are needed.\n\nProject: ${userMsg}\n\nRespond ONLY with valid JSON:\n{"phase":"questions","project_summary":"...","questions":[{"id":"q1","question":"...","why":"...","options":["a","b","c"]}],"preliminary_assessment":"..."}`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try { return NextResponse.json(JSON.parse(match[0])); } catch { /* fall through */ }
        }
      } catch (e) {
        console.error("Questions generation error:", e);
      }
    }
    return NextResponse.json(getFallbackQuestions(project_description));
  }

  // Phase 2: Generate roadmap (with or without answers)
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

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Provide a complete permit roadmap:\n\n${userMsg}\n\nRespond ONLY with valid JSON:\n{"permits_needed":[{"type":"...","name":"...","reason":"..."}],"exemptions":[{"item":"...","code_section":"..."}],"forms_required":[{"form_id":"...","name":"...","purpose":"..."}],"process_steps":["..."],"estimated_timeline":"...","estimated_cost_range":"...","tips":["..."],"special_considerations":["..."],"confidence":"high/medium/low","code_references":["§xxx.xxxx - description"]}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return NextResponse.json(JSON.parse(match[0])); } catch { /* fall through */ }
      }
      return NextResponse.json({ analysis: text });
    } catch (e) {
      console.error("Roadmap generation error:", e);
    }
  }

  return NextResponse.json(getFallbackNavigation(project_description, answers));
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

function getFallbackNavigation(description: string, answers?: Record<string, string>) {
  const desc = description.toLowerCase();

  const result: Record<string, unknown> = {
    permits_needed: [] as Array<{ type: string; name: string; reason: string }>,
    exemptions: [] as Array<{ item: string; code_section: string }>,
    forms_required: [{ form_id: "DS-345", name: "Application for Building Permit" }],
    process_steps: [] as string[],
    estimated_timeline: "",
    tips: [] as string[],
    note: answers ? "Roadmap refined with your answers." : "Set ANTHROPIC_API_KEY for AI-powered analysis.",
  };

  if (desc.includes("adu") || desc.includes("accessory dwelling") || desc.includes("granny")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push({ type: "adu_permit", name: "ADU Permit", reason: "Required for ADU construction" });
    (result.forms_required as Array<{ form_id: string; name: string }>).push({ form_id: "DS-530", name: "ADU Supplemental Application" }, { form_id: "DS-560", name: "Plan Submittal Requirements" });
    result.estimated_timeline = "60 days max (state mandate)";
    result.process_steps = ["Pre-application consultation", "Prepare plans per DS-560", "Submit DS-345 + DS-530 + plans", "Plan review (60-day max)", "Permit issuance", "Construction with inspections", "Final inspection + certificate of occupancy"];
    result.tips = ["No impact fees under 750 sq ft", "4-foot setbacks for detached", "No parking required near transit", "Max 1,200 sq ft detached"];

    if (answers?.q_adu_type === "Garage conversion") {
      result.tips = [...(result.tips as string[]), "Garage conversions often qualify as JADU (simpler process)", "No setback changes needed for existing structure"];
    }
    if (answers?.q_adu_size?.includes("Under") || answers?.q_adu_size?.includes("500")) {
      result.tips = [...(result.tips as string[]), "Your unit size qualifies for waived impact fees"];
    }
  } else if (desc.includes("solar") || desc.includes("photovoltaic")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push({ type: "photovoltaic_solar", name: "Solar/PV Permit", reason: "Required for solar installation" });
    result.estimated_timeline = "1-3 weeks";
    result.process_steps = ["Submit application with system specs", "Plan review (expedited)", "Permit issuance", "Installation", "Final inspection", "Utility interconnection"];
    result.tips = ["Expedited review available", "Include single-line diagram"];
    if (answers?.q_battery === "Yes") {
      result.tips = [...(result.tips as string[]), "Battery storage needs fire code review", "ESS labeling required"];
    }
  } else if (desc.includes("remodel") || desc.includes("kitchen") || desc.includes("bathroom")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push({ type: "combination_building_permit", name: "Combination Building Permit", reason: "Covers all trades for remodel" });
    result.estimated_timeline = "4-8 weeks";
    result.process_steps = ["Submit combined application + plans", "Plan review", "Permit issuance", "Multi-trade inspections", "Final inspection"];
    result.tips = ["Rapid Review available (50% surcharge)", "Cosmetic-only work may be exempt"];
  } else if (desc.includes("water heater") || desc.includes("hvac")) {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push({ type: "no_plan_residential_mep", name: "No-Plan Residential MEP", reason: "Simplified permit for like-for-like replacement" });
    result.estimated_timeline = "Same day to 1 week";
    result.process_steps = ["Submit DS-345 (no plans needed)", "Permit issuance (often same day)", "Complete work", "Final inspection"];
  } else {
    (result.permits_needed as Array<{ type: string; name: string; reason: string }>).push({ type: "building_permit", name: "Building Permit", reason: "Required for construction/alterations" });
    result.estimated_timeline = "4-12 weeks";
    result.process_steps = ["Submit DS-345 + DS-560 + plans", "Plan review", "Corrections if needed", "Permit issuance", "Construction + inspections", "Final inspection"];
  }

  return result;
}
