import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, "../../../../data");

export interface PermitType {
  id: string;
  name: string;
  description: string;
  typical_projects: string[];
  required_forms: string[];
  estimated_timeline: string;
  fees: string;
  process: string[];
  special_notes?: string;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  related_permits?: string[];
  tags?: string[];
}

export interface CodeSection {
  section_id: string;
  title: string;
  chapter: string;
  summary: string;
  key_points: string[];
}

export interface PermitKnowledge {
  permit_types: PermitType[];
  processing_options: Array<{
    name: string;
    description: string;
    eligible_projects: string[];
    timeline: string;
    additional_fee: string;
  }>;
  required_forms: Record<string, { name: string; description: string; url: string }>;
}

let knowledgeCache: PermitKnowledge | null = null;
let faqCache: FAQ[] | null = null;
let codeCache: CodeSection[] | null = null;

export function getPermitKnowledge(): PermitKnowledge {
  if (!knowledgeCache) {
    const raw = readFileSync(join(dataDir, "permit-knowledge.json"), "utf-8");
    knowledgeCache = JSON.parse(raw) as PermitKnowledge;
  }
  return knowledgeCache;
}

export function getFAQs(): FAQ[] {
  if (!faqCache) {
    const raw = readFileSync(join(dataDir, "faqs.json"), "utf-8");
    faqCache = (JSON.parse(raw) as { faqs: FAQ[] }).faqs;
  }
  return faqCache;
}

export function getCodeSections(): CodeSection[] {
  if (!codeCache) {
    const raw = readFileSync(join(dataDir, "municipal-code-sections.json"), "utf-8");
    codeCache = (JSON.parse(raw) as { sections: CodeSection[] }).sections;
  }
  return codeCache;
}

