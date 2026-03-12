/**
 * Port of MCP cost-estimator.ts — pure function, no zod dependency.
 * Source: packages/mcp-server/src/tools/cost-estimator.ts
 */

// ── Types ──

export interface EstimateCostInput {
  project_type: string;
  size_sqft?: number;
  scope?: "minor" | "mid" | "major" | "luxury";
  system_size_kw?: number;
  linear_feet?: number;
  coastal_zone?: boolean;
  historic_district?: boolean;
  hillside?: boolean;
}

interface CostRange { low: number; high: number }

interface ProjectCostData {
  label: string;
  unit: "sqft" | "flat" | "watt" | "lf";
  costPerUnit: CostRange;
  defaultSize?: number;
  complexity: "simple" | "standard" | "complex";
  needsArchitect: boolean;
  needsEngineer: boolean;
  needsTitle24: boolean;
  needsSurveyor: boolean;
  needsStormwater: boolean;
  isAdu: boolean;
  scopeRanges?: Record<string, CostRange>;
}

export interface CostEstimateResult {
  project_type: string;
  project_label: string;
  inputs: Record<string, unknown>;
  construction_cost: { low: number; high: number; note: string };
  permit_fees: Record<string, number | undefined>;
  professional_fees: Array<{ service: string; low: number; high: number; note?: string }> | string;
  timeline: { design: string; permit: string; construction: string; total: string };
  total_estimate: { low: number; high: number };
  warnings?: string[];
  savings_tips?: string[];
  disclaimer: string;
  fee_sources: string[];
}

// ── Construction cost data (San Diego 2025-2026) ──

const PROJECT_DATA: Record<string, ProjectCostData> = {
  adu_detached: {
    label: "Detached ADU",
    unit: "sqft", costPerUnit: { low: 250, high: 400 }, defaultSize: 600,
    complexity: "complex", needsArchitect: true, needsEngineer: true,
    needsTitle24: true, needsSurveyor: true, needsStormwater: true, isAdu: true,
  },
  adu_attached: {
    label: "Attached ADU",
    unit: "sqft", costPerUnit: { low: 200, high: 350 }, defaultSize: 500,
    complexity: "complex", needsArchitect: true, needsEngineer: true,
    needsTitle24: true, needsSurveyor: true, needsStormwater: true, isAdu: true,
  },
  adu_garage_conversion: {
    label: "Garage Conversion ADU",
    unit: "sqft", costPerUnit: { low: 150, high: 300 }, defaultSize: 400,
    complexity: "complex", needsArchitect: true, needsEngineer: false,
    needsTitle24: true, needsSurveyor: false, needsStormwater: false, isAdu: true,
  },
  jadu: {
    label: "Junior ADU (JADU)",
    unit: "sqft", costPerUnit: { low: 100, high: 200 }, defaultSize: 400,
    complexity: "standard", needsArchitect: true, needsEngineer: false,
    needsTitle24: true, needsSurveyor: false, needsStormwater: false, isAdu: true,
  },
  kitchen_remodel: {
    label: "Kitchen Remodel",
    unit: "flat", costPerUnit: { low: 0, high: 0 },
    complexity: "standard", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
    scopeRanges: {
      minor:  { low: 25000, high: 40000 },
      mid:    { low: 50000, high: 80000 },
      major:  { low: 80000, high: 150000 },
      luxury: { low: 120000, high: 250000 },
    },
  },
  bathroom_remodel: {
    label: "Bathroom Remodel",
    unit: "flat", costPerUnit: { low: 0, high: 0 },
    complexity: "standard", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
    scopeRanges: {
      minor:  { low: 15000, high: 25000 },
      mid:    { low: 25000, high: 45000 },
      major:  { low: 45000, high: 75000 },
      luxury: { low: 60000, high: 95000 },
    },
  },
  room_addition: {
    label: "Room Addition",
    unit: "sqft", costPerUnit: { low: 250, high: 400 }, defaultSize: 200,
    complexity: "complex", needsArchitect: true, needsEngineer: true,
    needsTitle24: true, needsSurveyor: true, needsStormwater: true, isAdu: false,
  },
  deck_patio: {
    label: "Deck / Patio",
    unit: "sqft", costPerUnit: { low: 45, high: 120 }, defaultSize: 200,
    complexity: "standard", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
  },
  solar_panels: {
    label: "Solar Panels",
    unit: "watt", costPerUnit: { low: 2.32, high: 3.15 }, defaultSize: 8000,
    complexity: "simple", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
  },
  electrical_panel: {
    label: "Electrical Panel Upgrade",
    unit: "flat", costPerUnit: { low: 2500, high: 6000 },
    complexity: "simple", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
  },
  fence_retaining_wall: {
    label: "Fence / Retaining Wall",
    unit: "lf", costPerUnit: { low: 25, high: 80 }, defaultSize: 100,
    complexity: "simple", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
  },
  hvac_replacement: {
    label: "HVAC Replacement",
    unit: "flat", costPerUnit: { low: 5000, high: 15000 },
    complexity: "simple", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
  },
  roofing: {
    label: "Roofing",
    unit: "sqft", costPerUnit: { low: 5, high: 15 }, defaultSize: 1500,
    complexity: "simple", needsArchitect: false, needsEngineer: false,
    needsTitle24: false, needsSurveyor: false, needsStormwater: false, isAdu: false,
  },
  garage_new: {
    label: "New Garage Construction",
    unit: "sqft", costPerUnit: { low: 150, high: 250 }, defaultSize: 400,
    complexity: "complex", needsArchitect: true, needsEngineer: true,
    needsTitle24: true, needsSurveyor: true, needsStormwater: true, isAdu: false,
  },
};

