# Top Reasons Permit Applications Get Rejected/Corrected

Research compiled 2026-03-01 for SD Permit Buddy hackathon.

## The Big Insight
"Almost every building permit is denied the first time around." — Building Code Forum
Average cost per rejection: $2,500-5,800 (resubmission fees + contractor delays + loan interest + storage)

## Top 7 Site Plan Mistakes (from 15,000+ reviewed applications)
1. **Incorrect property boundary info** — relying on old surveys, not current GIS data
2. **Missing/wrong setback calculations** — varies by zone, structure type, local rules. People fix one setback and violate another.
3. **Incomplete utility & easement documentation** — underground services aren't visible, people don't check
4. **Inadequate drainage/stormwater planning** — new impervious surface = stormwater requirements
5. **Missing or conflicting data between drawing sheets** — floor plan says one thing, section detail says another
6. **Missing code references** — not citing which code sections apply
7. **Missing/incorrect energy calculations** — Title 24 in California, #1 ADU rejection reason in SD

## San Diego Specific
- From DSD website: "making sure applications meet current requirements outlined in the Submittal Manual before uploading"
- Top DSD tips to speed up intake:
  - Plans must be landscape-oriented, sheet numbers at bottom right
  - Use most current forms (they update them)
  - Review Information Bulletins and Technical Bulletins
- Incomplete/inaccurate paperwork = #1 reason permits take too long
- Corrections are issued if parking is missing or unclear (ADUs)
- 2-3 rounds of corrections typical, ~3 weeks each round

## Common Drawing Errors (DesignSync Studio)
1. Incomplete or contradictory information across sheets
2. Missing code references
3. Poorly detailed floor plans and sections
4. Ignoring site and zoning requirements
5. Mislabeling building systems
6. Outdated title blocks or seal info
7. Lack of structural coordination
8. Missing/incorrect energy calculations (Title 24)
9. Unclear/missing egress information
10. Poor graphic quality

## What This Means for Permit Buddy
The tool should:
- **Pre-check** what the city will check: setbacks, overlays, zoning compliance
- **Generate a submission checklist** specific to the project type + property characteristics
- **Flag the gotchas** before they become $3k correction rounds: historic review, coastal overlay, Title 24, stormwater
- **Translate jargon** into human language: "RM-2-4" → "Your neighborhood allows up to 2 homes on your lot"
- **Show what's missing** not just what's needed: "Your architect needs to include energy calculations — 40% of ADU permits get sent back for this"
- Think of it as a **pre-flight checklist** that catches the mistakes BEFORE the city does
