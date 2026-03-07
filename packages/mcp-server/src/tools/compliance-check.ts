import { z } from "zod";
import { checkExemption } from "../data/permit-knowledge.js";

export const checkExemptionSchema = z.object({
  project_type: z.string().describe("Type of project or work being done (e.g., 'painting interior walls', 'building a 4-foot fence', 'replacing water heater')"),
  property_details: z
    .object({
      zone: z.string().optional().describe("Property zone (e.g., RS-1-7, CC-3-5)"),
      is_historic: z.boolean().optional().describe("Whether property is in a historic district"),
      near_coast: z.boolean().optional().describe("Whether property is in the coastal zone"),
    })
    .optional()
    .describe("Optional property details for more specific guidance"),
});

export type CheckExemptionInput = z.infer<typeof checkExemptionSchema>;

export async function handleCheckExemption(input: CheckExemptionInput): Promise<string> {
  const result = checkExemption(input.project_type);

  const response: Record<string, unknown> = {
    ...result,
    project_type: input.project_type,
  };

  // Add property-specific warnings
  if (input.property_details) {
    const warnings: string[] = [];

    if (input.property_details.is_historic) {
      warnings.push(
        "Property is in a historic district. Even exempt work may need Historic Resources Board review. Contact HRB at (619) 235-5224."
      );
    }

    if (input.property_details.near_coast) {
      warnings.push(
        "Property is in the coastal zone. Additional Coastal Development Permit may be required per California Coastal Act. Contact DSD for coastal zone requirements."
      );
    }

    if (warnings.length > 0) {
      response.warnings = warnings;
    }
  }

  response.disclaimer =
    "This is general guidance based on San Diego Municipal Code §129.0203. Even exempt work must comply with all applicable building codes. Contact the Development Services Department at (619) 446-5000 for final determination.";

  return JSON.stringify(response, null, 2);
}
