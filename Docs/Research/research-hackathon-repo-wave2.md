# Hackathon GitHub Repo — Wave 2 Deep Dive

**Source:** https://github.com/Backland-Labs/city-of-sd-hackathon  
**Researched:** 2026-03-03

## What the Repo Is

The Backland-Labs hackathon repo is a **resource directory**, not a starter codebase. It contains no template code, no MCP server implementation, no example app — it's a curated list of links and short context notes. That's fine and actually great news: it means there's no "official" architecture to conform to, and no competing team will have a head start from copy-pasting scaffold code.

## What the Repo Contains

### 1. Open Data Portal
- **URL:** https://data.sandiego.gov/
- **API:** Socrata/SODA — filter, paginate, JSON responses. No API key required for read access.
- **Key note:** "Datasets cover topics including permits, code enforcement, police calls, traffic, budgets, and more."
- **Getting started:** https://data.sandiego.gov/get-started/

### 2. Municipal Code (Two Versions)
- **Official (HTML):** https://www.sandiego.gov/city-clerk/officialdocs/municipal-code — organized by chapter/article/division/section, HTML-browsable with predictable structure
- **American Legal (searchable):** https://codelibrary.amlegal.com/codes/san_diego/latest/sandiego_regs/0-0-0-71708 — cross-referenced, good for text extraction
- **Codes & Regulations (Dev Services):** https://www.sandiego.gov/development-services/codes-regulations — local amendments to California Building Standards Code Title 24

### 3. Permit Resources
- **Permit status lookups:** Uses OpenDSD system at https://opendsd.sandiego.gov (pre-2018 permits) + Accela Citizen Access at https://aca.accela.com/SANDIEGO/ (post-2018)
- **Building Permit overview:** https://www.sandiego.gov/development-services/permits/building-permit
- **UpCodes (developer-friendly):** https://up.codes/codes/san-diego — searchable building codes with 2022 CBC viewer

### 4. Public Records
- **NextRequest:** https://sandiego.nextrequest.com/ — 40,000+ searchable FOIA-style public records requests
- **Council meeting videos (Granicus):** https://sandiego.granicus.com/ — transcribe with Whisper if needed

### 5. Suggested Project Ideas (from repo)
The organizers explicitly listed these, which tells us what *they* consider in-scope and well-positioned:
- **MCP Server or CLI for City Data Querying** — wraps Socrata/SODA API ← directly overlaps our stack
- **Permit Navigator** — walks users through the process step by step ← our exact concept
- **Municipal Code Assistant** — conversational code lookups ← our Claude layer
- **Code Compliance Checker** — cross-references code, zoning, and flags issues before permit submission ← literally our pre-flight check

**Strategic implication:** We are squarely in the most interesting intersection of the suggested ideas. Nobody is going to out-obvious us here. Our edge is polish + real data + the pre-flight framing.

## No Starter Code Found

Confirmed: the repo has no:
- MCP server implementation
- Example Next.js / React template
- SDK configuration files
- Claude API integration examples

This means **we build our own stack from scratch**, which is fine — we have enough data sources (ZAPP, SODA, OpenDSD) and framework direction (see genui-frameworks research doc).

## Action Items for Hackathon Day

1. Register for Socrata API token at data.sandiego.gov/get-started/ (free, increases rate limits)
2. Build MCP server that wraps:
   - SODA API → permit history by address
   - ZAPP/ArcGIS → zoning/parcel data by address
   - Municipal code HTML → zoning rules by code
3. No need to reverse-engineer any special hackathon-provided tooling — there is none
