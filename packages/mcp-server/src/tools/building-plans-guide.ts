import { z } from "zod";
import { lookupPropertyZoning, type PropertyZoningData } from "../data/property-lookup.js";
import { searchCityPermits, type NormalizedPermit } from "../data/accela-api.js";
import { socrataSearch } from "../data/socrata-client.js";

export const buildingPlansGuideSchema = z.object({
  address: z.string().describe("Street address in San Diego (e.g., '4225 Park Blvd, San Diego, CA')"),
  project_type: z.string().describe("Plain-English description of the project (e.g., 'kitchen remodel', 'garage conversion', 'new detached ADU')"),
  is_owner: z.boolean().describe("Whether the requester is the current property owner"),
});

export type BuildingPlansGuideInput = z.infer<typeof buildingPlansGuideSchema>;

// Project types that need existing floor plans (showing "existing" vs "proposed")
const NEEDS_EXISTING_PLANS_KEYWORDS = [
  "remodel", "renovation", "alteration", "convert", "conversion",
  "addition", "add a room", "wall removal", "remove wall", "open up",
  "reconfigure", "expand", "extend", "modify", "gut",
  "kitchen", "bathroom", "bedroom", "living room", "basement",
  "garage conversion", "enclosed patio", "enclose",
];

// Project types that do NOT need existing floor plans
const NO_EXISTING_PLANS_KEYWORDS = [
  "new construction", "new detached", "new build", "ground up",
  "solar", "photovoltaic", "pv system",
  "hvac", "water heater", "furnace", "air condition",
  "re-roof", "roof replacement", "reroof",
  "fence", "retaining wall",
  "deck", "patio cover", "pergola", "gazebo",
  "pool", "spa",
  "electrical panel", "subpanel",
];

function needsExistingPlans(projectType: string): { needed: boolean; reason: string } {
  const desc = projectType.toLowerCase();

  for (const keyword of NO_EXISTING_PLANS_KEYWORDS) {
    if (desc.includes(keyword)) {
      return {
        needed: false,
        reason: `"${projectType}" is new work or equipment replacement — only proposed plans are needed, not existing floor plans.`,
      };
    }
  }

  for (const keyword of NEEDS_EXISTING_PLANS_KEYWORDS) {
    if (desc.includes(keyword)) {
      return {
        needed: true,
        reason: `"${projectType}" modifies existing structure — the plan set must show both existing and proposed conditions so reviewers can see what's changing.`,
      };
    }
  }

  // ADU: depends on type
  if (desc.includes("adu") || desc.includes("accessory dwelling")) {
    if (desc.includes("detached") || desc.includes("backyard") || desc.includes("new")) {
      return {
        needed: false,
        reason: "A detached ADU is new construction — only proposed plans and a site plan are needed.",
      };
    }
    if (desc.includes("attached") || desc.includes("garage") || desc.includes("jadu")) {
      return {
        needed: true,
        reason: "An attached ADU, JADU, or garage conversion modifies existing structure — existing floor plans are needed to show what's changing.",
      };
    }
    return {
      needed: true,
      reason: "ADU projects that modify existing structures need existing floor plans. If this is a detached new build, existing plans are not needed.",
    };
  }

  return {
    needed: true,
    reason: "Most construction projects that alter existing structures require existing floor plans. If this is purely new construction, they may not be needed.",
  };
}

function detectJurisdiction(zoning: PropertyZoningData): "city" | "county" | "unknown" {
  // If we got a zone code from the city's ArcGIS, it's in the city
  if (zoning.zone_code) return "city";
  // If we got an address but no zone, likely county unincorporated
  if (zoning.address) return "county";
  return "unknown";
}

interface PermitHistorySummary {
  total_permits: number;
  oldest_permit_year: string | null;
  newest_permit_year: string | null;
  has_building_permits: boolean;
  permits: Array<{
    id: string;
    type: string;
    status: string;
    date: string;
  }>;
}

function summarizePermitHistory(
  cityPermits: NormalizedPermit[],
  countyPermits: Array<{ record_id: string; record_category?: string; record_type?: string; record_status: string; open_date: string }>
): PermitHistorySummary {
  const allPermits: Array<{ id: string; type: string; status: string; date: string }> = [];

  for (const p of cityPermits) {
    allPermits.push({
      id: p.approval_id || p.project_id,
      type: p.approval_type,
      status: p.approval_status,
      date: p.date_created || p.date_issued,
    });
  }

  for (const p of countyPermits) {
    allPermits.push({
      id: p.record_id,
      type: p.record_category || p.record_type || "",
      status: p.record_status,
      date: p.open_date,
    });
  }

  const years = allPermits
    .map((p) => p.date?.slice(0, 4))
    .filter((y) => y && y.length === 4)
    .sort();

  const hasBldg = allPermits.some(
    (p) => p.type.toLowerCase().includes("building") || p.type.toLowerCase().includes("construction")
  );

  return {
    total_permits: allPermits.length,
    oldest_permit_year: years[0] || null,
    newest_permit_year: years[years.length - 1] || null,
    has_building_permits: hasBldg,
    permits: allPermits.slice(0, 10), // top 10
  };
}

