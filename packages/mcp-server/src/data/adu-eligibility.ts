import { PropertyZoningData } from "./property-lookup.js";

export interface AduEligibility {
  eligible: boolean;
  eligibility_type: "single-family" | "multi-family" | "not-eligible" | "unknown";
  zone_code: string | undefined;
  zone_description: string | undefined;
  property_type: string | undefined;
  message: string;
  rules: string[];
  warnings: string[];
  alternatives?: string[];
}

export function checkAduEligibility(zoning: PropertyZoningData): AduEligibility {
  const base = {
    zone_code: zoning.zone_code,
    zone_description: zoning.zone_plain_english,
    property_type: zoning.property_type,
  };

  switch (zoning.property_type) {
    case "single-family":
      return {
        ...base,
        eligible: true,
        eligibility_type: "single-family",
        message: "This property is in a single-family residential zone and is eligible for an ADU.",
        rules: [
          "One ADU + one JADU allowed per lot",
          "Detached ADU: up to 1,200 sq ft, 16 feet height, 4-foot setbacks",
          "Attached ADU: up to 50% of existing living area or 1,200 sq ft (whichever is less)",
          "JADU: up to 500 sq ft, within existing structure footprint",
          "60-day ministerial approval timeline (state mandate)",
          "No impact fees for ADUs under 750 sq ft (SB 13)",
          "No owner-occupancy requirement",
          "No parking required within 1/2 mile of transit",
        ],
        warnings: buildWarnings(zoning),
      };

    case "multi-family":
      return {
        ...base,
        eligible: true,
        eligibility_type: "multi-family",
        message: "This property is in a multi-family residential zone. ADUs are allowed but with different rules than single-family properties.",
        rules: [
          "ADUs allowed by converting existing non-livable space (laundry rooms, storage, boiler rooms, etc.)",
          "At least one detached ADU up to 800 sq ft is always allowed, regardless of lot size",
          "Additional detached ADUs allowed up to 25% of existing unit count (minimum 1)",
          "Detached ADUs: 16 feet height, 4-foot setbacks",
          "JADUs do NOT apply to multi-family properties",
          "60-day ministerial approval timeline (state mandate)",
          "No impact fees for ADUs under 750 sq ft",
          "No parking required within 1/2 mile of transit",
        ],
        warnings: buildWarnings(zoning),
      };

    case "commercial":
      return {
        ...base,
        eligible: false,
        eligibility_type: "not-eligible",
        message: `This property is zoned ${zoning.zone_code} (${zoning.zone_plain_english}), which is a commercial zone. Traditional ADUs are not permitted in commercial zones under San Diego Municipal Code §141.0302.`,
        rules: [],
        warnings: [],
        alternatives: [
          "If this is a mixed-use zone, residential units may be possible through a different permit pathway — consult DSD",
          "Consider whether the property could be rezoned or if a community plan amendment applies",
          "Contact the Development Services Department at (619) 446-5000 for site-specific guidance",
          "Visit https://www.sandiego.gov/development-services for more information",
        ],
      };

    case "industrial":
      return {
        ...base,
        eligible: false,
        eligibility_type: "not-eligible",
        message: `This property is zoned ${zoning.zone_code} (${zoning.zone_plain_english}), which is an industrial zone. ADUs are not permitted in industrial zones.`,
        rules: [],
        warnings: [],
        alternatives: [
          "Industrial zones do not allow residential dwelling units",
          "Contact the Development Services Department at (619) 446-5000 for site-specific guidance",
        ],
      };

    default:
      return {
        ...base,
        eligible: true, // don't block if we can't determine
        eligibility_type: "unknown",
        message: "Zoning could not be determined for this property. The guidance below assumes the property is in a residential zone. Please verify zoning with DSD before proceeding.",
        rules: [
          "ADU eligibility depends on your property's zoning designation",
          "Single-family zones (RS, RE): 1 ADU + 1 JADU allowed",
          "Multi-family zones (RM, RT): ADUs allowed with different rules",
          "Commercial and industrial zones: ADUs not permitted",
        ],
        warnings: ["Zoning could not be verified — confirm with the Development Services Department before starting your project"],
      };
  }
}

function buildWarnings(zoning: PropertyZoningData): string[] {
  const warnings: string[] = [];
  if (zoning.is_coastal) {
    warnings.push("Property is in the Coastal Zone — a Coastal Development Permit may be required in addition to the ADU permit");
  }
  if (zoning.is_historic) {
    warnings.push("Property is in a Historic District — Historic Resources Board review may be required");
  }
  if (zoning.overlays.includes("Transit Area")) {
    warnings.push("Property is in a Transit Area — no replacement parking required for ADU");
  }
  return warnings;
}
