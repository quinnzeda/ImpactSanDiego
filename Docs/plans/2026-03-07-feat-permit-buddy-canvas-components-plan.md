---
title: "feat: Permit Buddy Canvas Components + Demo Routing (1-hour scope)"
type: feat
date: 2026-03-07
---

# Permit Buddy Canvas Components + Demo Routing Implementation Plan

> **For Claude/Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Ship a demo-stable canvas experience in ~1 hour with one rich ADU flow and reliable lite coverage for all categories/modes.

**Architecture:** Keep `POST /api/navigate` as the only orchestrator for this pass. Add `situation` and `category` to requests, and return a `canvas` discriminator plus structured card payloads and reliability metadata. Frontend routes to new components via `CanvasRouter` and always has safe fallback to `PermitRoadmap`.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, existing Tailwind/token system, Anthropic SDK, existing `/api/search-live` endpoint for optional status refresh.

---

## Locked Product Decisions (Do Not Re-Decide During Implementation)

1. **Scope:** Deep ADU flow + lite all-category support.
2. **Reliability posture:** Live when available, otherwise explicit `ai` or `fallback` labels.
3. **Integration path:** Extend existing `/api/navigate`; do not migrate to `/api/chat` or MCP runtime integration in this pass.
4. **Property card strategy:** Structured fallback first; partially populated card is acceptable if labeled.
5. **Demo mode switching:** User can switch modes by going back to landing and re-submitting. No in-app mode switcher in this pass.

---

## Public Interface Changes

### `/api/navigate` request additions

```ts
{
  project_description: string;
  property_address?: string;
  include_questions?: boolean;
  answers?: Record<string, string>;
  situation?: "planning" | "applying" | "waiting";
  category?: "adu" | "kitchen-bath" | "room-addition" | "solar" | "deck-fence";
}
```

### `/api/navigate` non-question response additions

```ts
{
  canvas: "verdict" | "checklist" | "status" | "options" | "roadmap";
  reliability: { source: "live" | "ai" | "fallback"; notes: string[] };

  verdict?: {
    level: "green" | "amber" | "red";
    headline: string;
    reason: string;
    what_changes_everything?: string;
  };

  checklist?: { items: ChecklistItem[] };
  status?: {
    permit_number?: string;
    plain_english_status: string;
    stage_description?: string;
    next_step?: string;
    workflow_steps?: Array<{ label: string; status: "done" | "active" | "pending" }>;
  };
  property?: {
    address?: string;
    zone_code?: string;
    zone_plain_english?: string;
    overlays?: string[];
    lot_size_sqft?: number;
    apn?: string;
    past_permits?: Array<{ number: string; type: string; year?: number; status?: string }>;
  };
  options?: {
    adu_types: Array<{ id: string; label: string; description: string; pros?: string[]; cons?: string[] }>;
    default_type?: string;
    size_range?: { min: number; max: number; default: number };
  };
}
```

---

## Task 1: Add Backend Canvas Contract + Deterministic Routing

**Files:**
- Modify: `packages/web/app/api/navigate/route.ts`

**Step 1: Extend request parsing**

Add `situation` and `category` to body destructuring and ensure all existing paths remain backwards compatible when absent.

**Step 2: Update AI prompt output contract**

In the phase-2 roadmap prompt, request:
- `canvas` in `verdict | checklist | status | options | roadmap`
- corresponding structured objects (`verdict`, `checklist`, `status`, `property`, `options`)
- `reliability` field with `source` and `notes`

**Step 3: Add deterministic fallback canvas selector**

Implement a helper with this precedence:
1. `situation === "waiting"` -> `status`
2. `situation === "applying"` -> `checklist`
3. `situation === "planning"` + ADU options intent -> `options`
4. `situation === "planning"` -> `verdict`
5. fallback -> `roadmap`

ADU options intent = category is `adu` and description contains terms like `size`, `sqft`, `detached`, `attached`, `garage`, `jadu`, `option`.

**Step 4: Populate structured fallback payloads**

Ensure fallback response includes:
- `canvas`
- `reliability: { source: "fallback", notes: [...] }`
- minimal usable data for relevant card object(s)
- existing roadmap fields retained for legacy rendering compatibility

**Step 5: Reliability source behavior**

- Parsed AI JSON => `source: "ai"`
- Rule fallback => `source: "fallback"`
- Do not mark `live` inside `/api/navigate` in this pass

