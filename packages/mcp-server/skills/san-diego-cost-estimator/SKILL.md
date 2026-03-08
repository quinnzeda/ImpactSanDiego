# San Diego Project Cost Estimator Skill

## Purpose
Provide total project cost estimates for any San Diego home improvement project — combining construction costs, permit fees, and professional service fees into an itemized breakdown.

## Tool: `estimate_project_cost`

### Supported Project Types
- `adu_detached`, `adu_attached`, `adu_garage_conversion`, `jadu`
- `kitchen_remodel`, `bathroom_remodel`
- `room_addition`, `garage_new`
- `deck_patio`, `roofing`
- `solar_panels`, `electrical_panel`, `hvac_replacement`
- `fence_retaining_wall`

### Key Parameters
- `project_type` (required) — one of the types above
- `size_sqft` — for sq ft-based projects (ADU, addition, deck, roofing, garage)
- `scope` — for remodels: `minor`, `mid`, `major`, `luxury`
- `system_size_kw` — for solar panel systems
- `linear_feet` — for fences/retaining walls
- `coastal_zone` — adds Coastal Development Permit fee ($1,200)
- `historic_district` — adds Historic Resources Board review fee ($800)
- `hillside` — adds soils/geotechnical report to professional fees ($2k-$5k)

### What It Returns
1. **Construction cost range** (low/high based on SD 2025-2026 market data)
2. **Permit fees** — itemized using IB-501 bracket formula:
   - Building permit, plan check (65% of permit fee)
   - School impact ($5.17/sqft if ADU > 500 sqft)
   - Water/sewer capacity (ADU only, 0.5 EDU)
   - SMIP, Green Building, Technology surcharge
   - Overlay fees (coastal, historic) when applicable
3. **Professional fees** — conditional on project type:
   - Architect, Structural Engineer, Title 24, Surveyor
   - Soils report (hillside), Stormwater plan (>200 sqft disturbance)
4. **Timeline** — design, permit review, construction phases
5. **Total estimate** (low/high, all-in)
6. **Warnings** — overlay alerts, fee threshold triggers
7. **Savings tips** — pre-approved plans, fee waivers, tax credits

### ADU-Specific Logic
- School impact fees only apply above 500 sqft (JADU always exempt)
- Development impact fees waived under 750 sqft (SB 13)
- FAR compliance required above 800 sqft
- 60-day state-mandated permit review timeline
- Free county pre-approved plans referenced as savings tip

## Data Sources
- IB-501 Fee Schedule for Construction Permits (June 2025)
- ICC Building Valuation Data
- San Diego residential construction market research 2025-2026
