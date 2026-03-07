---
title: "feat: Permit Buddy Canvas Components + Canvas Routing"
type: feat
date: 2026-03-07
---

# Permit Buddy Canvas Components + Canvas Routing

## Overview

Build 5 canvas display components and wire smart canvas routing so the right component renders based on what the user asked. This is the core "wow" moment of the demo — the right panel goes from generic roadmap to deeply contextual, situation-aware UI.

**Demo target:** Working end-to-end in under 1 hour.

---

## Current State

- `page.tsx` calls `/api/navigate` → gets either `{phase: "questions"}` or a roadmap blob
- Canvas renders `QuestionsForm` OR `PermitRoadmap` — that's it
- No canvas discriminator; no smart routing; no situation-aware components
- PermitRoadmap works but is generic (not tuned per situation)

## Target State

```
User situation → AI response includes `canvas` field →
page.tsx routes to the right component:

planning  → PropertyCard + PermitVerdictCard
applying  → PersonalizedChecklist
waiting   → StatusTracker
adu/size  → OptionsExplorer (within planning flow)
```

---

## Architecture Decision: Canvas Routing

**Approach:** Dual-layer routing

1. **API layer** — `/api/navigate` includes `canvas: "verdict" | "checklist" | "status" | "property" | "options"` in the JSON response alongside existing fields
2. **Frontend fallback** — `page.tsx` falls back to situation-based routing if `canvas` field is absent (handles fallback path, offline demo)

This is backwards-compatible — existing `PermitRoadmap` stays for any response that doesn't include a `canvas` field.

**Data contract additions to `/api/navigate` response:**

```typescript
// All responses gain:
canvas: "verdict" | "checklist" | "status" | "property" | "options" | "roadmap"

// Canvas-specific data shapes:
// verdict:
verdict: { level: "green" | "amber" | "red", headline: string, reason: string, what_changes_everything: string }

// checklist:
checklist: { items: ChecklistItem[] }
// ChecklistItem: { id, title, why, howTo, timeToGet, cost, commonMistake, link?, warning? }

// property:
property: { address, zone_code, zone_plain_english, overlays: string[], lot_size_sqft, apn, past_permits: PermitRef[] }

// status:
status: { permit_number, plain_english_status, stage_description, next_step, workflow_steps: WorkflowStep[] }

// options (ADU):
options: { adu_types: AduType[], default_type, size_range: { min, max, default } }
```

---

## Implementation Plan

### Phase 1 — API Update (10 min)

**File: `packages/web/app/api/navigate/route.ts`**

- Add `canvas` field to both the AI prompt (Phase 2 roadmap prompt) and the fallback functions
- Situation-to-canvas mapping in fallback:
  - description contains "adu/detached/attached/garage/jadu" → `"options"` (only if include_questions is false and no answers yet) OR `"checklist"` post-answers
  - `include_questions: false` + "waiting/status/track" → `"status"`
  - answers present → `"checklist"` (applying) or `"verdict"` (planning)
  - default → `"roadmap"` (existing behavior)

**Prompt addition to Phase 2:**

```
Add to existing roadmap prompt: include "canvas":"verdict"|"checklist"|"status" to indicate the primary UI mode, plus a "verdict" object if canvas="verdict": {"level":"green"|"amber"|"red","headline":"...","reason":"...","what_changes_everything":"..."}
```

**Fallback function changes:**
- `getFallbackNavigation()` → add `canvas` + verdict/checklist/status data based on `desc` content
- Keep all existing fields intact (backwards compatible)

---

### Phase 2 — Canvas Router in page.tsx (10 min)

**File: `packages/web/app/page.tsx`**

Add imports for 5 new components. Replace the canvas panel's result-rendering block:

```typescript
// Current (lines 560-564):
{!loading && result && (
  <div className="p-6">
    <PermitRoadmap data={result} projectDescription={promptValue || address} />
  </div>
)}

// New:
{!loading && result && (
  <div className="p-6">
    <CanvasRouter
      result={result}
      situation={activeSituation}
      projectDescription={promptValue || address}
    />
  </div>
)}
```

**CanvasRouter logic** (inline function or tiny component in page.tsx):

```typescript
function CanvasRouter({ result, situation, projectDescription }) {
  const canvas = result.canvas ?? situationToCanvas(situation);

  if (canvas === "verdict")   return <PermitVerdictCard data={result} />;
  if (canvas === "checklist") return <PersonalizedChecklist data={result} />;
  if (canvas === "status")    return <StatusTracker data={result} />;
  if (canvas === "property")  return <PropertyCard data={result} />;
  if (canvas === "options")   return <OptionsExplorer data={result} />;
  return <PermitRoadmap data={result} projectDescription={projectDescription} />;
}

function situationToCanvas(sit: Situation | null) {
  if (sit === "applying") return "checklist";
  if (sit === "waiting")  return "status";
  return "verdict"; // planning
}
```