---

## Task 2: Wire Frontend Requests + CanvasRouter

**Files:**
- Modify: `packages/web/app/page.tsx`

**Step 1: Send situation/category in all navigate requests**

Update payloads in:
- `handleSubmit`
- `handleAnswersSubmit`
- `handleSkipQuestions`
- `handleChatSend`

Use `activeSituation` and `activeCategory` when available.

**Step 2: Add new imports and render switch**

Import:
- `PermitVerdictCard`
- `PersonalizedChecklist`
- `StatusTracker`
- `PropertyCard`
- `OptionsExplorer`

Replace the current result rendering block with a `CanvasRouter`.

**Step 3: Implement CanvasRouter precedence**

1. If `result.property` exists, render `<PropertyCard />` companion first.
2. Primary card by `result.canvas`.
3. Fallback by `activeSituation` mapping:
   - planning -> verdict
   - applying -> checklist
   - waiting -> status
4. Final fallback -> `<PermitRoadmap />`.

**Step 4: Keep current question flow untouched**

`QuestionsForm` stays first-class for `phase: "questions"`; router applies only to non-question result payloads.

---

## Task 3: Build Canvas Components (Demo-Ready, Tolerant to Partial Data)

**Files:**
- Create: `packages/web/app/components/PermitVerdictCard.tsx`
- Create: `packages/web/app/components/PersonalizedChecklist.tsx`
- Create: `packages/web/app/components/StatusTracker.tsx`
- Create: `packages/web/app/components/PropertyCard.tsx`
- Create: `packages/web/app/components/OptionsExplorer.tsx`

**Shared requirements for all components**

- Accept partial data and render meaningful fallback copy.
- Display reliability badge (`Live`, `AI`, `Fallback`) with note text if provided.
- Use existing design tokens (`sage/stone/amber`, `font-serif` headings).
- Do not crash if object branches are missing.

**Component-specific behavior**

- `PermitVerdictCard`: verdict banner, reason, what-changes-everything, timeline/cost highlights.
- `PersonalizedChecklist`: expandable rows + local progress state.
- `StatusTracker`: workflow stepper + optional “Refresh from live records”.
  - Live refresh call: `/api/search-live?query=<permit_or_address>&limit=5`
  - On success, show a local live status summary and mark UI as `live`.
  - On failure/no results, keep prior data and show non-blocking note.
- `PropertyCard`: companion card with zone/overlays/APN/lot/past permits (when available).
- `OptionsExplorer`: ADU type selector + size slider + threshold-based fee hints.

---

## Task 4: Acceptance Verification

**Files:**
- No new files required

**Step 1: Static verification**

Run:

```bash
pnpm --filter @permitpal/web lint
pnpm --filter @permitpal/web build
```

Expected:
- Lint passes with no new errors
- Build succeeds with no TypeScript errors

**Step 2: Manual demo checks**

1. Planning + ADU + initial prompt -> questions -> verdict card + property companion.
2. Planning + ADU + follow-up about size/options -> `OptionsExplorer`.
3. Applying + any category -> checklist card with expand/collapse.
4. Waiting + permit/address query -> status tracker with stepper.
5. Missing `ANTHROPIC_API_KEY` -> app still works with explicit fallback labels.
6. Unknown/missing `canvas` -> safe fallback to `PermitRoadmap`.
7. Status live refresh never blocks the canvas; errors are shown as informative notes only.

---

## Non-Goals for This Plan

- No MCP runtime-to-web integration.
- No migration to `useChat`/`streamText` tool rendering.
- No `/search` or `/code` restyle.
- No full legacy v7 station-by-station orchestration parity.

---

## Demo Script (Judge-Facing)

1. Select **Planning + ADU**, enter address, ask “Can I build a detached ADU?”
2. Answer clarifying questions.
3. Show verdict + property context companion.
4. Ask follow-up: “What if I keep it under 500 sqft?” -> options/calculator card.
5. Switch to **Applying** (back to landing, re-submit) -> checklist.
6. Switch to **Waiting** -> status tracker and optional live refresh.

---

## References

- `packages/web/app/page.tsx`
- `packages/web/app/api/navigate/route.ts`
- `packages/web/app/components/PermitRoadmap.tsx`
- `packages/web/app/components/QuestionsForm.tsx`
- `docs/legacy-prototype-v7.html`