export function searchCodeSections(query: string, sectionId?: string): CodeSection[] {
  const sections = getCodeSections();

  if (sectionId) {
    return sections.filter((s) => s.section_id.includes(sectionId));
  }

  const terms = query.toLowerCase().split(/\s+/);
  return sections
    .map((s) => {
      const text = `${s.title} ${s.summary} ${s.key_points.join(" ")}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
      return { section: s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.section);
}

export function checkExemption(
  projectType: string
): { is_exempt: boolean; reason: string; code_section: string; details: string[] } {
  const type = projectType.toLowerCase();

  const exemptions: Array<{
    keywords: string[];
    reason: string;
    details: string[];
  }> = [
    {
      keywords: ["paint", "painting", "wallpaper", "papering"],
      reason: "Painting and wallpapering are exempt from building permits",
      details: ["Interior and exterior painting", "Wallpaper installation", "Cosmetic finishes"],
    },
    {
      keywords: ["carpet", "flooring", "tile", "tiling", "countertop"],
      reason: "Finish work including carpeting, tiling, and countertops is exempt",
      details: ["Floor covering installation", "Countertop replacement", "Tile installation"],
    },
    {
      keywords: ["shed", "playhouse", "tool shed"],
      reason: "One-story detached accessory structures under 120 sq ft are exempt",
      details: [
        "Must be one story",
        "Floor area must not exceed 120 square feet",
        "Used for tool/storage sheds, playhouses, or similar uses",
      ],
    },
    {
      keywords: ["fence", "fencing"],
      reason: "Fences not over 6 feet high are generally exempt (3 feet in front yard)",
      details: [
        "Side and rear yard: up to 6 feet without permit",
        "Front yard setback: up to 3 feet without permit",
        "Retaining walls up to 3 feet exempt unless supporting surcharge",
      ],
    },
    {
      keywords: ["deck", "platform", "patio"],
      reason: "Decks not more than 30 inches above grade are exempt",
      details: [
        "Must be no more than 30 inches above adjacent grade",
        "Cannot be over any basement or story below",
        "Must not serve as required exit",
      ],
    },
    {
      keywords: ["switch", "outlet", "receptacle", "light fixture"],
      reason: "Replacing existing switches, receptacles, and light fixtures is exempt",
      details: [
        "Like-for-like replacement only",
        "No new circuits or wiring changes",
        "Must maintain same amperage rating",
      ],
    },
    {
      keywords: ["faucet", "valve", "showerhead"],
      reason: "Replacing existing faucets, valves, and similar devices is exempt",
      details: [
        "Like-for-like replacement only",
        "No relocating fixtures",
        "No changing pipe sizes",
      ],
    },
    {
      keywords: ["swing", "playground", "play equipment"],
      reason: "Swings and playground equipment are exempt from permits",
      details: ["Residential playground equipment", "Not for commercial play structures"],
    },
    {
      keywords: ["awning", "window awning"],
      reason: "Window awnings not projecting more than 54 inches are exempt",
      details: ["Must not project more than 54 inches from wall", "Must not require structural support"],
    },
  ];

  for (const ex of exemptions) {
    if (ex.keywords.some((kw) => type.includes(kw))) {
      return {
        is_exempt: true,
        reason: ex.reason,
        code_section: "§129.0203",
        details: ex.details,
      };
    }
  }

  return {
    is_exempt: false,
    reason: "This type of work typically requires a building permit. Check with the Development Services Department for your specific situation.",
    code_section: "§129.0202",
    details: [
      "Most construction, alteration, repair, or conversion work requires a permit",
      "Contact DSD at (619) 446-5000 for specific questions",
      "Visit https://www.sandiego.gov/development-services for more information",
    ],
  };
}

export function getNavigationContext(): string {
  const knowledge = getPermitKnowledge();
  const faqs = getFAQs();

  return `You are PermitPal, an AI assistant that helps people navigate San Diego's building permit process.

## Available Permit Types:
${knowledge.permit_types.map((p) => `- **${p.name}** (${p.id}): ${p.description}. Timeline: ${p.estimated_timeline}. Forms: ${p.required_forms.join(", ")}.`).join("\n")}

## Permit Exemptions (§129.0203 - no permit needed):
- Painting, wallpapering, carpeting, countertops, and similar finish work
- One-story detached accessory structures under 120 sq ft (sheds, playhouses)
- Fences up to 6 feet (3 feet in front yard)
- Retaining walls up to 3 feet (not supporting surcharge)
- Decks not more than 30 inches above grade
- Replacing switches, outlets, light fixtures (like-for-like)
- Replacing faucets, valves, showerheads (like-for-like)
- Swings and playground equipment
- Window awnings under 54 inches projection

## Processing Options:
${knowledge.processing_options.map((o) => `- **${o.name}**: ${o.description}. Timeline: ${o.timeline}. Fee: ${o.additional_fee}.`).join("\n")}

## Common FAQs:
${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}

## Key Forms:
${Object.entries(knowledge.required_forms).map(([id, f]) => `- **${id}** (${f.name}): ${f.description}`).join("\n")}

## ADU Rules by Zone Type:

### Single-Family Zones (RS, RE, RX):
- One ADU + one JADU allowed per lot
- Detached ADU: up to 1,200 sq ft, 16 feet height, 4-foot setbacks
- Attached ADU: up to 50% of existing living area or 1,200 sq ft (whichever is less)
- JADU: up to 500 sq ft, within existing structure footprint
- 60-day ministerial approval timeline (state mandate)
- No impact fees under 750 sq ft (SB 13)
- No owner-occupancy requirement
- No parking required within 1/2 mile of transit

### Multi-Family Zones (RM, RT, RV):
- ADUs allowed by converting existing non-livable space (laundry rooms, storage, boiler rooms)
- At least one detached ADU up to 800 sq ft is always allowed regardless of lot size
- Additional detached ADUs allowed up to 25% of existing unit count (minimum 1)
- Detached ADUs: 16 feet height, 4-foot setbacks
- JADUs do NOT apply to multi-family properties
- 60-day ministerial approval timeline
- No impact fees under 750 sq ft
- No parking required within 1/2 mile of transit

### Commercial Zones (CC, CX, CN, CV, CO, CR, CT):
- Traditional ADUs are NOT permitted in commercial zones
- Mixed-use projects may allow residential units through different permit pathways

### Industrial Zones (IP, IL, IS):
- ADUs are NOT permitted in industrial zones

IMPORTANT: When zoning data is provided in the user's message, use it to determine which ADU rules apply. If the property is in a commercial or industrial zone, clearly state that ADUs are not permitted and suggest alternatives.

When a user describes their project, analyze it and provide:
1. What permits they likely need (with form numbers)
2. Whether any exemptions apply
3. Required forms to submit
4. Step-by-step process
5. Estimated timeline
6. Any special considerations or tips

Be specific and actionable. Cite code sections when relevant. Always recommend consulting with the Development Services Department for final confirmation.`;
}
