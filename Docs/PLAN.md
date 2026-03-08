# SD Permit Buddy — Hackathon Build Plan

**Event:** Claude Impact Lab — Civic AI Hackathon
**Time:** 6 hours
**Team:** 3 people
**Latest prototype:** `prototype-v7.html`

---

## The Real Job We Are Solving

People don't want to navigate the permit process. They want to improve their home legally, without surprises, without wasting money, and without feeling like the system was designed to stop them.

The current situation forces them to:
- Read 10-page legal bulletins written for lawyers
- Discover coastal overlays and historic review requirements mid-application
- Pay $3,100+ in correction fees for mistakes a checklist would have prevented
- Stare at "PENDNG-PLANCK" with no idea what it means or what to do next

**The four forces acting on our user:**

| Force | What's happening |
|-------|-----------------|
| Push | They started a project and hit a wall of jargon, uncertainty, and fear of doing it wrong |
| Pull | They want to feel prepared, competent, and like the process is workable |
| Anxiety | "What if I miss something and it costs me thousands?" — this is the dominant emotion |
| Habit | They're Googling, calling the city, and getting nowhere — tolerating it because they don't know there's a better way |

**Design rule:** Reduce anxiety before adding features. Every decision should make someone feel more capable, not more overwhelmed.

---

## What We Are Building

A permit preparation copilot with two modes:

### Mode 1 — Pre-Submission (before they have a permit number)
Walk them from "I want to build something" to "I know exactly what to submit and I haven't missed anything."

### Mode 2 — In-Flight (after submission, they have a permit number)
Connect to the city's Accela system, pull their real status, translate bureaucratic language into plain English, and tell them what to do next to keep it moving.

**The product is not a guide. It is a copilot.** The difference: a guide explains the process. A copilot walks you through it with your specific address, your specific project, your specific constraints.

---

## The User Journey (5 Stations)

These map to canvas cards that appear as the conversation progresses.

### Station 1 — Do I Even Need a Permit?
User describes what they want to do in plain language. Claude determines:
- Whether a permit is required and why
- What type (building, coastal, historic review, etc.)
- The one key thing that changes everything for their situation

**What appears on canvas:** Permit verdict card — green/amber/red with plain-English explanation.

### Station 2 — What Does My Property Allow?
User gives their address. We pull live city data:
- Base zone (translated: "RM-2-4" → "Up to 2 homes allowed on your lot")
- All overlay zones flagged in plain English (Coastal, Historic, Airport, Fire)
- Lot size, structure age, setbacks
- Past permit history at that address

**What appears on canvas:** Property card — real data, no jargon, overlays called out prominently because these are the surprises that cost people months.

### Station 3 — What Are My Options?
Interactive explorer. User plays with their decision:
- ADU type: detached / attached / garage conversion / JADU
- Size slider: watch fees, costs, and timeline update in real time
- Key thresholds called out: "Going under 500 sq ft saves you $3,100 in school fees"
- Pre-approved county plans surfaced if applicable: "This could save you $10,000 in architect fees"

**What appears on canvas:** Interactive options cards + live cost/timeline calculator.

### Station 4 — What Do I Need to Submit?
Personalized checklist built from their address + their choices. Not generic — every item is specific to them.

Each checklist item expands to show:
- What it is (in plain English)
- Why the city requires it
- Exactly how to get it, where to go, how long it takes
- The most common mistake people make on this item
- A direct link to the right form or office

Warnings surfaced prominently: "40% of ADU permits get returned for missing Title 24 energy calculations. Make sure your architect includes these in the first submittal."

**What appears on canvas:** Expandable checklist — their personal submission roadmap.

### Station 5 — Track My Permit
After submission, user enters their permit number. We query the Accela API and return:
- Current status in plain English (not "PENDNG-PLANCK")
- Which department it's with, which have already approved
- What typically gets flagged on projects like theirs at this stage
- What they can do right now to prepare for the next correction round
- Notification opt-in: "Check back here anytime, or we'll alert you when something changes"

**What appears on canvas:** Status tracker — live data from Accela, human-readable.

