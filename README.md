# PermitPal SD

**AI-powered San Diego Building Permit Navigator**

> Built for the Claude Community x City of San Diego Impact Lab Hackathon (March 7, 2026)

## Problem

San Diego's building permit process is opaque and complex. Residents and developers waste hours navigating 45+ permit types, exemptions, municipal code sections, and required forms across multiple disconnected city websites. There's no single tool that answers: **"I want to do X to my property - what permits do I need?"**

## Solution

PermitPal SD provides two access points to demystify the permit process:

1. **MCP Server** (12 tools) - Claude Code/Desktop users can query SD permit data conversationally
2. **Next.js Web App** - Interactive UI with AI-powered Q&A flow for precise permit roadmaps

## Features

- **AI Permit Navigator with Q&A**: Describe your project, answer targeted clarifying questions, and get a refined permit roadmap with required permits, forms, steps, timeline, and tips
- **Multi-Source Permit Search**: Search 490K+ records across City (256K+ via CSV) and County (236K+ via live Socrata API) databases
- **Live API Integration**: Real-time permit data from SD County Socrata API with full-text search, contractor info, and geo-coordinates
- **Municipal Code Lookup**: Browse 10 key building code sections with expandable details
- **Exemption Checker**: Check if your project qualifies for permit exemption under §129.0203
- **Skills-Based Knowledge**: Modular domain expertise organized as skill files (permits, ADU, solar) following CrossBeam architecture patterns
- **Property Zoning Lookup**: Look up zoning designation, overlays, and parcel data for any SD address via ArcGIS
- **Project Cost Estimator**: Get itemized cost breakdowns for home improvement projects with SD market data
- **Permit Detail Lookup**: Look up specific City of San Diego permits by record ID or address

## Data Sources

| Source | Type | Records | Access |
|--------|------|---------|--------|
| [SD City Open Data Portal](https://seshat.datasd.org) | CSV bulk download | 256K+ | No auth |
| [SD County Socrata API](https://data.sandiegocounty.gov/resource/dyzh-7eat.json) | Live REST API | 236K+ | No auth |
| [SD ArcGIS Services](https://webmaps.sandiego.gov/arcgis/rest/services/DSD) | Zoning/parcel GIS | Real-time | No auth |
| [Accela Civic Platform](https://developer.accela.com) | City permit system | Real-time | App ID |
| San Diego Municipal Code | Curated sections | 10 key sections | Local JSON |
| SD Development Services | Curated knowledge | 13 permit types, 11 FAQs | Local JSON |

## Architecture

```
permitpal-sd/
├── packages/
│   ├── mcp-server/           # MCP Server (TypeScript) - 12 tools
│   │   ├── src/
│   │   │   ├── index.ts      # Server entry + all tool registrations
│   │   │   ├── tools/        # Tool implementations
│   │   │   └── data/         # Data loaders (CSV, Socrata, OpenDSD)
│   │   └── skills/           # Skills-based knowledge (CrossBeam pattern)
│   │       ├── san-diego-permits/   # General permit skill + references
│   │       ├── san-diego-adu/       # ADU-specific skill
│   │       └── san-diego-solar/     # Solar permit skill
│   └── web/                  # Next.js App (React)
│       └── app/
│           ├── page.tsx              # Navigator with Q&A flow
│           ├── search/page.tsx       # Dual-source permit search
│           ├── code/page.tsx         # Municipal code browser
│           ├── components/           # PermitRoadmap, QuestionsForm
│           ├── api/navigate/         # AI navigator with Q&A support
│           ├── api/search/           # City CSV search
│           ├── api/search-live/      # County Socrata live search
│           └── api/code/             # Municipal code API
├── data/                     # Curated knowledge base (JSON)
└── scripts/                  # Data fetch utilities
```

## MCP Server Tools (12 total)

| Tool | Description | Data Source |
|------|-------------|-------------|
| `search_permits` | Search City permit records by address/type/status | Accela API / CSV fallback |
| `search_county_permits` | Live search County permits with full-text search | Socrata API (236K+) |
| `navigate_permits` | AI-powered permit roadmap with optional Q&A flow | Claude API + knowledge base |
| `lookup_code` | Search municipal code sections | Curated JSON |
| `check_exemption` | Check permit exemption eligibility (§129.0203) | Rules engine |
| `get_permit_stats` | City permit analytics and trends | City CSV |
| `get_county_permit_stats` | Real-time County permit analytics | Socrata API |
| `lookup_permit_detail` | Look up specific City permits by ID or address | Accela API / CSV fallback |
| `search_addresses` | Validate addresses and get location metadata | Accela API |
| `search_parcels` | Search parcel data by APN, owner, or address | Accela API |
| `lookup_property_zoning` | Look up zoning, overlays, and parcel data for an address | SD ArcGIS |
| `estimate_project_cost` | Itemized cost estimate for home improvement projects | SD market data |

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm

### Install & Run

```bash
# Install dependencies
pnpm install

# Build everything
pnpm build

# Run web app
pnpm dev:web
```

### Use with Claude Code

```bash
# Add the MCP server
claude mcp add permitpal -- node /path/to/permitpal-sd/packages/mcp-server/dist/index.js

# Then ask Claude:
# "What permits do I need to build an ADU in San Diego?"
# "Search County permits for solar installations in Escondido"
# "What's the zoning for 4225 Park Blvd, San Diego?"
# "How much would it cost to build an ADU?"
# "What are the permit exemptions in San Diego?"
```

### Environment Variables

```bash
# Optional: Enable AI-powered navigation (recommended)
ANTHROPIC_API_KEY=your-api-key
```

Without an API key, the navigator uses rule-based fallback logic with Q&A support for common project types (ADUs, solar, remodels, water heaters, fences, garage conversions).

## Key Enhancements (v2)

Inspired by the [Accela API](https://developer.accela.com/docs/api_reference/api-index.html) (San Diego's production permit system) and [CrossBeam](https://github.com/mikeOnBreeze/cc-crossbeam) (Anthropic hackathon winner):

1. **Live API Integration**: Added SD County Socrata REST API for real-time permit search with full-text search, contractor data, and geo-coordinates
2. **Human-in-the-Loop Q&A**: Two-phase navigation flow - clarifying questions first, then refined roadmap (following CrossBeam's multi-phase pattern)
3. **Skills-Based Knowledge**: Domain expertise organized as modular skill files with SKILL.md workflows and reference docs (CrossBeam architecture)
4. **Multi-Source Search**: Toggle between City bulk data and County live API, each with appropriate UI controls

## Tech Stack

| Component | Technology |
|-----------|-----------|
| MCP Server | TypeScript + `@modelcontextprotocol/sdk` |
| Web Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS 4 |
| AI | Claude API (`@anthropic-ai/sdk`) |
| Data Processing | PapaParse (CSV), Socrata SODA API |
| Package Manager | pnpm workspaces |

## Team

Built with Claude Code for the City of San Diego Impact Lab Hackathon.

## License

MIT