---

### Phase 3 — Build Components (35 min total, ~7 min each)

All components go in `packages/web/app/components/`.

---

#### 3a. `PermitVerdictCard.tsx` (~7 min) — PRIORITY 1

**Purpose:** Planning mode result. Green/amber/red headline verdict with plain-English explanation.

**Props:**
```typescript
interface VerdictData {
  verdict?: { level: "green" | "amber" | "red"; headline: string; reason: string; what_changes_everything: string }
  permits_needed?: PermitNeeded[]
  estimated_timeline?: string
  estimated_cost_range?: string
  tips?: string[]
}
```

**UI sections:**
1. Verdict banner — full-width colored header (green=sage, amber=amber, red=rose/stone)
   - Large icon + headline in font-serif
   - `reason` as sub-text
2. "What changes everything" — amber callout box with warning icon
3. Permits needed — compact pill list
4. Timeline + cost in a 2-col row of stat cards
5. Tips as a borderless list
6. Disclaimer footer (reuse from PermitRoadmap)

**Color mapping:**
- green → `bg-sage-500` header, `bg-sage-50` body
- amber → `bg-amber-500` header, `bg-amber-100` body
- red → `bg-stone-700` header, `bg-stone-100` body (no red in palette, use dark stone)

---

#### 3b. `PersonalizedChecklist.tsx` (~7 min) — PRIORITY 2

**Purpose:** Applying mode result. Expandable checklist items with rich detail per item.

**Props:**
```typescript
interface ChecklistItem {
  id: string
  title: string
  why: string
  howTo: string
  timeToGet: string
  cost: string
  commonMistake: string
  link?: string
  warning?: string  // amber callout if present
}

interface ChecklistData {
  checklist?: { items: ChecklistItem[] }
  // fallback: derive from existing process_steps + forms_required
  process_steps?: string[]
  forms_required?: FormRequired[]
  tips?: string[]
}
```

**UI:**
1. Header — "Your permit checklist" with count badge
2. Each item = expandable accordion row:
   - Collapsed: checkbox circle + title + `timeToGet` + `cost` on right
   - Expanded: why, howTo, commonMistake (amber warning callout), optional link
3. Warning items (`warning` field) get amber left-border accent
4. Progress bar at top: `X of N completed` (local state, checkbox click)

**Accordion state:** `useState<Set<string>>` for open item IDs. No library needed.

---

#### 3c. `StatusTracker.tsx` (~7 min) — PRIORITY 3

**Purpose:** Waiting mode. Permit number input + status display + workflow steps.

**Props:**
```typescript
interface StatusData {
  status?: {
    permit_number?: string
    plain_english_status: string
    stage_description: string
    next_step: string
    workflow_steps: Array<{ label: string; status: "done" | "active" | "pending" }>
  }
  // fallback: use analysis or note field
  analysis?: string
  note?: string
}
```

**UI:**
1. Permit lookup input (pre-filled from address if user typed a permit number)
   - "Look up" button → calls `/api/search` with the permit number
2. Status pill — large badge showing `plain_english_status` (green=done/issued, amber=in-review, stone=pending)
3. `stage_description` paragraph
4. Workflow stepper — vertical timeline:
   - done: sage filled circle + checkmark
   - active: sage ring with pulse dot
   - pending: stone empty circle
5. "Your next step" amber callout at bottom

**Note:** For demo, the status data comes from the AI response. The lookup button can optionally hit `/api/search` but is not required for the initial demo — the AI-generated status from the chat conversation is sufficient.

---

#### 3d. `PropertyCard.tsx` (~7 min) — PRIORITY 4

**Purpose:** Show property context cards at top of any planning result.

**Props:**
```typescript
interface PropertyData {
  property?: {
    address: string
    zone_code: string
    zone_plain_english: string
    overlays: string[]  // ["Coastal", "Historic", "Airport", "Fire"]
    lot_size_sqft?: number
    apn?: string
    past_permits?: Array<{ number: string; type: string; year: number; status: string }>
  }
}
```

**UI:**
- Compact card, horizontally laid out (not full-height)
- Left: address + zone code with plain-English translation below
- Right: overlay badges (each a colored pill — Coastal=blue-ish/stone, Historic=amber, Airport=stone-600, Fire=red-ish/amber-700)
- Bottom row: lot size + APN in stat boxes
- Collapsible "Past permits" section (accordion)
- Renders as a stacked card above `PermitVerdictCard` when `canvas === "property"` OR when a property object exists in any result

**Note:** `PropertyCard` is companion card, not standalone canvas. It renders above `PermitVerdictCard` when property data is present. CanvasRouter checks `result.property` and prepends it.

---

