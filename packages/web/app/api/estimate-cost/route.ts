import { NextRequest, NextResponse } from "next/server";
import { handleEstimateCost } from "../../lib/cost-estimator";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const project_type = sp.get("project_type") || "adu_detached";
  const size_sqft = sp.has("size_sqft") ? Number(sp.get("size_sqft")) : undefined;
  const coastal_zone = sp.get("coastal_zone") === "true";
  const historic_district = sp.get("historic_district") === "true";
  const hillside = sp.get("hillside") === "true";
  const scope = sp.get("scope") as "minor" | "mid" | "major" | "luxury" | undefined;

  const result = handleEstimateCost({
    project_type,
    size_sqft,
    coastal_zone,
    historic_district,
    hillside,
    scope: scope || undefined,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
