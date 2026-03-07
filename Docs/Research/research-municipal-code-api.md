# San Diego Municipal Code — Programmatic Access Research

**Researched:** 2026-03-03  
**Purpose:** Can we look up zoning rules, setback requirements, and ADU regulations programmatically for Permit Buddy?

---

## The Three Versions of the Code

| Source | URL | Format | API? |
|--------|-----|--------|------|
| **Official city site** | sandiego.gov/city-clerk/officialdocs/municipal-code | HTML, by chapter | No |
| **American Legal (amlegal.com)** | codelibrary.amlegal.com/codes/san_diego/... | HTML, searchable | No public API |
| **UpCodes** | up.codes/codes/san-diego | HTML, full-text viewer | No public API |

---

## American Legal Publishing (codelibrary.amlegal.com)

### What It Is
Third-party municipal code publisher that hosts the official San Diego Municipal Code online. Also hosts the SD County Code of Regulatory Ordinances.

**Key URLs:**
- City of San Diego: `https://codelibrary.amlegal.com/codes/sandiego/latest/sandiego_ca/0-0-0-1`
- SD County Regulatory Ordinances: `https://codelibrary.amlegal.com/codes/san_diego/latest/sandiego_regs/0-0-0-71708`

### API Status
**No public API.** amlegal.com offers codification services to municipalities and is a legal publisher — they don't expose a public REST endpoint. Direct API access attempts return 403.

### URL Structure (useful for scraping)
The site uses predictable section IDs:
```
https://codelibrary.amlegal.com/codes/sandiego/latest/sandiego_ca/0-0-0-{SECTION_ID}
```

Section IDs are numeric and predictable within each chapter. For zoning:
- Title 13 (Zoning) is the core chapter for residential permit rules
- ADU regulations live in §141.0302 (Accessory Dwelling Units)
- Setbacks, height limits, FAR in §131.0430 et seq.

### Web Scraping Feasibility
The site uses Cloudflare bot protection → **standard fetch will 403**. Puppeteer (headless Chrome) can navigate it, but is slow and fragile.

**Better approach:** Scrape once, store locally, serve from our MCP server.

---

## Official City Site (sandiego.gov)

### Municipal Code Structure
The official HTML version at sandiego.gov has a cleaner structure than amlegal for our purposes:
- **Predictable anchors:** Each section has stable IDs like `#title13` → `#division1` → `#article1`
- **No Cloudflare:** City site is generally crawlable
- **Less cross-referencing** than amlegal but simpler to parse

### Key Sections for Permit Buddy

| Code Section | Content | Why it matters |
|---|---|---|
| **SDMC Title 13** | Zoning Ordinance | All residential zone rules |
| **§131.0430** | Height Limits by Zone | Critical for ADU height checks |
| **§141.0302** | Accessory Dwelling Units | State law + local ADU regs |
| **§141.0305** | Junior ADUs | JADU rules, owner-occupancy |
| **§131.0444** | Setback Requirements | 15ft front, 5ft side, 13ft rear (varies) |
| **§143.0110** | Coastal Overlay Zone | Triggers additional review |
| **§143.0150** | Historical Resources | Mills Act properties, preservation rules |

---

## UpCodes (up.codes)

### What It Is
Third-party building code viewer. Has San Diego's adopted version of the 2022 California Building Code.

**URL:** https://up.codes/viewer/san-diego/ca-building-code-2022

### API Status
No public API. But UpCodes has a much more developer-friendly UI and is easier to scrape than amlegal. Their content is HTML with semantic structure.

### What it covers
Structural, fire, electrical, mechanical, plumbing code — the *how to build it* layer. Our focus (zoning, permits, setbacks) is in the Municipal Code, not the Building Code. UpCodes is useful for the "what standards does the construction need to meet" questions, not the "what permits do I need" questions.

---

## Practical Strategy: Pre-Embed Key Zoning Rules

For the hackathon, **don't try to build a live code lookup**. Instead:

