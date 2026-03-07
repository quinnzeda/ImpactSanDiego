# Generative UI Frameworks — CopilotKit vs Tambo vs Vercel AI SDK

**Researched:** 2026-03-03  
**Purpose:** Evaluate frameworks for Permit Buddy's chat+canvas architecture

---

## TL;DR for Permit Buddy

| Framework | Verdict | Reason |
|-----------|---------|--------|
| **Vercel AI SDK** | ✅ Recommended for hackathon | Fastest to working demo, useChat + tool calls = our architecture exactly |
| **Tambo** | 🔥 Strong alternative | Cleanest model for our component registry pattern (PropertyCard, PreflightDash, etc.) |
| **CopilotKit** | 👀 Watch for v2 features | Most mature, but heavier setup; worth using if we want multi-agent later |
| **assistant-ui** | ✅ Layer on top of Vercel AI SDK | Pre-built chat UI primitives, faster than building from scratch |

---

## 1. Vercel AI SDK (ai-sdk.dev)

**Stars:** 20,700+ | **Downloads:** 20M+/month

### What it is
TypeScript toolkit for AI apps. Provider-agnostic (OpenAI, Anthropic, 50+). The de facto standard for Next.js AI applications.

### Key for us
- `useChat` hook + tool invocations is the **recommended generative UI pattern** (RSC/streamUI is paused)
- Pattern: LLM calls a tool → tool result maps to a React component → renders in chat or canvas
- Works perfectly for: `show_property_card`, `show_preflight_check`, `show_document_checklist`, `show_fee_breakdown`

### Code pattern for Permit Buddy
```tsx
// Server: define tools with Zod schemas
const tools = {
  show_property_card: {
    description: "Display property details for an address",
    parameters: z.object({
      address: z.string(),
      zone: z.string(),
      lot_size: z.number(),
      // ...
    })
  },
  show_preflight_check: {
    description: "Show pre-flight check results with red/amber/green flags",
    parameters: z.object({
      flags: z.array(z.object({
        severity: z.enum(['red', 'amber', 'green']),
        title: z.string(),
        detail: z.string()
      }))
    })
  }
}

// Client: map tool calls to components
{messages.map(m => (
  m.toolInvocations?.map(tool => {
    if (tool.toolName === 'show_property_card') return <PropertyCard {...tool.args} />
    if (tool.toolName === 'show_preflight_check') return <PreflightDashboard {...tool.args} />
  })
))}
```

### Limitations
- RSC (React Server Components) streaming is **paused** — use client-side `useChat` instead
- Less opinionated about UI than CopilotKit — we build our own components (fine for us)

### Setup time estimate
30-45 min to working chat + tool-invocation generative UI in Next.js.

---

## 2. Tambo (@tambo-ai/react)

**GitHub:** github.com/tambo-ai/tambo  
**Docs:** docs.tambo.co

### What it is
Generative UI toolkit with **component registry pattern**. You register components with Zod schemas; the agent picks the right component and streams props. Two modes:
- **Generative:** rendered once (charts, summaries, preflight results)  
- **Interactable:** persists and updates by ID (the canvas that updates when chat asks to)

### Key hooks
```tsx
const { messages } = useTambo();
const { value, setValue, submit, isPending } = useTamboThreadInput();
// message.renderedComponent ← the auto-rendered component for that message
```

### Why it fits Permit Buddy perfectly
Our architecture is *exactly* the component registry model:
- Chat generates → PropertyCard, PreflightDash, DocumentChecklist, FeeBreakdown, TrapAlerts
- Canvas updates → Interactable components that persist and update per consent

### MCP integration built in
```tsx
<TamboProvider
  components={components}
  mcpServers={[{ name: "sd-city", url: "http://localhost:3001/mcp", transport: MCPTransport.HTTP }]}
>
```
This is huge — Tambo + MCP = we get the MCP server wired to the generative UI with minimal glue code.

### Pre-built component library
https://ui.tambo.co — install via CLI. Not as mature as shadcn but usable.

### Limitations
- Newer/smaller ecosystem than Vercel AI SDK
- Requires Tambo API key (has cloud backend) or self-host
- Less community resources / examples vs Vercel

### Setup time estimate
45-60 min. Slightly more setup than Vercel AI SDK but the Interactable component pattern saves time building the consent-gated canvas update mechanic.

---

## 3. CopilotKit

**Stars:** 22,300+ | **Developers:** 100,000+ | **Fortune 500:** 10%+

### What it is
The most mature agentic application framework. Created **AG-UI** (Agent-User Interaction Protocol). Multi-agent orchestration, real-time state streaming.

