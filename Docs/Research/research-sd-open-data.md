# San Diego Open Data Portal — API Research

Research compiled 2026-03-04 at 1:00 AM.

## Overview

The City of San Diego Open Data Portal at `data.sandiego.gov` is a custom-built portal (not Socrata/SODA). Data is served as **static file downloads** (CSV, JSON, GeoJSON, TopoJSON) hosted on `seshat.datasd.org`. There is **no live query API** (no SODA, no GraphQL, no REST query endpoint).

**Key implication for hackathon:** We'll need to either pre-download and index the data, or use the ArcGIS REST APIs (see `research-zapp-arcgis.md`) for live queries.

## Relevant Datasets

### 1. Development Permits (Current System)
- **URL:** https://data.sandiego.gov/datasets/development-permits-set2/
- **Description:** Permits, maps, agreements from DSD's cloud-based system (Accela). Migrated starting 2018.
- **Download (closed):** `https://seshat.datasd.org/development_permits_set2/permits_set2_closed_datasd.csv`
- **Format:** CSV (tabular)
- **Use case:** Historical permit data, timelines, types of permits issued

### 2. Development Permits (Legacy)
- **URL:** https://data.sandiego.gov/datasets/development-permits-set1/
- **Description:** Pre-2018 permits from legacy system
- **Download:** `https://seshat.datasd.org/development_permits_set1/permits_set1_closed_datasd.csv`

### 3. Zoning (GIS Data) ⭐ HIGH VALUE
- **URL:** https://data.sandiego.gov/datasets/zoning/
- **Last modified:** 2026-03-03 (very fresh!)
- **License:** Open Data Commons PDDL (public domain)
- **Downloads:**
  - TopoJSON: `https://seshat.datasd.org/gis_zoning/zoning_datasd.topo.json`
  - GeoJSON: `https://seshat.datasd.org/gis_zoning/zoning_datasd.geojson`
  - CSV attribute table: `https://seshat.datasd.org/gis_zoning/zoning_datasd.csv`
  - Data dictionary: `https://seshat.datasd.org/gis_zoning/zoning_dictionary_datasd.csv`
- **Use case:** Base zone designation for any parcel in the city. Could be loaded into memory or a spatial DB for point-in-polygon lookups.

### 4. Building Permits (County level — Socrata)
- **URL:** https://data.sandiegocounty.gov/Housing-and-Infrastructure/Building-Permits/dyzh-7eat
- **Note:** This is the **County** portal (different from City), and it IS Socrata-based, meaning it has a SODA API.
- **SODA endpoint:** `https://data.sandiegocounty.gov/resource/dyzh-7eat.json`
- **Example query:**
```
GET https://data.sandiegocounty.gov/resource/dyzh-7eat.json?$where=site_address like '%MAIN ST%'&$limit=50&$order=issue_date DESC
```
- No auth required for reads. API token optional (increases rate limits).

### 5. NextRequest — Public Records Portal
- **URL:** https://sandiego.nextrequest.com/
- **What it is:** 40,000+ searchable public records requests (FOIA-style). Anyone can search published requests and attached documents.
- **Use case:** Source of real permit denial/approval documents, DSD correspondence, and homeowner complaints. Useful for understanding real rejection patterns and what people struggle with.
- **Search tip:** Search for "ADU permit denied", "plan check corrections", "DSD overcharge" etc. to find real cases with attached city documents.
- **Not an API** — manual search only. But valuable for enriching the system prompt with real-world examples.

### 6. Permitting Center Dashboard
- **URL:** https://www.sandiego.gov/development-services/permits-inspections/dashboard
- **What it is:** City's own aggregate stats on permit activity — processing times, volume, approval rates.
- **Use case:** Source of real numbers for the demo narrative ("the average ADU permit takes X days") and for calibrating the timeline estimator.

### 7. Permit Activity Reports
- **URL:** https://www.sandiego.gov/development-services/records/permit-activity-reports
- **What it is:** Published reports on DSD permit activity over time.
- **Use case:** Historical trends, volume data, processing time changes year-over-year.

## Data Architecture

The portal follows a **Catalog > Dataset > Resource** model:
- **Catalog:** List of all datasets at `/datasets/`
- **Dataset:** A collection page with multiple resources
- **Resource:** The actual downloadable file (CSV, JSON, GeoJSON, etc.)

All resources are static files hosted on `seshat.datasd.org`. No auth required. Public domain license.

## How to Use This Data

### For Zoning Lookups (recommended approach)
```javascript
// Option A: Download GeoJSON and do client-side point-in-polygon
const response = await fetch('https://seshat.datasd.org/gis_zoning/zoning_datasd.geojson');
const zoningData = await response.json();
// Use turf.js for point-in-polygon: turf.booleanPointInPolygon(point, polygon)

// Option B: Use ArcGIS REST API for live queries (see research-zapp-arcgis.md)
// This is better for hackathon — no need to load large GeoJSON files
```

### For Permit History
```javascript
// Download CSV and parse
const response = await fetch('https://seshat.datasd.org/development_permits_set2/permits_set2_closed_datasd.csv');
const csvText = await response.text();
// Parse with papaparse or similar
// Filter by address/APN
```

## What's NOT Available
- **No parcel attribute API** — parcels are in ArcGIS, not the open data portal
- **No real-time permit status** — only closed/completed permits
- **No fee schedule data** — fees are in the DSD Submittal Manual (PDF)
- **No address-to-APN lookup** — need ArcGIS geocoder for this

## Recommendations for Hackathon

1. **Primary data path:** Use ArcGIS REST API for live address → parcel → zoning lookups (see `research-zapp-arcgis.md`)
2. **Supplement with:** Open data portal for historical permit data, zoning GeoJSON for offline/backup
3. **MCP server:** Build an MCP server that wraps the ArcGIS REST endpoints + pre-indexed permit CSV data
4. **For the County SODA API:** Use for county-level building permit statistics if needed
