---
title: "feat: Wire property data display + verify canvas pipeline"
type: feat
date: 2026-03-07
deepened: 2026-03-07
---

# Wire Property Data Display + Verify Canvas Pipeline

## Enhancement Summary

**Deepened on:** 2026-03-07
**Research agents:** TypeScript type safety, edge case spec-flow, React state patterns, UX patterns

### Key Findings from Research

1. **`include_questions: false` is now set in page.tsx** — questions phase is bypassed entirely. All submits go directly to phase 2. The `property_preview`-in-questions-phase approach from the original plan is now moot.
2. **Phase 2 already populates `result.property`** via `mergePropertyData()` in route.ts when ArcGIS returns data. CanvasRouter already renders `<PropertyCard>` when `result.property` is non-null.
3. **The real remaining gaps** are TypeScript type issues, the `handleChatSend` path not clearing stale data, and build verification.
4. **ArcGIS layer paths** may silently 404 (as the team noted) — the fallback structure means the PropertyCard renders with only geocoded address data when parcel/zoning layers miss.

---

## Actual State After Code Modification

**What works today (after `include_questions: false` change):**
- Submit → always phase 2 → `result.property` populated if ArcGIS geocodes → `CanvasRouter` → `PropertyCard` ✓
- Canvas components (`PermitVerdictCard`, `PersonalizedChecklist`, `StatusTracker`, `OptionsExplorer`) all exist ✓
- `CanvasRouter` routes by `result.canvas` field ✓

**What still needs attention:**

### Gap 1: TypeScript strict mode issues

The TypeScript agent identified concrete issues that will cause build failures:

**A. `QuestionsData` interface missing `property_preview` field**

Even though questions are bypassed now, the interface still exists and `data.property_preview` access on the questions branch (`data.phase === "questions"`) would be a TypeScript error in strict mode. Either delete the dead branch or add the field.

**B. `PropertyCard.tsx` prop type mismatch**

`PropertyCard` accepts `property?: Record<string, unknown> | PropertyData` and then does `const p = property as PropertyData | undefined`. The inner `PastPermit` type shape differs from `PropertyLookupData`'s permit shape. This may cause type errors at call sites when passing the merged property data.

**C. `handleChatSend` stale data path**

If a chat follow-up somehow triggers a questions response (edge case since `include_questions` is not passed in chat), old `propertyPreview` state would persist. Not critical since the questions path is bypassed, but `setResult(null)` is called without clearing any property state.

### Gap 2: Build verification

The plan calls for `pnpm --filter @permitpal/web lint && pnpm --filter @permitpal/web build` to verify no TypeScript errors. This has not been run yet.

### Gap 3: ArcGIS data quality