### Key capabilities
- `useCopilotReadable` — share app state with AI (e.g., current property, current project intent)
- `useCopilotAction` — define AI-triggerable actions with custom render components
- `CopilotPopup` / `CopilotSidebar` / `CopilotChat` — out-of-box chat UI options
- **CoAgents** — multi-agent orchestration (overkill for hackathon)
- **MCP Integration** — built-in MCP support
- **A2UI** — launch partner with Google for cross-platform declarative UI

### Code pattern
```tsx
useCopilotAction({
  name: "show_preflight_check",
  description: "Generate pre-flight check for address + project",
  parameters: [
    { name: "address", type: "string", required: true },
    { name: "flags", type: "object[]", required: true }
  ],
  handler: async ({ address, flags }) => {
    setCurrentResults({ address, flags });
  },
  render: ({ status, args }) => (
    <PreflightDashboard loading={status === 'executing'} {...args} />
  )
});
```

### Why it's powerful for us
- `useCopilotReadable` is perfect for giving Claude context: "The user is looking at 1234 Main St, RM-2-4 zone, they want to add a 600sqft ADU"
- The consent-before-update pattern fits naturally: action handler checks consent, updates canvas only on approval

### Limitations
- Heavier than Vercel AI SDK / Tambo for a hackathon
- Requires CopilotKit cloud public key (they have a free tier, but it's a dependency)
- More opinionated architecture — can feel like it's fighting you if you have strong UI opinions

### Setup time estimate
60-90 min for full integration. Worth it for a production app; risky for a 1-day hackathon if hitting auth/config issues.

---

## 4. assistant-ui (Bonus Layer)

**Stars:** 7,900+ | **Downloads:** 50k+/month | **YC W25**

Works on **top of** Vercel AI SDK — gives you production-ready chat primitives (Thread, Message, streaming, auto-scroll, retries, markdown) without building them yourself.

```bash
npx assistant-ui create my-permit-buddy
```

Recommended stack: **Vercel AI SDK** (runtime) + **assistant-ui** (chat component layer) + **our custom components** (PropertyCard, PreflightDash, etc.)

---

## Framework Comparison Matrix

| | Vercel AI SDK | Tambo | CopilotKit |
|---|---|---|---|
| **Setup complexity** | Low | Medium | Medium-High |
| **Hackathon-safe** | ✅ Yes | ✅ Yes | ⚠️ Risky |
| **MCP support** | Via custom tool | ✅ Built-in | ✅ Built-in |
| **Component registry** | DIY | ✅ Native | Via actions |
| **Interactable canvas** | DIY | ✅ Native | Via state |
| **Consent gating** | DIY | DIY | Via `needsApproval` |
| **Provider agnostic** | ✅ Yes (Claude direct) | Partial | Partial |
| **Free tier** | ✅ Fully free | Tambo Cloud or self-host | Free tier with limits |
| **Community/docs** | 🔥 Best | Good | Very good |

---

## Recommendation for Permit Buddy Hackathon

**Option A (Safest, fastest demo):**  
Vercel AI SDK + assistant-ui + custom components  
- 30 min to working app, rest of time on real data + polish  
- `useChat` + tool invocations = property card, preflight dash, all generative

**Option B (Best architecture fit):**  
Tambo + MCP server  
- Component registry is our exact mental model  
- Built-in MCP wiring saves custom glue code  
- Interactable components = consent-gated canvas updates, built-in  
- Risk: newer SDK, less hackathon examples to copy from

**Don't try both** — pick one and commit. If going solo: Vercel AI SDK. If going with a teammate who handles infra: Tambo.

---

## Generative UI Production Examples (Real Apps)

These are worth knowing for the pitch:

1. **Thomson Reuters CoCounsel** — built with Vercel AI SDK, 3 devs, 2 months, serves 1,300 accounting firms
2. **Canva Support Agent** — OpenAI ChatKit, deployed in under an hour per their quote
3. **Google Gemini (dynamic view)** — A2UI-based generative components inside the Gemini app
4. **Duolingo Max** — AI adapts lesson UI in real time, difficulty and hints generated per session
5. **Stack AI / LangChain** — assistant-ui in production for enterprise AI workflows
6. **Thesys/Crayon** — 300+ teams using C1 API for data visualization dashboards generated from conversation

The civic/government category has almost no examples — this is a white space and a pitch point.

---

## What's Dead / Avoid

- **Vercel AI SDK RSC (React Server Components)** — development is **paused** as of 2025. Don't use `streamUI` or `createStreamableUI`. Use `useChat` + tool invocations instead.
- **Generating raw HTML at runtime** — security nightmare, don't do it
- **Binding MCP servers to 0.0.0.0** — security issue (NeighborJack vulnerability)