// ── Professional fee ranges ──

const PROFESSIONAL_FEES = {
  architect:    { low: 5000,  high: 15000, label: "Architect" },
  engineer:     { low: 1500,  high: 5000,  label: "Structural Engineer" },
  title24:      { low: 500,   high: 1500,  label: "Title 24 Energy Calcs" },
  surveyor:     { low: 500,   high: 2000,  label: "Surveyor (site plan)" },
  soils:        { low: 2000,  high: 5000,  label: "Soils / Geotechnical Report" },
  stormwater:   { low: 500,   high: 1500,  label: "Stormwater Management Plan" },
};

// ── Timeline data ──

const TIMELINES: Record<string, { design: string; permit: string; construction: string; total: string }> = {
  simple:   { design: "0-1 weeks",  permit: "1-3 weeks",   construction: "1-2 weeks",  total: "1-2 months" },
  standard: { design: "2-4 weeks",  permit: "4-8 weeks",   construction: "1-3 months", total: "3-6 months" },
  complex:  { design: "4-8 weeks",  permit: "8-16 weeks",  construction: "3-12 months", total: "8-18 months" },
};

// ── IB-501 Building Permit Fee Brackets ──

function calculateBuildingPermitFee(valuation: number): number {
  if (valuation <= 0) return 0;
  if (valuation <= 500) return 28;
  if (valuation <= 2000) return 28 + ((valuation - 500) / 100) * 3.70;
  if (valuation <= 25000) return 83.50 + ((valuation - 2000) / 1000) * 16.55;
  if (valuation <= 50000) return 464.15 + ((valuation - 25000) / 1000) * 11.95;
  if (valuation <= 100000) return 762.90 + ((valuation - 50000) / 1000) * 8.30;
  if (valuation <= 500000) return 1177.90 + ((valuation - 100000) / 1000) * 6.55;
  if (valuation <= 1000000) return 3797.90 + ((valuation - 500000) / 1000) * 5.55;
  return 6572.90 + ((valuation - 1000000) / 1000) * 3.65;
}

// ── Main handler ──

