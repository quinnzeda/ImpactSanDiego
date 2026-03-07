# OpenDSD + Accela — Permit Status Lookup Research

**Researched:** 2026-03-03  
**Purpose:** Determine if we can programmatically look up permit status and permit history by address

---

## Summary

San Diego's permit lookup is split across two systems:

| System | Time Period | URL |
|--------|-------------|-----|
| **OpenDSD** (legacy) | 2003–2018 | https://opendsd.sandiego.gov |
| **Accela Citizen Access** (current) | 2018–present | https://aca-prod.accela.com/SANDIEGO/ |

Both are public-facing web UIs. Neither exposes a documented public REST API for external apps.

---

## OpenDSD

### What It Is
OpenDSD is the City of San Diego's legacy Development Services Department permit portal. Built on an older platform (not Accela). Covers:
- Building permits (2003–2018)
- Discretionary approvals (Planning projects, variances, etc.)
- Code enforcement cases (pre-2018)

### Public Interface
- **Approval Search:** https://opendsd.sandiego.gov/web/approvals/ — search by project number or permit number
- **Address Search:** Available through the same portal (searches by street address)
- **Map View:** https://opendsd.sandiego.gov/Web/Maps/ApprovalsDiscretionary — spatial search

### API Reality Check
- The base URL redirects to `/OpenDSD/Web/Home/Error` on direct API attempts → **no documented REST API**
- Site returns 403 on `/api` path attempts
- The portal is a server-rendered .NET MVC app — data is only accessible via form posts, not REST endpoints

### Workaround: SODA API via Open Data Portal
The city exports permit data to the Open Data Portal as downloadable CSVs. Two datasets:

**Dataset 1 — Legacy (OpenDSD era):**
- URL: https://data.sandiego.gov/datasets/development-permits-set1/
- CSV: `https://seshat.datasd.org/development_permits_set1/permits_set1_datasd.csv`
- Content: Pre-2018 permits from the legacy system

**Dataset 2 — Current (Accela era):**
- URL: https://data.sandiego.gov/datasets/development-permits-set2/
- CSV: `https://seshat.datasd.org/development_permits_set2/permits_set2_closed_datasd.csv`
- Content: Post-2018 permits, closed approvals

**These CSVs are our gold mine.** They're likely indexed by address, permit type, status, project number. We can query them via SODA API:

```
GET https://data.sandiego.gov/api/views/DATASET_ID/rows.json?$where=address_address='1234 MAIN ST'
```

Standard Socrata SODA pattern. Filter by address, get all permits for that address, show history. No auth required for reads (API token optional, increases rate limits).

**Action:** Confirm field names by downloading a sample CSV and inspecting columns. Should have: address, permit_type, permit_status, issue_date, project_description, record_number.

---

## Accela Citizen Access (Post-2018)

### What It Is
Accela is the third-party civic platform SD switched to in 2018. All current building permits are processed here.

### Public Interface
https://aca-prod.accela.com/SANDIEGO/ — web UI for permit search and application. Public can search for permit status without login.

### API Reality Check
Accela has a **documented REST API** (`developer.accela.com`), BUT:
- It's designed for **city agency integrations**, not public access
- Requires OAuth tokens issued by the agency (City of San Diego would need to grant API access)
- Standard HTTP methods (GET, PUT, POST, DELETE), JSON bodies, authentication required
- SD has not published public API credentials for external developers

**The Accela API exists but is not publicly accessible for our use.**

### Accela API Endpoints (what we'd call if we had access)
```
GET /v4/records?address=<address>&agency=SANDIEGO
GET /v4/records/{recordId}
GET /v4/records/{recordId}/status
GET /v4/records/{recordId}/inspections
```

### What SD's Accela Guide Says
The city published a PDF guide (sandiego.gov/sites/default/files/dsd-accela-guide.pdf) that allows customers to:
- Apply for permits online
- Upload plans/documents
- Track status

This is citizen-facing UI, not API documentation.

---

## OpenDSD Web Scraping (Fallback)

If we need to look up a current permit by number during the demo:

```
GET https://aca-prod.accela.com/SANDIEGO/Cap/CapDetail.aspx?capID1=XXX&capID2=YYY&capID3=BLDG
```

This URL pattern returns the permit detail page as HTML. We could parse it with:
- Cheerio (Node.js)
- BeautifulSoup (Python)
- Puppeteer (headless browser)

**Not recommended for production**, but totally fine for a hackathon demo where we're showing a specific address.

---

## Practical Strategy for Permit Buddy

### What we CAN do (no API key needed)
1. **SODA API on Open Data Portal** — query permit history by address for pre-2018 and some post-2018 data
2. **ZAPP/ArcGIS** — parcel and zoning data by address (already researched in research-zapp-arcgis.md)
3. **Static context** — Claude knows permit requirements from training + our prompt engineering with Information Bulletins

### What we CAN'T do easily
- Real-time Accela permit status for active permits (no public API)
- Live permit queue position or review status

### What to demo instead
"Here are all the permits that have been pulled at 1234 Main St in the last 10 years" — from SODA data. This is **impressive and real** and something no homeowner can easily get today. Show the pattern: "Neighbor at 1238 Main St got a 600sqft ADU approved in 2023 — here's what they submitted."

---

## MCP Server Design for OpenDSD/Permits

```typescript
// MCP tool: get_permit_history
{
  name: "get_permit_history",
  description: "Get all permits ever pulled for an address in San Diego",
  inputSchema: {
    type: "object",
    properties: {
      address: { type: "string", description: "Street address (e.g., '1234 MAIN ST')" }
    }
  }
}

// Implementation: SODA API query
const sodaUrl = `https://data.sandiego.gov/api/views/${DATASET_ID}/rows.json`;
const params = new URLSearchParams({
  '$where': `address like '%${normalizedAddress}%'`,
  '$limit': '50',
  '$order': 'date_issued DESC'
});
const response = await fetch(`${sodaUrl}?${params}`);
```

Need to confirm dataset IDs and field names by inspecting the CSV files before hackathon day.

---

## Timeline for Implementation

**Day-of sequence:**
1. Download permit CSV sample (2 min) → confirm field names
2. Build SODA query function → test with real SD address (30 min)  
3. Wrap in MCP tool → expose to Claude (30 min)
4. Wire Claude to call tool when address is entered (30 min)
5. Build PropertyCard component to display results (45 min)

Total: ~2 hours for working permit history lookup.
