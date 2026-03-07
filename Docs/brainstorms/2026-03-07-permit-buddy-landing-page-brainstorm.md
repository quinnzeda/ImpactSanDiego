# Permit Buddy — Landing Page & Entry Flow Brainstorm

**Date:** 2026-03-07
**Designer:** Quinn Zeda
**Context:** Claude Impact Lab Civic AI Hackathon — 6-hour build

---

## What We're Building

A fullscreen hero landing page that flows directly into the split-pane chat/canvas app. The landing page IS the entry point — no separate marketing page, no scroll sections. Users arrive, understand immediately, and get guided into their first message without ever staring at a blank prompt.

---

## The Core UX Problem

Generative UI lives or dies on the quality of the first input. If the user types "ADU" we get nothing useful. If they type "I want to convert my garage into a 500 sq ft ADU at 123 Maple St, San Diego" — we get everything we need.

The landing page's job is not to explain Permit Buddy. It's to extract a high-quality first message from the user before they even know what a prompt is.

---

## Key Decisions

### 1. CTA: Inline input in the hero (not a button)
The hero IS the app's entry point. No intermediate "click to start" step. The input field is present and ready the moment the page loads.

### 2. Landing page scope: Fullscreen hero only
No scrolling. No "How it works" section. No social proof below the fold. The entire viewport is the hero. Fast to build, focused for demo.

### 3. Category chips above the input
Six chips displayed above the input field:
- ADU
- Bathroom
- Solar
- Kitchen
- Deck
- Other

These tell the user what the tool is for without any copy. Clicking one does NOT submit — it reveals example prompts.

### 4. Example prompt reveal on chip click
Clicking "ADU" reveals 3-4 example prompt chips below the categories:
- "I want to add a detached backyard ADU"
- "Can I convert my garage into an ADU?"
- "I want to build an ADU above my garage"

User clicks an example → it fills the text input (editable). They can customize it or submit as-is. This is the key pattern: nobody starts from a blank page.

### 5. Submission transitions to the chat app
When the user submits, the landing hero hides and the split-pane chat/canvas UI appears with that message already sent as the first chat message.

### 6. Implementation: Single HTML file, JS state toggle
One file. Both landing state and app state exist in the DOM. A JS class toggle (`.app-mode` on `<body>`) switches visibility. The submitted text is passed directly to the chat panel — no URL encoding, no page reload, instant transition.

### 7. Canvas: explicit-action-only updates
The canvas panel only updates when Claude returns a tool call result — NOT automatically as the conversation progresses. This overrides the auto-advancing behavior in prototype-v7.

---

## Open Questions

- What are the 6 category chips exactly, and which 3-4 examples appear per category?
- Does the hero have a secondary line of copy below the headline (e.g. "For San Diego homeowners")?
- Should there be a subtle background (map texture, SD skyline) or pure clean white/dark?
- Does "Other" open the input with no pre-fill, or show a different prompt?
- Transition: instant hide/show, or a brief fade (CSS opacity transition, ~200ms)?

---

## Why This Approach

- **Reduces blank-page anxiety** — the most common failure mode for AI tools
- **Forces better input** — category → example → editable = structured first message
- **Fast to build** — one HTML file, no routing, prototype-v7 CSS already dialed in
- **Demo-friendly** — no scrolling, no loading, no transitions that can glitch
- **YAGNI** — a scrollable marketing page would take 2+ hours we don't have

---

## Next Step

Run `/workflows:plan` to turn this into a task list for building the HTML prototype.

Key files to reference:
- `prototype-v7.html` — source of truth for app UI styles and layout
- `Docs/PLAN.md` — full product spec and 5-station user journey
