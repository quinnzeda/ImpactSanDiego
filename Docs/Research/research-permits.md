# San Diego Building Permit Process: Deep Dive

Research for Claude Impact Lab Hackathon — March 2026

---

## THE PROCESS STEP BY STEP

### Step 0: Do I even need a permit?
No easy tool exists. You're supposed to read Municipal Code §129.0203. Most homeowners either over-permit (waste money) or skip permits entirely (risk during sale).

Cosmetic work (paint, flooring, cabinets) = no permit. Almost anything structural = permit:
- Adding a room, bathroom, or ADU
- Removing/opening walls
- New electrical circuits or panels
- New plumbing or rerouting pipes
- HVAC, decks, fences over 6ft, retaining walls, solar

### Step 1: Figure out your zoning
San Diego has **36 different base zones** (RS-1-7, RM-2-5, etc.) with different setbacks, height limits, floor area ratios.

Then **overlay zones** stack on top:
- **Coastal Overlay** — separate Coastal Development Permit needed
- **Airport Influence Area** — height restrictions, noise rules
- **Historic District** — triggers historic review for structures 45+ years old
- **Steep Hillside** — geological review
- **Community Plan Overlays** — neighborhood-specific rules

**How to find your zoning:** Use ZAPP (ArcGIS map), enter address, click parcel. But for full overlay info you have to EMAIL DSD-Parcel@sandiego.gov and wait ~1 week for a Parcel Information Checklist.

**Pain point:** You may not discover you're in a Coastal Overlay or that your 1962 house triggers historic review until mid-application. Each overlay = separate approval process = more time.

### Step 2: Hire architect, draw plans
Need complete architectural plan set: site plan, floor plans, elevations, structural details, Title 24 energy calcs, stormwater checklist, water meter data card. If building is 45+ years: Assessor Building Record + photo survey.

ADU design packages: $5,000-$15,000 alone.

Plans must be in specific digital format — landscape, specific sheet numbering, PDF bookmarks, file naming conventions. Wrong format = rejected at intake.

### Step 3: Apply online via OpenDSD portal
100% digital since COVID. No in-person service.

Create account → fill out application → upload plan documents → system checks for minimum files (but NOT content quality) → receive PRJ number.

### Step 4: Intake review
Staff manually checks: format correct? Required docs present? Project type accurate?

If wrong = kicked back, clock resets. If ok = deemed "complete" → plan check invoice generated.

### Step 5: Pay plan check fees
You pay BEFORE review starts. Fees based on construction valuation.

ADU fee examples:
- 400 sq ft: ~$6,500 total
- 750 sq ft: ~$21,000 total

**Pain point:** You DON'T KNOW the exact fee until the invoice is generated. No estimator tool.

### Step 6: Plan check review (Round 1)
Multiple departments review simultaneously:
- Building (structural, energy, accessibility)
- Planning (zoning, land use, community plan)
- Fire
- Public Utilities (water/sewer)
- Development Impact Fees

Each has its own queue. Slowest one = your wait time.

Residential remodel first review: ~30-60 days
ADUs and complex projects: 60-150+ days

### Step 7: Get corrections back ("redlines")
You receive a Required Submittal report listing every correction each department needs.

Common reasons for corrections:
- Wrong setback dimensions
- Missing energy compliance forms
- Structural calcs don't match drawings
- Stormwater checklist incomplete
- Historic review not triggered (house is old)
- Title sheet missing code references
- Wrong zoning noted
- Coastal zone requirements not addressed

**Pain point:** Correction list uses technical language referencing specific code sections. Homeowner without an architect is completely lost.

### Step 8: Revise and resubmit (repeat 2-5 times)
Each recheck: ~15-30 days per round.

The trap: departments review independently. Building may be done but Planning still has issues. Each resubmittal can reset queues.

**2-3 rounds = normal. 4-5 = common. 6+ = not unheard of.**

Why so many rounds:
1. Each reviewer only flags their own issues — errors compound
2. Reviewers change between rounds (different person, different interpretation)
3. Fixes in one area create new issues in another
4. Errors like wrong FAR cascade through multiple sheets

### Step 9: All departments approve → stamps collected

### Step 10: Permit issuance
~2 business days. Final completeness check. Pay remaining fees. Receive permit card + stamped plans.

### Step 11: Inspections during construction
Foundation → framing → rough plumbing/electrical → insulation → final.
Failed inspection = construction stops until corrections made.

---

## WHY IT TAKES 176 DAYS

**From 115 days (2020) to 176 days (2024) — 53% increase.**

1. **Everything online, nothing faster.** Pre-COVID: walk in, sit with plan checker, resolve in real time, sometimes same day. Now: async email, 3-6 weeks per interaction.

Quote from DSD Director Elyse Lowe (CBS8, 2022): "You used to be able to walk into our lobby, sit there and wait, meet with several different people over the counter, and potentially get your permit within a day or two. That process right now takes upwards three or four months."

