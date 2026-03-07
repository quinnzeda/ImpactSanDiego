# Vercel AI SDK — Generative UI Research

Research compiled 2026-03-04 at 1:00 AM.

## Overview

The Vercel AI SDK provides two approaches for generative UI:

1. **AI SDK UI** (`useChat` + tools) — ✅ **RECOMMENDED** — production-ready, actively developed
2. **AI SDK RSC** (`streamUI`) — ⚠️ **PAUSED** — development paused, being migrated to UI approach

**We should use AI SDK UI (approach 1).**

## How Generative UI Works (AI SDK UI)

The core pattern: **LLM tool calls → React components**

1. Define tools on the server (AI SDK `tool()` with Zod schemas)
2. LLM decides to call a tool based on conversation context
3. Tool executes server-side, returns structured data
4. Client renders a React component for that tool's output
5. Components stream in real-time (loading → result states)

### Architecture

```
Client (Next.js App)          Server (API Route)
┌─────────────────┐          ┌──────────────────┐
│  useChat() hook  │ ──POST─→│  streamText()    │
│                  │          │  + tools: {      │
│  message.parts   │          │    lookupZoning, │
│  ├─ text         │←─stream──│    getPermits,   │
│  ├─ tool-*       │          │    checkOverlays │
│  └─ tool-*       │          │  }               │
└─────────────────┘          └──────────────────┘
```

### Key Concepts

**Message Parts:** Each message has a `parts` array with typed entries:
- `{ type: 'text', text: '...' }` — regular text
- `{ type: 'tool-displayWeather', state: 'input-available' | 'output-available' | 'output-error', ... }` — tool results

**Tool States:**
- `input-available` — tool is being called (show loading)
- `output-available` — tool returned data (show component)
- `output-error` — tool failed (show error)

## Implementation for Permit Buddy

### Step 1: Define Tools

```typescript
// ai/tools.ts
import { tool as createTool } from 'ai';
import { z } from 'zod';

export const lookupProperty = createTool({
  description: 'Look up property information by address in San Diego',
  inputSchema: z.object({
    address: z.string().describe('Street address in San Diego'),
  }),
  execute: async ({ address }) => {
    // 1. Geocode address via ArcGIS
    const geocodeUrl = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Accela_Locator/GeocodeServer/findAddressCandidates';
    const geocodeRes = await fetch(`${geocodeUrl}?SingleLine=${encodeURIComponent(address)}&f=json&outFields=*&maxLocations=1`);
    const geocodeData = await geocodeRes.json();
    const location = geocodeData.candidates?.[0]?.location;
    
    if (!location) return { error: 'Address not found' };
    
    // 2. Query parcel
    const parcelUrl = 'https://webmaps.sandiego.gov/arcgis/rest/services/GeocoderMerged/MapServer/1/query';
    const parcelParams = new URLSearchParams({
      geometry: JSON.stringify(location),
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'APN,OWN_NAME1,SITUS_ADDRESS,NUCLEUS_USE_CD,NUCLEUS_ZONE_CD',
      returnGeometry: false,
      f: 'json'
    });
    const parcelRes = await fetch(`${parcelUrl}?${parcelParams}`);
    const parcelData = await parcelRes.json();
    
    // 3. Query base zoning
    const zoningUrl = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0/query';
    const zoningParams = new URLSearchParams({
      geometry: JSON.stringify(location),
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: false,
      f: 'json'
    });
    const zoningRes = await fetch(`${zoningUrl}?${zoningParams}`);
    const zoningData = await zoningRes.json();
    
    // 4. Check overlays
    const overlayUrl = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Overlay/MapServer/identify';
    const overlayParams = new URLSearchParams({
      geometry: JSON.stringify(location),
      geometryType: 'esriGeometryPoint',
      sr: '2230',
      layers: 'all',
      tolerance: 3,
      mapExtent: `${location.x - 5000},${location.y - 5000},${location.x + 5000},${location.y + 5000}`,
      imageDisplay: '600,400,96',
      returnGeometry: false,
      f: 'json'
    });
    const overlayRes = await fetch(`${overlayUrl}?${overlayParams}`);
    const overlayData = await overlayRes.json();
    
    return {
      address: parcelData.features?.[0]?.attributes?.SITUS_ADDRESS,
      apn: parcelData.features?.[0]?.attributes?.APN,
      owner: parcelData.features?.[0]?.attributes?.OWN_NAME1,
      landUse: parcelData.features?.[0]?.attributes?.NUCLEUS_USE_CD,
      zoneCode: zoningData.features?.[0]?.attributes, // full zone attributes
      overlays: overlayData.results?.map(r => r.layerName) || [],
      location
    };
  },
});

export const generatePreflightCheck = createTool({
  description: 'Generate a pre-flight check for a permit application based on property data and project description',
  inputSchema: z.object({
    propertyData: z.any().describe('Property data from lookupProperty'),
    projectDescription: z.string().describe('What the user wants to build'),
  }),
  execute: async ({ propertyData, projectDescription }) => {
    // This would call Claude to analyze the data and generate flags
    // For hackathon, we can use Claude as an inner call or pre-compute
    return {
      flags: [
        { level: 'green', label: 'Zoning allows residential ADU', detail: '...' },
        { level: 'amber', label: 'Coastal overlay zone detected', detail: '...' },
        { level: 'red', label: 'Historic district review required', detail: '...' },
      ],
      checklist: [...],
      timeline: '...',
      fees: '...',
    };
  },
});

export const tools = {
  lookupProperty,
  generatePreflightCheck,
};
```

