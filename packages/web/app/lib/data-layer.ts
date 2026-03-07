import { readFileSync } from "fs";
import { join } from "path";

// Knowledge base helpers
const dataDir = join(process.cwd(), "../../data");

export interface CodeSection {
  section_id: string;
  title: string;
  chapter: string;
  summary: string;
  key_points: string[];
}

export function getCodeSections(): CodeSection[] {
  const raw = readFileSync(
    join(dataDir, "municipal-code-sections.json"),
    "utf-8"
  );
  return (JSON.parse(raw) as { sections: CodeSection[] }).sections;
}

export function searchCodeSections(
  query: string,
  sectionId?: string
): CodeSection[] {
  const sections = getCodeSections();

  if (sectionId) {
    return sections.filter((s) => s.section_id.includes(sectionId));
  }

  const terms = query.toLowerCase().split(/\s+/);
  return sections
    .map((s) => {
      const text =
        `${s.title} ${s.summary} ${s.key_points.join(" ")}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
      return { section: s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.section);
}

export function getNavigationContext(): string {
  const knowledgeRaw = readFileSync(
    join(dataDir, "permit-knowledge.json"),
    "utf-8"
  );
  const faqsRaw = readFileSync(join(dataDir, "faqs.json"), "utf-8");
  const knowledge = JSON.parse(knowledgeRaw);
  const faqs = JSON.parse(faqsRaw).faqs;

  return `You are PermitPal, an AI assistant that helps people navigate San Diego's building permit process.

## Available Permit Types:
${knowledge.permit_types
  .map(
    (p: { name: string; id: string; description: string; estimated_timeline: string; required_forms: string[] }) =>
      `- **${p.name}** (${p.id}): ${p.description}. Timeline: ${p.estimated_timeline}. Forms: ${p.required_forms.join(", ")}.`
  )
  .join("\n")}

## Permit Exemptions (§129.0203):
- Painting, wallpapering, carpeting, countertops, and similar finish work
- One-story detached accessory structures under 120 sq ft
- Fences up to 6 feet (3 feet in front yard)
- Retaining walls up to 3 feet
- Decks not more than 30 inches above grade
- Replacing switches, outlets, light fixtures (like-for-like)
- Replacing faucets, valves, showerheads (like-for-like)

## Processing Options:
${knowledge.processing_options
  .map(
    (o: { name: string; description: string; timeline: string }) =>
      `- **${o.name}**: ${o.description}. Timeline: ${o.timeline}.`
  )
  .join("\n")}

## Common FAQs:
${faqs
  .map((f: { question: string; answer: string }) => `Q: ${f.question}\nA: ${f.answer}`)
  .join("\n\n")}

## Key Forms:
${Object.entries(knowledge.required_forms)
  .map(
    ([id, f]: [string, unknown]) => {
      const form = f as { name: string; description: string };
      return `- **${id}** (${form.name}): ${form.description}`;
    }
  )
  .join("\n")}

When a user describes their project, provide:
1. What permits they likely need (with form numbers)
2. Whether any exemptions apply
3. Required forms to submit
4. Step-by-step process
5. Estimated timeline
6. Any special considerations

Respond as JSON with fields: permits_needed, exemptions, forms_required, process_steps, estimated_timeline, estimated_cost_range, tips, special_considerations.`;
}