The parcel/zoning service paths may 404. When they do, `data_sources` only contains `"ArcGIS Geocoder"` (just coordinates), and `result.property` only gets the formatted address — no zone_code, lot_size, APN. The `PropertyCard` `hasAnyData` check returns `false` (since `address` alone doesn't satisfy it per the component logic), so the card won't render. This means users with a valid address but failing ArcGIS layers see no property context.

**Mitigation already in place:** The card gracefully hides itself (`return null`). No crash. But the demo benefit is lost.

---

## Remaining Implementation Tasks

### Task A: Fix TypeScript issues in `page.tsx`

**File:** `packages/web/app/page.tsx`

The dead `if (data.phase === "questions")` branch in `handleSubmit` (line 208) should either be:
- Removed entirely (cleaner, since `include_questions: false` means it never fires), OR
- Left in place but the `QuestionsData` interface needs `property_preview?: unknown` added

Recommendation: Remove the dead branch (lines 208-210 of the current `if/else`) and simplify to always `setResult(data)`.

### Task B: Verify `PropertyCard` renders with geocode-only data

The `hasAnyData` check in `PropertyCard.tsx` (line 40-47) currently gates on:
```ts
p?.address || p?.zone_code || p?.zone_plain_english ||
(p?.overlays && p.overlays.length > 0) || p?.lot_size_sqft || p?.apn ||
(p?.past_permits && p.past_permits.length > 0)
```

`address` IS in this check. So if ArcGIS geocodes successfully (which always happens when an address is provided), `result.property.address` will be set and the card will render — at minimum showing the formatted address. This is fine behavior.

**No change needed** — the guard already handles geocode-only data correctly.

### Task C: Run build verification

```bash
cd /Users/quinnzeda/Desktop/Development/Impact-Lab-SD
pnpm --filter @permitpal/web lint
pnpm --filter @permitpal/web build
```

Fix any TypeScript errors found.

---

## Technical Approach

### Files to modify

- `packages/web/app/page.tsx` — remove dead questions branch, clean up imports if QuestionsForm no longer renders

### Files to verify (no changes expected)

- `packages/web/app/api/navigate/route.ts` — phase 2 merges real property data ✓
- `packages/web/app/components/PropertyCard.tsx` — renders when address present ✓
- `packages/web/app/components/PermitVerdictCard.tsx` — renders verdict ✓
- `packages/web/app/components/PersonalizedChecklist.tsx` — renders checklist ✓
- `packages/web/app/components/StatusTracker.tsx` — renders status ✓
- `packages/web/app/components/OptionsExplorer.tsx` — renders ADU options ✓

### Dead code cleanup (optional, do if build fails)

Remove unused imports (`QuestionsForm`) and unused state (`questions`, `handleAnswersSubmit`, `handleSkipQuestions`) if the questions path is permanently disabled. Only do this if TypeScript complains — do not over-refactor.

---

## Research Insights

### React state management (from research agent)

**React 19 batching:** All `setState` calls within an event handler are automatically batched in React 19, even across async boundaries when called inside `startTransition` or concurrent features. The multiple `setState` calls in `handleSubmit` (setModeTag, setMessages, setAppMode, setLoading, setResult) are all batched correctly.

**Pattern for derived companion data:** The correct pattern for non-critical companion data that arrives with the primary response is to extract it into co-located state at the same time the primary state is set. This is what the plan does.

### TypeScript best practices (from TS agent)

**Preferred state type:** `Record<string, unknown> | null` is acceptable since `PropertyCard` already accepts `Record<string, unknown>`. Stricter typing (`PropertyLookupData | null`) would require a type guard on the `res.json()` response.

**`res.json()` returns `any`:** This bypasses strict mode checks. The minimal fix is narrowing immediately: `const data: unknown = await res.json()` forces explicit guards before use.

**`QuestionsData` interface:** If the dead branch is kept, add `property_preview?: Record<string, unknown>` to avoid strict mode errors on `data.property_preview` access.

### UX patterns (from research agent)

**Companion card placement:** Property context card should appear at the top of the canvas panel, above the primary result card. This matches the existing `CanvasRouter` implementation which renders `<PropertyCard>` first, then the primary card.

**Loading state:** The `propertyPreview` / `result.property` card should not be visible during the loading spinner. The current implementation correctly gates on `!loading && result`, so the PropertyCard only appears after the full response arrives.

**Reliability badges:** The existing `RELIABILITY_STYLES` in `PropertyCard.tsx` correctly handles `live`, `ai`, and `fallback` sources with appropriate color coding.

---

## Acceptance Criteria

- [ ] Enter address + prompt and submit → `PropertyCard` appears in canvas panel showing address, and zone/lot data if ArcGIS layers respond
- [ ] No `PropertyCard` rendered when no address is entered
- [ ] All canvas types render correctly: verdict (planning), checklist (applying), status (waiting), options (ADU with size intent)
- [ ] `pnpm --filter @permitpal/web lint` passes with 0 new errors
- [ ] `pnpm --filter @permitpal/web build` passes with 0 TypeScript errors
- [ ] Chat follow-ups render updated canvas content without stale data

## Demo Script Verification

1. Select **Planning + ADU**, enter address → property card + verdict card
2. Select **Applying + ADU** → checklist card
3. Select **Waiting** → status tracker
4. Follow-up chat → updated canvas content

---

## References

- `packages/web/app/page.tsx` — main frontend (questions flow bypassed via `include_questions: false`)
- `packages/web/app/api/navigate/route.ts:175-183` — `mergePropertyData` into `parsed.property`
- `packages/web/app/components/PropertyCard.tsx:40-47` — `hasAnyData` guard
- `packages/web/app/components/CanvasRouter` (inline in page.tsx:597-680) — routing logic
- `packages/web/app/api/property-lookup/route.ts` — ArcGIS + Socrata integration