function getCityGuide(isOwner: boolean, yearBuilt?: number): {
  steps: Array<{ step: number; title: string; detail: string; time_estimate?: string }>;
  what_to_bring: string[];
  warnings: string[];
} {
  const plansDigital = yearBuilt && yearBuilt >= 2018;

  const steps = [
    {
      step: 1,
      title: "Schedule a Records Review appointment at DSD",
      detail: "Book online at the DSD appointment calendar. Appointments are required — no walk-ins.",
      time_estimate: "Appointments typically available within 1-2 weeks",
    },
    {
      step: 2,
      title: "View plans at the DSD office",
      detail: `Visit DSD Records at 7650 Mission Valley Road, San Diego, CA 92108. Anyone can view plans for any property for free. ${plansDigital ? "Plans submitted after 2018 may be available digitally in the Accela system." : "Plans predating 2018 are physical copies only."}`,
    },
    {
      step: 3,
      title: "Request plan copies via the Plan Duplication Application",
      detail: isOwner
        ? "Staff will partially complete the application with you on-site. Bring valid photo ID. If your property title is in a Trust, bring: (1) Trust title page, (2) Designation of Trustee page, (3) Signature page."
        : "Staff will partially complete the application with you. You will then need to get the current property owner's signature on the application before returning it.",
    },
  ];

  if (!isOwner) {
    steps.push({
      step: 4,
      title: "Get the property owner's signature",
      detail: "The completed application requires the current owner's signature (or HOA representative if applicable). If title is held by a trust, corporation, or LLC, additional documentation is needed to verify who can sign.",
      time_estimate: "Depends on owner availability",
    });
  }

  steps.push({
    step: steps.length + 1,
    title: "Return completed application to DSD",
    detail: "Once you have all signatures and supporting documents, return the application to DSD.",
  });

  steps.push({
    step: steps.length + 1,
    title: "Wait for copyright clearance (if applicable)",
    detail: "If the plans are signed and stamped by an architect or engineer, they are copyrighted. The City must contact that professional for permission to duplicate. This is the main reason the process takes time.",
    time_estimate: "Up to 6 weeks total",
  });

  steps.push({
    step: steps.length + 1,
    title: "Pick up copies",
    detail: "Once permission is granted, copies are available at $0.25 per page. The City will notify you when they're ready.",
  });

  const what_to_bring = [
    "Valid photo ID (driver's license or passport)",
    "Property address and/or APN (Assessor Parcel Number)",
  ];
  if (isOwner) {
    what_to_bring.push(
      "If property is in a Trust: (1) Title page, (2) Designation of Trustee page, (3) Signature page"
    );
  }

  const warnings = [
    "Architect-stamped plans are copyrighted under CA Health & Safety Code 19850-19853. The City cannot copy them without the architect's permission.",
    "The Plan Duplication Application process typically takes up to 6 weeks.",
    "Copies cost $0.25 per page once permission is obtained.",
    "Plans submitted before 2018 are physical copies only and may not be available digitally.",
  ];

  return { steps, what_to_bring, warnings };
}

function getCountyGuide(isOwner: boolean): {
  steps: Array<{ step: number; title: string; detail: string; time_estimate?: string }>;
  what_to_bring: string[];
  warnings: string[];
} {
  const steps = [
    {
      step: 1,
      title: "Check the PDS Document Library online",
      detail: "San Diego County's Planning & Development Services (PDS) has an online document library where some permit records are available for download. Search by address or permit number first — you may find what you need without visiting in person.",
    },
    {
      step: 2,
      title: "Submit a Public Records Act (PRA) request online",
      detail: "If plans aren't available in the document library, submit a PRA request through the County's NextRequest portal. Describe what you need (e.g., 'building plans/floor plans for [address]').",
      time_estimate: "County must respond within 10 days per CA Government Code 6253",
    },
    {
      step: 3,
      title: "Visit the County Permit Center (if needed)",
      detail: "If online options don't work, visit the Permit Center at 5510 Overland Ave, San Diego, CA 92123 (1st floor). You can view records and request copies in person.",
    },
  ];

  if (!isOwner) {
    steps.push({
      step: 4,
      title: "Note: Owner permission may be required for copies",
      detail: "Similar to the City, architect-stamped plans are copyrighted. The County may require owner authorization and/or architect permission to provide copies.",
    });
  }

  const what_to_bring = [
    "Property address and/or APN",
    "Any permit numbers you found from permit history search",
  ];

  const warnings = [
    "County records may be less digitized than City records — older plans may require in-person viewing.",
    "Architect-stamped plans are copyrighted and may require additional authorization.",
  ];

  return { steps, what_to_bring, warnings };
}