2. **Staffing crisis.** 150 vacancies out of 600+ positions. Experienced plan checkers retired. New hires take 6-12 months to become effective.

3. **Sequential reviews that should be parallel.** Poor coordination between departments. System designed for in-person handoffs; virtual workflows broke the informal coordination.

4. **Incomplete submissions.** Portal checks for file presence, not content quality. Applicants submit "complete" but substantively wrong plans. Each round of corrections = more weeks.

---

## JOBS TO BE DONE

### Functional Jobs
- "I need legal permission to build this thing on my property"
- "I need to know what's allowed on my specific lot"
- "I need to know what documents to prepare before I spend money on an architect"
- "I need to know how much this will cost before I commit"
- "I need to know how long this will take so I can plan my life"

### Emotional Jobs
- "I don't want to feel stupid navigating a process I don't understand"
- "I don't want to waste months and thousands of dollars on something that gets rejected"
- "I don't want to be surprised by costs, rules, or timelines"
- "I want to feel like I'm making progress, not stuck in a black hole"
- "I don't want to feel like the system is designed to stop me"

### Social Jobs
- "I want to be the homeowner who does things right and legally"
- "I want my contractor to think I'm prepared and organized"
- "I don't want my neighbors to report me for unpermitted work"

### The Core Insight
People aren't hiring the "permit process." They're hiring the OUTCOME: "I want to improve my home legally and without surprises." Everything that adds uncertainty, confusion, or delay is a failure of the system to do the job the person hired it for.

---

## BIGGEST SPECIFIC PAIN POINTS

### ADU Permits
Accessory Dwelling Units are the #1 source of permit confusion in SD. Multiple tiers, ministerial vs. discretionary rules, setback calculations, fee structures. Homeowners routinely get overcharged or denied with no clear explanation.

Reddit: "3 Times San Diego's Development Services Department Incorrectly Overcharged Me $10,000+ for Accessory Dwelling Unit Permits"

### Zoning Overlays
You can be in 3+ overlay zones and not know it until mid-application. Each adds a separate approval process. Coastal overlay alone can add months.

### Plan Check Loop
Plans get kicked back 3-5 times. Each round is 2-4 weeks. Reviewers change. New reviewer, new interpretation. Fixes in one area break another.

### Fee Confusion
No way to estimate fees before applying. Fees vary by construction valuation, which is calculated by the city, not you. School fees, water/sewer fees, impact fees all stack.

### No In-Person Help
Since COVID, no counter service. Everything email. No ability to sit with someone and resolve issues in real time.

### Historic Review Trap
Any structure 45+ years old triggers mandatory historic review. In a city full of mid-century homes, this catches people by surprise constantly.

---

## AVAILABLE DATA (data.sandiego.gov)

### Permit Datasets
- Approved permits (searchable by address, type, date)
- Permit processing timelines
- Development projects in review
- Code enforcement cases

### Zoning/Parcel Data
- ZAPP (Zoning and Parcel Information Portal) — ArcGIS-based
- Parcel boundaries with zone codes
- Community plan areas
- Overlay zones (coastal, airport, historic)

### Municipal Code
- Full code searchable at codelibrary.amlegal.com
- HTML-structured with predictable chapter/section IDs
- Good for programmatic extraction

### What an AI Tool Could Pull
- Parcel zone + all overlay zones for any address
- Applicable setback, height, FAR rules for that zone
- Whether the structure triggers historic review (age)
- Recent permit history at that address
- Average processing times by permit type
- Fee schedules (published annually)

---

## THE DREAM TOOL

### "Ask SD Permits" — What it would do:

1. **Address lookup**: Enter your address → instantly see your base zone, all overlays, lot size, structure age, and what that means in plain English

2. **Project questionnaire**: "What do you want to do?" in plain language → maps to correct permit type. "I want to add a bathroom in my garage" → "You need a Building Construction - General permit with plumbing add"

3. **Smart checklist**: Based on your address + project type, generates the exact list of documents you need. Flags special requirements: "Your home was built in 1968 — you'll need an Assessor Building Record and photo survey for historic review"

4. **Fee estimator**: Based on project type + square footage + your parcel's zones → estimated fee range before you commit

5. **Timeline estimator**: Based on current queue data + your project complexity → "Similar projects are currently taking 90-120 days for first review"

6. **Common mistake warnings**: "The #1 reason projects like yours get kicked back is missing Title 24 energy calculations. Make sure your architect includes these."

7. **Progress tracker**: After submission, plain-language status updates. "Your plans are in Building review (position 47 in queue). Planning has already approved."

### Why This Wins at the Hackathon
- City officials are judging. They KNOW permits are their biggest PR problem.
- A tool that makes DSD look better and reduces incomplete submissions = they want this to exist.
- It's designable in a day — the data exists, the logic is rules-based, Claude handles the natural language layer.
- Nobody else at the hackathon will have a designer. Your UI will be 10x better than every other team's.
- Real product potential after the hackathon.
