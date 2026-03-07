# San Diego Building Permit Navigation Skill

## Purpose
Help users determine what building permits they need for their project in the City of San Diego.

## Workflow

### Phase 1: Project Assessment
1. Parse the user's project description to identify the type of work
2. Categorize as: NEW_CONSTRUCTION, ADDITION, ALTERATION, REPAIR, DEMOLITION, EQUIPMENT_REPLACEMENT, SOLAR, ADU, or EXEMPT
3. Check if the work falls under permit exemptions (§129.0203)

### Phase 2: Requirement Lookup
1. Load the appropriate reference file for the project category
2. Cross-reference with municipal code sections for zoning/setback/height requirements
3. Identify all required permits, forms, and supporting documents

### Phase 3: Clarifying Questions (if include_questions=true)
1. Generate 3-6 targeted questions based on project category
2. Focus on details that affect permit determination (size, location, structural changes)
3. Wait for user responses before proceeding to Phase 4

### Phase 4: Roadmap Generation
1. Compile the complete permit roadmap with:
   - Required permits (with code citations)
   - Applicable exemptions
   - Required forms (with DS-xxx form numbers)
   - Step-by-step process
   - Estimated timeline
   - Cost guidance
   - Tips and special considerations
2. Flag any areas of uncertainty and recommend consulting DSD

## Data Sources (in priority order)
1. `references/` directory - curated San Diego-specific data
2. Live Socrata API - SD County permit records for precedent
3. CSV bulk data - City of San Diego 256K+ permit records
4. OpenDSD - real-time City permit lookups

## Key Rules
- Always cite code sections (§xxx.xxxx) when referencing requirements
- Always recommend confirming with DSD at (619) 446-5000
- Never state that a permit is definitely not needed without citing the exemption
- ADU applications have a 60-day state-mandated processing timeline
- Always mention expedited processing options when available