### Step 2: API Route

```typescript
// app/api/chat/route.ts
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { tools } from '@/ai/tools';

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are SD Permit Buddy, a friendly guide for San Diego building permits.
When a user provides an address, use the lookupProperty tool to get property data.
When they describe a project, use generatePreflightCheck to analyze requirements.
Translate all technical terms to plain English. No jargon.`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools,
  });

  return result.toUIMessageStreamResponse();
}
```

### Step 3: Client Components

```tsx
// components/PropertyCard.tsx
export function PropertyCard({ data }) {
  return (
    <div className="card">
      <h2>{data.address}</h2>
      <div className="grid">
        <div>
          <label>Zone</label>
          <span>{translateZone(data.zoneCode)}</span>
        </div>
        <div>
          <label>Lot Size</label>
          <span>{data.lotSize} sq ft</span>
        </div>
        <div>
          <label>Overlays</label>
          {data.overlays.map(o => <span className="badge">{o}</span>)}
        </div>
      </div>
    </div>
  );
}

// components/PreflightCheck.tsx
export function PreflightCheck({ flags, checklist, timeline, fees }) {
  return (
    <div className="preflight">
      <h2>🚦 Pre-Flight Check</h2>
      {flags.map(flag => (
        <div className={`flag flag-${flag.level}`}>
          <span className="indicator" />
          <strong>{flag.label}</strong>
          <p>{flag.detail}</p>
        </div>
      ))}
      {/* ... checklist, timeline, fees sections */}
    </div>
  );
}
```

### Step 4: Chat Page with Generative UI

```tsx
// app/page.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { PropertyCard } from '@/components/PropertyCard';
import { PreflightCheck } from '@/components/PreflightCheck';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat();

  return (
    <div className="split-layout">
      {/* Left: Chat */}
      <div className="chat-panel">
        {messages.map(message => (
          <div key={message.id}>
            {message.parts.map((part, i) => {
              if (part.type === 'text') return <p key={i}>{part.text}</p>;
              
              if (part.type === 'tool-lookupProperty') {
                if (part.state === 'input-available') return <Skeleton key={i} />;
                if (part.state === 'output-available') return <PropertyCard key={i} data={part.output} />;
              }
              
              if (part.type === 'tool-generatePreflightCheck') {
                if (part.state === 'input-available') return <Skeleton key={i} />;
                if (part.state === 'output-available') return <PreflightCheck key={i} {...part.output} />;
              }
              
              return null;
            })}
          </div>
        ))}
        <form onSubmit={e => { e.preventDefault(); sendMessage({ text: input }); setInput(''); }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter an address or describe your project..." />
        </form>
      </div>
      
      {/* Right: Canvas (persistent state from latest tool results) */}
      <div className="canvas-panel">
        {/* Render latest PropertyCard + PreflightCheck here */}
      </div>
    </div>
  );
}
```

## Chat + Canvas Architecture

For our split-view design (chat left, dashboard right):

1. **Chat panel** — standard `useChat()` with inline generative UI
2. **Canvas panel** — extract latest tool results from messages and render persistently
3. **Consent pattern** — when user asks a follow-up, Claude can suggest updating the canvas: "I found new info about setbacks. Update your dashboard?" → user clicks "Yes, update" → canvas re-renders

```tsx
// Extract latest results from messages for canvas
const latestProperty = messages
  .flatMap(m => m.parts)
  .filter(p => p.type === 'tool-lookupProperty' && p.state === 'output-available')
  .at(-1)?.output;

const latestPreflight = messages
  .flatMap(m => m.parts)
  .filter(p => p.type === 'tool-generatePreflightCheck' && p.state === 'output-available')
  .at(-1)?.output;
```

## Key Dependencies

```json
{
  "ai": "^5.0",
  "@ai-sdk/react": "^1.0",
  "@ai-sdk/anthropic": "^1.0",
  "zod": "^3.22",
  "next": "^15"
}
```

## AI SDK RSC (streamUI) — NOT Recommended

The RSC approach uses `streamUI()` which returns React Server Components directly. **Development is paused** and Vercel recommends migrating to the UI approach above.

Key difference: RSC streams actual React components from server → client. UI approach streams data and renders components client-side. UI approach is more flexible and better supported.

## Hackathon Day Plan

1. `npx create-next-app@latest permit-buddy --typescript --tailwind --app`
2. `npm install ai @ai-sdk/react @ai-sdk/anthropic zod`
3. Create tools wrapping ArcGIS REST endpoints
4. Create PropertyCard, PreflightCheck, Checklist components
5. Wire up `useChat()` with split-view layout
6. Add system prompt with SD permit knowledge
7. Deploy to Vercel for demo