### Approach 1: Static Knowledge in Claude's System Prompt
Embed the most critical rules directly into the MCP server prompt or system prompt:
- ADU rules: max size, setbacks, height, owner-occupancy (JADU only)
- Zone definitions: R-1, RM-2-4, RM-3-9, etc. in plain English
- Fee schedule highlights
- Common rejection reasons (from research-rejection-reasons.md)

This is what we have time for on hackathon day and is fully sufficient for a demo.

### Approach 2: Pre-Scraped Code as RAG Context
Scrape key sections *before* hackathon day → store as markdown → chunk → embed → query at runtime.

**Pre-scrape list:**
```
Title 13 (Zoning Ordinance) — full text
§141.0302 (ADU rules)
§141.0305 (JADU rules)
Information Bulletins:
  - IB-106 (ADU)
  - IB-544 (Coastal)
  - IB-201 (Single Family Additions)
```

Use Claude to clean/structure the scraped text before embedding.

### Approach 3: amlegal API (Future / If Time Permits)
amlegal does offer API access — you have to contact them. This is not realistic for hackathon day, but worth noting for a real product:
- Contact: 800-445-5588 or through their website
- Pricing: Enterprise SaaS, not public

---

## Municipal Code Web Scraping Code

```typescript
// scrape-code.ts — run before hackathon day
import * as cheerio from 'cheerio';

const sections = [
  { id: 'adu-rules', url: 'https://www.sandiego.gov/city-clerk/officialdocs/municipal-code', selector: '#sec141-0302' },
  // ... etc
];

async function scrapeSection(url: string, selector: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (research bot)' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  return $(selector).text();
}
```

**Reality check:** The official sandiego.gov municipal code page is actually a PDF link to a scanned document, not a browsable HTML version. The amlegal version is the only navigable HTML version.

**Revised approach:** Use amlegal URLs with Puppeteer to scrape pre-hackathon, save as markdown files, load into context.

---

## What Claude Already Knows

Good news: Claude (Claude 3.5/3.7/Opus) has solid knowledge of:
- California ADU law (SB 9, AB 68, etc.)
- General building permit process
- Zoning terminology

What Claude won't know without retrieval:
- Specific SD zone setback numbers (varies by zone)
- Current fee schedule (changes annually)
- Specific coastal/historic overlay boundaries
- Recent code amendments (local amendments effective March–April 2026)

**Bottom line:** Claude as a base is strong. We add retrieval for SD-specific numbers and local amendments.

---

## MCP Server Design for Code Lookups

```typescript
// MCP tool: lookup_zoning_rules
{
  name: "lookup_zoning_rules",
  description: "Get specific zoning rules for an SD zone designation",
  inputSchema: {
    type: "object",
    properties: {
      zone: { type: "string", description: "Zone code like 'RM-2-4' or 'RS-1-7'" },
      project_type: { type: "string", enum: ["ADU", "JADU", "addition", "new_construction", "deck"] }
    }
  }
}

// Backed by: pre-scraped markdown files or embedded JSON lookup table
// Key zones for SD: RS-1-7, RS-1-4, RM-2-4, RM-3-9, OR-1-1
```

```typescript
// MCP tool: lookup_overlay_zones
{
  name: "lookup_overlay_zones",
  description: "Check if an address is in a coastal, historic, or flood overlay zone",
  inputSchema: {
    type: "object", 
    properties: {
      latitude: { type: "number" },
      longitude: { type: "number" }
    }
  }
}
// Backed by: ZAPP/ArcGIS query (already researched in research-zapp-arcgis.md)
```

---

## Pre-Hackathon To-Do

- [ ] Scrape Title 13 key sections from amlegal using Puppeteer → save as `data/zoning-rules.md`
- [ ] Extract ADU rules table (size, setbacks, height by zone) → save as `data/adu-rules.json`
- [ ] Pull current DSD fee schedule PDF → extract fee table → `data/fee-schedule.json`
- [ ] Build zone lookup table: zone code → plain English description + key limits

These are ~4 hours of prep work that transform the hackathon build from "Claude guesses" to "Claude knows the exact rules for this address."