---

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **Tailwind CSS** (use design tokens from prototype-v7 — the CSS variables are already dialed in)
- **Vercel AI SDK** (`useChat` hook + tool rendering)
- **shadcn/ui** for base components if needed

### Backend / AI
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`) via Anthropic SDK
- **Vercel AI SDK** `streamText` with tools
- **System prompt** loaded with: SD permit rules, ADU rules, fee schedules, common rejection reasons, plain-English translations of zone codes

### Data Sources (all free, no API key required)

| Source | What it gives us | Endpoint |
|--------|-----------------|----------|
| ArcGIS Geocoder | Address → XY coordinates | `webmaps.sandiego.gov/arcgis/rest/services/DSD/Accela_Locator/GeocodeServer/findAddressCandidates` |
| ArcGIS Parcels | Lot size, APN, land use | `webmaps.sandiego.gov/arcgis/rest/services/GeocoderMerged/MapServer/1/query` |
| ArcGIS Zoning | Base zone code | `webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0/query` |
| ArcGIS Overlays | Coastal, airport, historic, fire | `webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Overlay/MapServer/identify` |
| Accela API | Live permit status by permit number | `apis.accela.com/v4/records?customId={permit}&serviceProviderCode=SANDIEGO` |
| SD Open Data | Past permit history by address | `seshat.datasd.org/development_permits_set2/permits_set2_closed_datasd.csv` |

**Important:** ArcGIS uses spatial reference WKID 2230 (NAD83 CA Zone 6, US Feet) — not WGS84. The geocoder returns candidates in this CRS. Pass coordinates directly into spatial queries without transformation.

### Deployment
- **Vercel** — one command deploy, instant URL for demo

---

## Team — Who Owns What

### Quinn (Designer)
- Owns the visual implementation of all canvas components
- Converts prototype-v7 CSS/layout into Tailwind + React components
- Ensures no jargon appears anywhere in the UI
- Writes all user-facing copy (checklist items, warnings, status translations)
- Manages demo flow and what's shown on projector

**Priority components to build:**
1. `PropertyCard` — address, zone, overlays, lot info
2. `PermitVerdictCard` — yes/no/maybe verdict with plain-English reason
3. `OptionsExplorer` — interactive ADU type toggle + size slider
4. `PersonalizedChecklist` — expandable items with how-to and warnings
5. `StatusTracker` — permit number input + Accela result display

### Dev 1 (Mobile / Business)
- Owns the frontend chat integration
- Wires `useChat` hook to the API route
- Renders canvas components from tool call results
- Handles the split-view layout (chat left, canvas right)
- Manages state: which canvas card is active, what the latest tool results are

**Priority tasks:**
1. Next.js project setup + Tailwind config (import prototype-v7 CSS variables)
2. Chat panel with `useChat` — messages rendering, input, suggestions
3. Canvas panel — renders tool results as components, manages active state
4. Tool result rendering: each tool call → correct component
5. Options explorer interactivity (slider, toggles, real-time fee updates)

### Dev 2 (Backend)
- Owns all server-side logic
- API route (`/api/chat`) with Claude + tools
- All ArcGIS REST integrations
- Accela API integration
- System prompt with embedded SD permit knowledge
- Fee calculation logic

**Priority tasks:**
1. `/api/chat` route with `streamText` + tool definitions
2. `lookupProperty` tool — geocode → parcel → zoning → overlays (4 ArcGIS calls in parallel)
3. `generateChecklist` tool — Claude generates personalized checklist from property data + project type
4. `lookupPermitStatus` tool — Accela API query by permit number
5. System prompt: embed fee schedules, zone code translations, rejection reasons, ADU rules

---

## The 6 Hours — What Gets Built When

### Hour 1: Foundation (all three in parallel)
- **Quinn:** Convert prototype-v7 to React components. Start with PropertyCard and PermitVerdictCard. Get the design system (colors, spacing, type) into Tailwind config.
- **Dev 1:** `npx create-next-app@latest permit-buddy --typescript --tailwind --app`. Set up split-view layout shell. Implement basic `useChat` with hardcoded responses to test the UI.
- **Dev 2:** Write and test all ArcGIS REST calls in isolation (fetch → log response → confirm field names). Confirm Accela API works with a real permit number. Set up `/api/chat` route skeleton.

**End of Hour 1 checkpoint:** The app loads. Chat sends/receives. ArcGIS returns real data for a test address.

### Hour 2: Data Layer + Core Tools
- **Quinn:** OptionsExplorer component — ADU type toggles, size slider with real-time fee display. PersonalizedChecklist component shell.
- **Dev 1:** Wire canvas panel to render components from tool call results. Implement tool result state management (latest property data, latest checklist).
- **Dev 2:** `lookupProperty` tool complete — all 4 ArcGIS calls, normalized response. System prompt with SD permit knowledge loaded. Tool wired into `/api/chat`.

**End of Hour 2 checkpoint:** Type an address → real property card appears on canvas with actual city data.

### Hour 3: Intelligence Layer
- **Quinn:** Checklist items written — each with plain-English explanation, how-to, direct links. StatusTracker component.
- **Dev 1:** Chat suggestions on welcome screen. Message rendering polished. Loading states for tool calls.
- **Dev 2:** `generateChecklist` tool — Claude generates personalized checklist JSON from property + project data. `lookupPermitStatus` tool — Accela API. Fee calculation logic embedded in system prompt.

**End of Hour 3 checkpoint:** Full pre-submission flow works end to end with real data. Address → property card → Claude recommends options → checklist generates.

### Hour 4: Integration + Status Tracker
- **Quinn:** Polish all components. Overlay badges, threshold warnings in calculator, pre-approved plans callout. Write all status translation copy.
- **Dev 1:** Status tracker UI wired to `lookupPermitStatus` tool. All canvas card transitions smooth.
- **Dev 2:** Tune system prompt — test with multiple project types (ADU, bathroom, solar, kitchen). Handle edge cases (address not found, coastal zone, historic).

**End of Hour 4 checkpoint:** Both modes work. Pre-submission complete. Status tracker returns real Accela data.

### Hour 5: End-to-End Testing + Bug Fixes
- All three: Test the full demo flow with real SD addresses. Fix anything broken.
- Confirm these specific flows work for the demo:
  - ADU at a coastal zone address
  - Kitchen remodel at a pre-1980 address (triggers historic review)
  - Permit status lookup with a real permit number
- **Dev 1:** Mobile responsive check (judges may try on phones)
- **Dev 2:** Vercel deploy — get the live URL

**End of Hour 5 checkpoint:** Deployed. Demo flow rehearsed once.

### Hour 6: Polish + Demo Prep
- **Quinn:** Final visual pass. Remove anything that looks unfinished. Prepare the demo address(es) — have them typed and ready, know exactly what will appear.
- **Dev 1:** Performance check — no slow loads during demo. Confirm all animations smooth.
- **Dev 2:** Fallback plan if Accela API is flaky — have a cached response ready for the demo permit number.
- All three: Rehearse the 3-minute demo narrative.

---

## Demo Script (3 Minutes)

**The story we tell:**

"The average San Diego ADU permit takes 176 days. Most get sent back for corrections that a checklist would have prevented. We built the tool the city should have built — one that meets residents where they are and walks them through it."

**Live demo flow:**
1. Type a real SD address on the projector — property card appears with real data in ~3 seconds
2. Type "I want to build a backyard ADU" — Claude responds, permit verdict appears
3. Click through options — show the size slider, watch fees update in real time, surface the pre-approved plans callout
4. Show the personalized checklist — expand 2-3 items to show depth
5. Enter a permit number — show real status from Accela, translated to plain English

**The line that wins:** "Everything you see is real data from the City of San Diego — pulled live, right now, for that address."

---

## What Makes This Win

**vs. every other team:**
- Real data, not mocked — ArcGIS + Accela + SD Open Data all live
- Design quality — prototype-v7 is already 10x better than what others will build in a day
- Both sides of the journey — pre-submission AND in-flight status
- JTBD framing — we solve anxiety, not just information gaps. The checklist is a deliverable, not a screen.

**vs. the city's own tools:**
- No jargon. Ever.
- Surfaces what will get you rejected before you submit
- Tells you what "PENDNG-PLANCK" actually means
- Walks you through each document, not just lists them

**For city officials judging:**
- Reduces incomplete submissions = less rework for reviewers
- Makes DSD look more accessible = good PR
- Complements not replaces — we prepare residents, the city still reviews

---

## Key Technical Notes

### ArcGIS Property Lookup Flow
```
1. Geocode: findAddressCandidates?SingleLine={address}&f=json&maxLocations=1
   → Returns: { x, y } in WKID 2230
