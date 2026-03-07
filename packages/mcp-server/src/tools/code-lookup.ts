import { z } from "zod";
import { searchCodeSections, getCodeSections } from "../data/permit-knowledge.js";

export const codeLookupSchema = z.object({
  query: z.string().describe("Search query for municipal code sections (e.g., 'ADU requirements', 'height limits', 'parking')"),
  section: z.string().optional().describe("Specific section ID to look up (e.g., '§129.0203')"),
});

export type CodeLookupInput = z.infer<typeof codeLookupSchema>;

export async function handleCodeLookup(input: CodeLookupInput): Promise<string> {
  if (input.section) {
    const sections = searchCodeSections("", input.section);
    if (sections.length === 0) {
      return JSON.stringify({
        error: `Section ${input.section} not found in our database.`,
        available_sections: getCodeSections().map((s) => ({
          section_id: s.section_id,
          title: s.title,
        })),
        suggestion: "Try one of the available sections listed above, or search by query instead.",
      });
    }
    return JSON.stringify({ sections });
  }

  const results = searchCodeSections(input.query);

  if (results.length === 0) {
    return JSON.stringify({
      results: [],
      message: "No matching code sections found.",
      available_sections: getCodeSections().map((s) => ({
        section_id: s.section_id,
        title: s.title,
      })),
      suggestion: "Try different search terms or browse the available sections.",
    });
  }

  return JSON.stringify({
    results: results.map((s) => ({
      section_id: s.section_id,
      title: s.title,
      chapter: s.chapter,
      summary: s.summary,
      key_points: s.key_points,
    })),
    total_found: results.length,
  });
}
