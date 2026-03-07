import { NextRequest, NextResponse } from "next/server";
import { searchCodeSections, getCodeSections } from "../../lib/data-layer";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query") || "";
  const section = searchParams.get("section") || undefined;

  if (!query && !section) {
    // Return all sections
    return NextResponse.json({
      sections: getCodeSections(),
      total: getCodeSections().length,
    });
  }

  const results = searchCodeSections(query, section);

  return NextResponse.json({
    sections: results,
    total: results.length,
    query,
  });
}