2. Parcel: MapServer/1/query?geometry={x,y}&geometryType=esriGeometryPoint&outFields=APN,SITUS_ADDRESS,NUCLEUS_USE_CD,NUCLEUS_ZONE_CD
   → Returns: lot size, APN, land use, generalized zone
3. Zone: DSD/Zoning_Base/MapServer/0/query (same geometry)
   → Returns: actual zone code (RS-1-7, RM-2-4, etc.)
4. Overlays: DSD/Zoning_Overlay/MapServer/identify (all layers at once)
   → Returns: which overlays apply (Coastal, Airport, CPIOZ, etc.)

Run calls 2, 3, 4 in parallel with Promise.all after getting coordinates.
```

### Accela Permit Status Lookup
```
GET https://apis.accela.com/v4/records?customId={permitNumber}&serviceProviderCode=SANDIEGO
→ Returns: status, which department it's with, dates, fees due

GET https://apis.accela.com/v4/records/{recordId}/workflowTasks
→ Returns: exactly what stage it's in and what's pending

No authentication required for GET requests.
```

### Claude Tool Definitions (key ones)
```typescript
lookupProperty(address: string)
  → calls ArcGIS, returns normalized property object
  → Claude uses this to generate property card

generateChecklist(propertyData: object, projectDescription: string, projectType: string)
  → Claude generates personalized checklist as structured JSON
  → Each item: { title, why, howTo, timeToGet, cost, commonMistake, link }