export async function handleBuildingPlansGuide(input: BuildingPlansGuideInput): Promise<string> {
  // 1. Determine if existing plans are needed
  const planNeed = needsExistingPlans(input.project_type);

  // 2. Look up property data and permit history in parallel
  const [zoning, cityPermitResult, countyPermitResult] = await Promise.all([
    lookupPropertyZoning(input.address),
    searchCityPermits({ address: input.address, limit: 10 }),
    socrataSearch({ address: input.address, limit: 10 }),
  ]);

  // 3. Determine jurisdiction
  const jurisdiction = detectJurisdiction(zoning);

  // 4. Summarize permit history
  const permitHistory = summarizePermitHistory(
    cityPermitResult.results,
    countyPermitResult.results
  );

  // 5. Build the guide based on jurisdiction
  const guide = jurisdiction === "county"
    ? getCountyGuide(input.is_owner)
    : getCityGuide(input.is_owner, zoning.year_built);

  // 6. Build alternatives list
  const alternatives = [
    {
      option: "Hire a surveyor / architect for as-built drawings",
      detail: "If original plans aren't on file or can't be copied, hire a professional to measure and draw the existing conditions. Cost: $1,000-$5,000 depending on property size.",
      when: "Best when plans were never filed with the city, or the structure has been significantly modified since original plans were drawn.",
    },
    {
      option: "Check with the original builder or architect",
      detail: "If you know who designed or built the home, they may still have copies of the plans. Check your closing documents for architect/builder info.",
      when: "Works best for newer homes or homes built by larger developers.",
    },
    {
      option: "Draw your own existing conditions plan",
      detail: "For simpler remodels, you or your contractor may be able to measure the space and create basic floor plans showing existing conditions. Must be to scale.",
      when: "Acceptable for minor remodels where the scope of change is limited and doesn't affect structural elements.",
    },
  ];

  // 7. Compose result
  const result = {
    needs_existing_plans: planNeed.needed,
    reason: planNeed.reason,
    jurisdiction: jurisdiction === "city" ? "City of San Diego" : jurisdiction === "county" ? "San Diego County (unincorporated)" : "Unknown — verify with the city/county",
    property_info: {
      address: zoning.address || input.address,
      zone_code: zoning.zone_code || "Not found",
      zone_description: zoning.zone_plain_english || "Not found",
      year_built: zoning.year_built || "Not found",
      apn: zoning.apn || "Not found",
      is_coastal: zoning.is_coastal,
      is_historic: zoning.is_historic,
    },
    permit_history: {
      summary: permitHistory.total_permits > 0
        ? `Found ${permitHistory.total_permits} permit(s) on file for this address${permitHistory.has_building_permits ? " including building permits (plans likely on file)" : ""}.`
        : "No permits found on file. Original construction plans may still be available at the records office.",
      oldest_permit_year: permitHistory.oldest_permit_year,
      newest_permit_year: permitHistory.newest_permit_year,
      has_building_permits: permitHistory.has_building_permits,
      recent_permits: permitHistory.permits,
    },
    guide: planNeed.needed ? guide : {
      steps: [{
        step: 1,
        title: "Existing floor plans are not required for this project type",
        detail: planNeed.reason + " You only need to prepare proposed plans showing what you intend to build.",
      }],
      what_to_bring: [],
      warnings: [],
    },
    alternatives: planNeed.needed ? alternatives : [],
    links: jurisdiction === "county"
      ? {
          pds_public_records: "https://www.sandiegocounty.gov/content/sdc/pds/PRA.html",
          county_pra_portal: "https://pra.sandiegocounty.gov/requests/new",
          county_permit_center: "5510 Overland Ave, San Diego, CA 92123",
          county_online_services: "https://www.sandiegocounty.gov/content/sdc/pds/pdsonlineservices.html",
        }
      : {
          appointment_scheduling: "https://outlook.office365.com/owa/calendar/DSDVirtualCounterAppointmentRecordsServices@cityofsandiego.onmicrosoft.com/bookings/",
          plan_duplication_procedure: "https://www.sandiego.gov/development-services/records/architectural-building-plans-request",
          dsd_records_office: "7650 Mission Valley Road, San Diego, CA 92108",
          dsd_pra_portal: "https://sandiego.nextrequest.com/requests/new",
          dsd_phone: "619-446-5000",
        },
    legal_reference: "CA Health & Safety Code Sections 19850-19853 governs reproduction of building plans held by local agencies.",
  };

  return JSON.stringify(result, null, 2);
}