export function handleEstimateCost(input: EstimateCostInput): CostEstimateResult | { error: string } {
  const data = PROJECT_DATA[input.project_type];
  if (!data) {
    return { error: `Unknown project type: ${input.project_type}` };
  }

  // --- Calculate construction cost ---
  let constructionLow: number;
  let constructionHigh: number;

  if (data.scopeRanges) {
    const scope = input.scope || "mid";
    const range = data.scopeRanges[scope] || data.scopeRanges["mid"];
    constructionLow = range.low;
    constructionHigh = range.high;
  } else if (data.unit === "flat") {
    constructionLow = data.costPerUnit.low;
    constructionHigh = data.costPerUnit.high;
  } else if (data.unit === "watt") {
    const watts = (input.system_size_kw || (data.defaultSize! / 1000)) * 1000;
    constructionLow = Math.round(watts * data.costPerUnit.low);
    constructionHigh = Math.round(watts * data.costPerUnit.high);
  } else if (data.unit === "lf") {
    const lf = input.linear_feet || data.defaultSize || 100;
    constructionLow = Math.round(lf * data.costPerUnit.low);
    constructionHigh = Math.round(lf * data.costPerUnit.high);
  } else {
    const sqft = input.size_sqft || data.defaultSize || 500;
    constructionLow = Math.round(sqft * data.costPerUnit.low);
    constructionHigh = Math.round(sqft * data.costPerUnit.high);
  }

  const valuation = Math.round((constructionLow + constructionHigh) / 2);

  // --- Calculate permit fees ---
  const buildingPermit = Math.round(calculateBuildingPermitFee(valuation) * 100) / 100;
  const planCheck = Math.round(buildingPermit * 0.65 * 100) / 100;
  const smip = Math.round(valuation * 0.00013 * 100) / 100;
  const greenBuilding = Math.round((valuation / 100000) * 4 * 100) / 100;
  const techSurcharge = Math.round(buildingPermit * 0.03 * 100) / 100;

  let schoolImpact = 0;
  const effectiveSqft = input.size_sqft || data.defaultSize || 0;
  if (data.isAdu && input.project_type !== "jadu" && effectiveSqft > 500) {
    schoolImpact = Math.round(effectiveSqft * 5.17 * 100) / 100;
  }

  let waterSewer = 0;
  if (data.isAdu) {
    waterSewer = 4101;
  }

  let coastalPermit: number | undefined;
  if (input.coastal_zone) {
    coastalPermit = 1200;
  }

  let historicReview: number | undefined;
  if (input.historic_district) {
    historicReview = 800;
  }

  const permitFeesTotal = Math.round(
    (buildingPermit + planCheck + schoolImpact + waterSewer +
     smip + greenBuilding + techSurcharge +
     (coastalPermit || 0) + (historicReview || 0)) * 100
  ) / 100;

  const permitFees: Record<string, number | undefined> = {
    building_permit: buildingPermit,
    plan_check: planCheck,
    ...(schoolImpact > 0 ? { school_impact: schoolImpact } : {}),
    ...(waterSewer > 0 ? { water_sewer: waterSewer } : {}),
    smip,
    green_building: greenBuilding,
    tech_surcharge: techSurcharge,
    ...(coastalPermit ? { coastal_permit: coastalPermit } : {}),
    ...(historicReview ? { historic_review: historicReview } : {}),
    total: permitFeesTotal,
  };

  // --- Professional fees ---
  const professionalFees: Array<{ service: string; low: number; high: number; note?: string }> = [];
  let profFeesLow = 0;
  let profFeesHigh = 0;

  if (data.needsArchitect) {
    const f = PROFESSIONAL_FEES.architect;
    professionalFees.push({ service: f.label, low: f.low, high: f.high, note: `Required for ${data.label} plans` });
    profFeesLow += f.low;
    profFeesHigh += f.high;
  }
  if (data.needsEngineer) {
    const f = PROFESSIONAL_FEES.engineer;
    professionalFees.push({ service: f.label, low: f.low, high: f.high });
    profFeesLow += f.low;
    profFeesHigh += f.high;
  }
  if (data.needsTitle24) {
    const f = PROFESSIONAL_FEES.title24;
    professionalFees.push({ service: f.label, low: f.low, high: f.high });
    profFeesLow += f.low;
    profFeesHigh += f.high;
  }
  if (data.needsSurveyor) {
    const f = PROFESSIONAL_FEES.surveyor;
    professionalFees.push({ service: f.label, low: f.low, high: f.high });
    profFeesLow += f.low;
    profFeesHigh += f.high;
  }
  if (input.hillside) {
    const f = PROFESSIONAL_FEES.soils;
    professionalFees.push({ service: f.label, low: f.low, high: f.high, note: "Required for hillside properties" });
    profFeesLow += f.low;
    profFeesHigh += f.high;
  }
  if (data.needsStormwater) {
    const f = PROFESSIONAL_FEES.stormwater;
    professionalFees.push({ service: f.label, low: f.low, high: f.high });
    profFeesLow += f.low;
    profFeesHigh += f.high;
  }
  if (data.scopeRanges && (input.scope === "major" || input.scope === "luxury")) {
    const arch = PROFESSIONAL_FEES.architect;
    professionalFees.push({ service: arch.label, low: arch.low, high: arch.high, note: "Recommended for major remodels" });
    profFeesLow += arch.low;
    profFeesHigh += arch.high;

    if (input.scope === "major" || input.scope === "luxury") {
      const eng = PROFESSIONAL_FEES.engineer;
      professionalFees.push({ service: eng.label, low: eng.low, high: eng.high, note: "If load-bearing walls are modified" });
      profFeesLow += eng.low;
      profFeesHigh += eng.high;
    }
  }

  // --- Timeline ---
  const timeline = { ...TIMELINES[data.complexity] };
  if (data.isAdu) {
    timeline.permit = "4-8 weeks (60-day state mandate for ADUs)";
  }

  // --- Totals ---
  const totalLow = constructionLow + permitFeesTotal + profFeesLow;
  const totalHigh = constructionHigh + permitFeesTotal + profFeesHigh;

  // --- Warnings ---
  const warnings: string[] = [];

  if (input.coastal_zone) {
    warnings.push("Coastal zone: requires Coastal Development Permit (+$1,200 deposit, may add months to timeline)");
  }
  if (input.historic_district) {
    warnings.push("Historic district: requires Historic Resources Board review (+$800 deposit, may add 2-4 months)");
  }
  if (input.hillside) {
    warnings.push("Hillside property: requires soils/geotechnical report (+$2,000-$5,000)");
  }
  if (data.isAdu && effectiveSqft > 500 && input.project_type !== "jadu") {
    warnings.push(`Over 500 sqft: school impact fees apply ($5.17/sqft = $${Math.round(effectiveSqft * 5.17).toLocaleString()})`);
  }
  if (data.isAdu && effectiveSqft > 750) {
    warnings.push("Over 750 sqft: development impact fees may apply (SB 13 waiver expires)");
  }
  if (data.isAdu && effectiveSqft > 800) {
    warnings.push("Over 800 sqft: must comply with floor area ratio (FAR) limits for your zone");
  }

  // --- Savings tips ---
  const savingsTips: string[] = [];

  if (data.isAdu && effectiveSqft > 500) {
    const savings = Math.round(effectiveSqft * 5.17);
    savingsTips.push(`Going under 500 sqft saves ~$${savings.toLocaleString()} in school impact fees`);
  }
  if (data.isAdu) {
    savingsTips.push("County offers free pre-approved ADU plans at sandiegocounty.gov/pds/bldg/adu_plans.html (saves $5k-$15k in architect fees)");
  }
  if (data.isAdu && effectiveSqft <= 750) {
    savingsTips.push("Under 750 sqft: no development impact fees (SB 13)");
  }
  if (input.project_type === "solar_panels") {
    savingsTips.push("Federal Investment Tax Credit (ITC) covers 30% of system cost");
    savingsTips.push("Expedited review available for residential solar permits");
  }
  if (data.scopeRanges && input.scope === "minor") {
    savingsTips.push("Minor scope may qualify for Rapid Review (faster processing, 50% surcharge on plan check)");
  }
  if (input.project_type === "adu_garage_conversion" || input.project_type === "jadu") {
    savingsTips.push("Converting existing space avoids new foundation costs — typically 40-60% cheaper than new construction");
  }

  // --- Build inputs summary ---
  const inputs: Record<string, unknown> = {};
  if (input.size_sqft) inputs.size_sqft = input.size_sqft;
  if (input.scope) inputs.scope = input.scope;
  if (input.system_size_kw) inputs.system_size_kw = input.system_size_kw;
  if (input.linear_feet) inputs.linear_feet = input.linear_feet;
  if (input.coastal_zone) inputs.coastal_zone = true;
  if (input.historic_district) inputs.historic_district = true;
  if (input.hillside) inputs.hillside = true;

  return {
    project_type: input.project_type,
    project_label: data.label,
    inputs,
    construction_cost: {
      low: constructionLow,
      high: constructionHigh,
      note: data.unit === "flat"
        ? "Flat rate based on scope"
        : `Based on ${data.costPerUnit.low}-${data.costPerUnit.high}/${data.unit === "watt" ? "watt" : data.unit === "lf" ? "linear ft" : "sq ft"} (San Diego 2025-2026)`,
    },
    permit_fees: permitFees,
    professional_fees: professionalFees.length > 0 ? professionalFees : "None typically required for this project type",
    timeline,
    total_estimate: {
      low: Math.round(totalLow),
      high: Math.round(totalHigh),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    savings_tips: savingsTips.length > 0 ? savingsTips : undefined,
    disclaimer: "Estimates based on IB-501 (June 2025) and San Diego market data. Actual costs vary by contractor, site conditions, and materials. Always get multiple contractor bids.",
    fee_sources: [
      "IB-501 Fee Schedule for Construction Permits (June 2025)",
      "ICC Building Valuation Data",
      "San Diego residential construction market research 2025-2026",
    ],
  };
}