#### 3e. `OptionsExplorer.tsx` (~7 min) — PRIORITY 5

**Purpose:** ADU type toggles + size slider with real-time fee estimates.

**Props:**
```typescript
interface OptionsData {
  options?: {
    adu_types: Array<{ id: string; label: string; description: string; pros: string[]; cons: string[] }>
    default_type?: string
    size_range?: { min: number; max: number; default: number }
  }
}
```

**UI:**
1. ADU type toggle group — 4 cards in 2×2 grid:
   - Detached / Attached / Garage Conversion / JADU
   - Active: sage border + bg
2. Size slider — `input[type=range]` from 150 to 1200 sqft
3. Live fee estimate panel (updates on slider change):
   - < 500 sqft: "No school fees" badge
   - < 750 sqft: "No impact fees" badge
   - > 750 sqft: Show estimated fee calculation
   - These thresholds are hard-coded SD rules — no API call needed
4. Selected config summary at bottom

**Fee logic (hard-coded SD rules):**
```
under 500: school_fees = $0, impact_fees = $0
500–750:   school_fees = ~$4.79/sqft, impact_fees = $0
over 750:  school_fees = ~$4.79/sqft, impact_fees = ~$12K–$18K
```

---

### Phase 4 — Restyle /search and /code (if time permits)

Low priority. These pages work. Only restyle if Phase 1–3 complete.

- Replace blue button classes with `bg-sage-500 hover:bg-sage-600`
- Replace `border-blue-*` with `border-sage-*`
- Replace `text-blue-*` with `text-sage-*`
- Cards: `rounded-[14px] border border-stone-200`

---

## Acceptance Criteria

- [ ] `/api/navigate` returns `canvas` field in all responses (AI + fallback paths)
- [ ] `page.tsx` renders correct component based on `canvas` discriminator
- [ ] `PermitVerdictCard` renders with green/amber/red verdict for planning queries
- [ ] `PersonalizedChecklist` renders expandable items with expand/collapse for applying queries
- [ ] `StatusTracker` renders workflow stepper for waiting queries
- [ ] `PropertyCard` renders as companion card when property data present
- [ ] `OptionsExplorer` renders ADU toggles + size slider with live fee thresholds
- [ ] No TypeScript errors
- [ ] All components follow design rules: Lora headings, DM Sans body, sage/stone/amber only

---

## Demo Flow (What Judges Will See)

1. User picks "Planning" + "ADU" → types address + example question → submit
2. AI Q&A phase (QuestionsForm) → user answers 3 questions
3. Canvas switches to **PropertyCard** (zone/overlays) stacked above **PermitVerdictCard** (green verdict: "You can build a detached ADU on this lot")
4. User asks follow-up in chat about size → canvas switches to **OptionsExplorer** (live fee calculator)
5. User changes mode to "Applying" → **PersonalizedChecklist** with 8 checklist items
6. User changes mode to "Waiting" → **StatusTracker** with workflow stepper

---

## Files to Create/Modify

### New files:
- `packages/web/app/components/PermitVerdictCard.tsx`
- `packages/web/app/components/PersonalizedChecklist.tsx`
- `packages/web/app/components/StatusTracker.tsx`
- `packages/web/app/components/PropertyCard.tsx`
- `packages/web/app/components/OptionsExplorer.tsx`

### Modified files:
- `packages/web/app/api/navigate/route.ts` — add `canvas` + canvas-specific data to prompts + fallbacks
- `packages/web/app/page.tsx` — import new components, add CanvasRouter logic, update TypeScript types

---

## Design Rules Checklist (never break these)

- No jargon in UI copy — "Plan check" not "PENDNG-PLANCK"
- Sage = primary/active | Stone = neutral | Amber = warnings only
- Headings: `font-serif` (Lora) | Body: `font-sans` (DM Sans)
- Cards: `bg-white border border-stone-200 rounded-[14px]`
- Active states: `border-sage-500 bg-sage-50 shadow-[0_0_0_3px_oklch(58%_0.105_158_/_0.10)]`
- Buttons: `bg-sage-500 hover:bg-sage-600 text-white rounded-[10px]`
- Amber warnings: `bg-amber-100 border-amber-500 text-amber-700`
- Animations: use existing `animate-fade-in` from globals.css

---

## References

- Design system tokens: [`packages/web/app/globals.css`](packages/web/app/globals.css)
- Canvas rendering: [`packages/web/app/page.tsx:543-570`](packages/web/app/page.tsx#L543)
- Existing canvas components: [`packages/web/app/components/PermitRoadmap.tsx`](packages/web/app/components/PermitRoadmap.tsx), [`packages/web/app/components/QuestionsForm.tsx`](packages/web/app/components/QuestionsForm.tsx)
- API route: [`packages/web/app/api/navigate/route.ts`](packages/web/app/api/navigate/route.ts)