lookupPermitStatus(permitNumber: string)
  → calls Accela, returns status + workflow tasks
  → Claude translates status to plain English

getBuildingPlansGuide(address: string, projectType: string, isOwner: boolean)
  → determines if existing floor plans are needed for the project type
  → auto-enriches with property zoning (ArcGIS) + permit history (Accela/Socrata)
  → returns personalized step-by-step guide for obtaining plans
  → covers City (DSD Plan Duplication) and County (PDS/PRA) processes
```

### System Prompt Key Sections
- Zone code translations (all 36 SD base zones → plain English)
- Fee schedule (plan check, building permit, water/sewer, school, coastal, historic)
- Size thresholds that trigger different rules (500, 750, 800, 1200 sq ft)
- Top 7 rejection reasons with plain-English prevention advice
- Overlay zone explanations (what each means in practice)
- ADU types compared (detached, attached, garage conversion, JADU)
- Pre-approved county ADU plans info + direct links

---

## Fallback Priorities

If time runs short, cut in this order:
1. Cut permit status tracker (Mode 2) — keep pre-submission flow complete
2. Cut historic + fire overlay detail — keep coastal overlay, it's the most common
3. Cut bathroom/kitchen flows — keep ADU only, it's the richest and most demo-able
4. Cut live Accela — use a cached real response for demo

**Never cut:** Real ArcGIS address lookup. This is what makes the demo land.

---

## Files Reference

| File | Purpose |
|------|---------|
| `prototype-v7.html` | Latest design — source of truth for UI |
| `research-permits.md` | Full permit process + pain points |
| `research-user-questions.md` | Decision tree + what people actually ask |
| `research-zapp-arcgis.md` | ArcGIS endpoints with example code |
| `research-opendsd-accela.md` | Accela API + permit status lookup |
| `research-sd-open-data.md` | SD Open Data portal + CSV downloads |
| `research-vercel-ai-sdk.md` | Vercel AI SDK architecture + example code |
| `research-rejection-reasons.md` | Top reasons permits get rejected |
| `research-adu-preapproved-plans.md` | Free county ADU plans + direct links |
