# Hackathon GitHub Repo — Resource Directory

Research compiled 2026-03-04 at 1:00 AM.

## Repo
**URL:** https://github.com/Backland-Labs/city-of-sd-hackathon
**Organizer:** Backland Labs (Max Krueger / Casper Studios)

## What the Repo Provides

The repo is a **resource directory** — not a starter kit. It's a curated list of links to City of San Diego data sources and APIs, organized by category. No code, no MCP servers, no boilerplate.

## Data Sources Listed

### Open Data Portal
| Resource | URL | Notes |
|----------|-----|-------|
| Main Portal | https://data.sandiego.gov/ | CSV, JSON, API access |
| All Datasets | https://data.sandiego.gov/datasets/ | Browse/filter |
| Getting Started | https://data.sandiego.gov/get-started/ | Docs and guides |
| Open Source Projects | https://data.sandiego.gov/open-source/ | City GitHub repos |

### Municipal Code
| Resource | URL | Notes |
|----------|-----|-------|
| Official Municipal Code | sandiego.gov/city-clerk/officialdocs/municipal-code | HTML browsable, structured by chapter/section |
| American Legal (searchable) | codelibrary.amlegal.com/codes/san_diego | Cross-referenced, good for **programmatic text extraction** |
| Codes & Regulations (DSD) | sandiego.gov/development-services/codes-regulations | Local amendments to CA Building Code (Title 24). 2025 CBC effective Jan 1, 2026; local amendments expected March–April 2026 |

### Building & Permits
| Resource | URL | Notes |
|----------|-----|-------|
| Building Permit Overview | sandiego.gov/.../building-permit | Requirements, exempt projects |
| Permits Hub | sandiego.gov/.../permits-inspections | Full process hub |
| All Permit Types | sandiego.gov/.../permits | Overview |
| Permits FAQs | sandiego.gov/.../permits/faqs | Common questions |
| UpCodes (3rd party) | up.codes/codes/san-diego | **Developer-friendly** code lookups |
| UpCodes Viewer | up.codes/viewer/san-diego/ca-building-code-2022 | Full-text CBC viewer |

### Council & Government Records
| Resource | URL | Notes |
|----------|-----|-------|
| Council Agendas/Minutes | sandiego.gov/city-clerk/city-council-docket-agenda | Dockets, results |
| Video Archives (Granicus) | sandiego.granicus.com | Whisper-compatible for transcription |
| Public Records (NextRequest) | sandiego.nextrequest.com | 40,000+ searchable FOIA requests |
| Digital Archives | sandiego.gov/digitalarchives | Historical docs, photos, audio |

## Suggested Project Ideas (from repo)

Several directly overlap with Permit Buddy:
1. **Permit Navigator** — "walks users through the building permit process step by step" ← THIS IS US
2. **Code Compliance Checker** — "given a property address, cross-reference building code, zoning, and local amendments to flag compliance issues"
3. **MCP Server for City Data** — "wraps the Socrata/SODA API" (note: city portal is NOT Socrata, county is)
4. **Municipal Code Assistant** — "plain English navigation of Municipal Code"

## What's NOT in the Repo
- ❌ No MCP servers or starter code
- ❌ No API wrappers
- ❌ No Anthropic-specific tooling
- ❌ No data downloads
- ❌ No ArcGIS/ZAPP endpoints (they missed this — big advantage for us)

## Key Takeaways

1. **No MCP servers exist yet** — we'd be building from scratch, which is fine
2. **ArcGIS endpoints are NOT listed** — this is a significant data advantage for us. Most teams won't know about the programmatic ZAPP access.
3. **American Legal municipal code** is the best source for programmatic code extraction
4. **UpCodes** is the most developer-friendly building code viewer
5. **The repo confirms our positioning is strong** — "Permit Navigator" is listed as a suggested idea, meaning the judges expect it. But we're going deeper (address-specific, data-driven, generative UI).

## Architecture Implications

Since no MCP servers exist, our options for hackathon:
1. **Build a lightweight MCP server** that wraps ArcGIS REST endpoints → Claude can call tools to look up zoning, parcels, overlays
2. **Direct API calls** from Next.js API routes → simpler, faster to build
3. **Hybrid:** Next.js API routes for the demo, with Claude tool calling via Vercel AI SDK

**Recommendation:** Skip MCP for hackathon day. Use Vercel AI SDK `tools` that call ArcGIS REST directly from API routes. Faster to build, easier to demo, same result.
