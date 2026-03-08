#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { searchPermitsSchema, handleSearchPermits } from "./tools/permit-search.js";
import { navigatePermitsSchema, handleNavigatePermits } from "./tools/permit-navigator.js";
import { codeLookupSchema, handleCodeLookup } from "./tools/code-lookup.js";
import { checkExemptionSchema, handleCheckExemption } from "./tools/compliance-check.js";
import { estimateCostSchema, handleEstimateCost } from "./tools/cost-estimator.js";
import { buildingPlansGuideSchema, handleBuildingPlansGuide } from "./tools/building-plans-guide.js";
import { socrataSearch, socrataGetStats } from "./data/socrata-client.js";
import {
  validateAccelaConnection,
  isAccelaConfigured,
  getCityPermitStats,
  lookupCityPermit,
  accelaSearchAddresses,
  accelaSearchParcels,
} from "./data/accela-api.js";
import { lookupPropertyZoning } from "./data/property-lookup.js";
import { z } from "zod";

const server = new McpServer({
  name: "permitpal-sd",
  version: "3.0.0",
  description:
    "PermitPal SD - AI-powered San Diego building permit navigator. Search City permits via Accela API + County permits via Socrata API, get permit roadmaps, look up municipal code, and check exemptions.",
});

// ── Tool 1: Search Permits (Accela API → CSV fallback) ──

server.tool(
  "search_permits",
  "Search City of San Diego building permits by address, type, status, date range, or parcel number (APN). Uses the Accela Civic Platform API (live) with CSV fallback. Returns permit details with project info, dates, valuations, and contacts.",
  searchPermitsSchema.shape,
  async (input) => {
    const result = await handleSearchPermits(input);
    return { content: [{ type: "text", text: result }] };
  }
);

// ── Tool 2: Navigate Permits (AI-powered) ──

server.tool(
  "navigate_permits",
  "AI-powered permit navigator with optional Q&A refinement. Describe your project in plain English (e.g., 'I want to build an ADU in my backyard') and get a complete permit roadmap. Set include_questions=true to get clarifying questions first for a more precise roadmap.",
  navigatePermitsSchema.shape,
  async (input) => {
    const result = await handleNavigatePermits(input);
    return { content: [{ type: "text", text: result }] };
  }
);

// ── Tool 3: Code Lookup ──

server.tool(
  "lookup_code",
  "Search San Diego Municipal Code sections relevant to building permits, zoning, ADUs, exemptions, parking, height limits, and more.",
  codeLookupSchema.shape,
  async (input) => {
    const result = await handleCodeLookup(input);
    return { content: [{ type: "text", text: result }] };
  }
);

// ── Tool 4: Check Exemption ──

server.tool(
  "check_exemption",
  "Check if your project qualifies for a building permit exemption under San Diego Municipal Code §129.0203. Covers common exemptions for fences, painting, minor repairs, small structures, and more.",
  checkExemptionSchema.shape,
  async (input) => {
    const result = await handleCheckExemption(input);
    return { content: [{ type: "text", text: result }] };
  }
);

// ── Tool 5: Permit Stats (CSV bulk data) ──

server.tool(
  "get_permit_stats",
  "Get statistics and trends from San Diego City's permit database. Shows totals, breakdowns by type and status, and average project valuations. Uses CSV bulk data for comprehensive aggregation.",
  {
    type: z.string().optional().describe("Filter by permit/approval type (e.g., 'Building Permit', 'Solar')"),
    area: z.string().optional().describe("Filter by area/neighborhood (matches against address)"),
  },
  async (input) => {
    const stats = await getCityPermitStats({ type: input.type, area: input.area });
    return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
  }
);

// ── Tool 6: Live County Permit Search (Socrata API) ──

server.tool(
  "search_county_permits",
  "Search San Diego COUNTY building permits via live Socrata REST API (236K+ records, real-time). Supports full-text search, filtering by address/type/status, and pagination. Returns contractor info, scope of work, and geo-coordinates.",
  {
    address: z.string().optional().describe("Street address to search (partial match)"),
    type: z.string().optional().describe("Permit category (e.g., 'Residential Alteration', 'Solar', 'New Construction')"),
    status: z.string().optional().describe("Record status (e.g., 'Completed', 'Issued', 'Active')"),
    query: z.string().optional().describe("Full-text search query (e.g., 'ADU garage conversion')"),
    limit: z.number().optional().default(20).describe("Max results (default 20)"),
  },
  async (input) => {
    const { results, total } = await socrataSearch({
      address: input.address,
      type: input.type,
      status: input.status,
      query: input.query,
      limit: input.limit,
    });

    const formatted = results.map((r) => ({
      record_id: r.record_id,
      type: r.record_category || r.record_type,
      status: r.record_status,
      description: r.use,
      address: r.full_address,
      contractor: r.contractor_name || "N/A",
      opened: r.open_date,
      issued: r.issued_date,
      owner_builder: r.homeowner_biz_owner,
      coordinates: r.geocoded_column
        ? `${r.geocoded_column.latitude}, ${r.geocoded_column.longitude}`
        : "N/A",
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source: "San Diego County Socrata API (live)",
          results: formatted,
          total_matching: total,
          showing: formatted.length,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 7: County Permit Analytics (Socrata API) ──

server.tool(
  "get_county_permit_stats",
  "Get real-time analytics from San Diego County's permit database via Socrata API. Shows totals, breakdown by type and status, and monthly trends for the past 12 months.",
  {
    type: z.string().optional().describe("Filter by permit category"),
    area: z.string().optional().describe("Filter by area/city (matches address)"),
  },
  async (input) => {
    const stats = await socrataGetStats({ type: input.type, area: input.area });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source: "San Diego County Socrata API (live)",
          ...stats,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 8: Permit Detail Lookup (Accela → CSV fallback) ──

server.tool(
  "lookup_permit_detail",
  "Look up a specific City of San Diego permit by record ID or street address. Returns detailed permit info via Accela API including contacts, conditions, and parcel data. Falls back to CSV data if Accela is unavailable.",
  {
    record_id: z.string().optional().describe("Accela record ID or permit number (e.g., 'BLD2023-001234')"),
    street_address: z.string().optional().describe("Street address to search"),
  },
  async (input) => {
    if (!input.record_id && !input.street_address) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Provide either record_id or street_address to look up a permit.",
          }),
        }],
      };
    }

    const { results, source, detail_url } = await lookupCityPermit({
      record_id: input.record_id,
      address: input.street_address,
    });

    if (results.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            source,
            results: [],
            note: "No results found. Try searching with search_permits for broader matching, or search_county_permits for County records.",
          }),
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source,
          results: results.map((r) => ({
            record_id: r.project_id,
            permit_number: r.approval_id,
            type: r.approval_type,
            status: r.approval_status,
            title: r.project_title,
            scope: r.project_scope,
            address: r.address,
            apn: r.apn || undefined,
            opened: r.date_created,
            issued: r.date_issued,
            valuation: r.valuation && parseFloat(r.valuation) > 0
              ? `$${parseFloat(r.valuation).toLocaleString()}`
              : "N/A",
            coordinates: r.lat && r.lng ? `${r.lat}, ${r.lng}` : undefined,
            module: r.module,
            contacts: r.contacts?.map((c) => ({
              name: c.fullName,
              type: c.type?.text,
              email: c.email,
              phone: c.phone1,
            })),
            conditions: r.conditions?.map((c) => ({
              name: c.name,
              description: c.description,
              status: c.status?.text,
              type: c.type?.text,
              severity: c.severity?.text,
            })),
            parcels: r.parcels?.map((p) => ({
              apn: p.parcelNumber,
              block: p.block,
              lot: p.lot,
              legal_description: p.legalDescription,
              land_value: p.landValue,
              improved_value: p.improvedValue,
            })),
          })),
          detail_url,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 9: Search Addresses (Accela) ──

server.tool(
  "search_addresses",
  "Search City of San Diego reference addresses in the Accela system. Useful for validating addresses, finding nearby properties, or getting location metadata (coordinates, inspection district, neighborhood).",
  {
    street_name: z.string().optional().describe("Street name to search (e.g., 'Main', 'Broadway')"),
    street_number: z.number().optional().describe("Street number (e.g., 123)"),
    city: z.string().optional().default("San Diego").describe("City name (default: San Diego)"),
    postal_code: z.string().optional().describe("ZIP code (e.g., '92101')"),
    neighborhood: z.string().optional().describe("Neighborhood name"),
    limit: z.number().optional().default(20).describe("Max results (default 20)"),
  },
  async (input) => {
    if (!isAccelaConfigured()) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Accela API not configured. Set ACCELA_APP_ID environment variable.",
            suggestion: "Register at developer.accela.com to get an App ID.",
          }),
        }],
      };
    }

    const { results, total } = await accelaSearchAddresses({
      streetName: input.street_name,
      streetStart: input.street_number,
      city: input.city,
      postalCode: input.postal_code,
      neighborhood: input.neighborhood,
      limit: input.limit,
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source: "City of San Diego (Accela API, live)",
          results: results.map((a) => ({
            address: a.addressLine1 || a.streetAddress || `${a.streetStart || ""} ${a.streetName || ""}`.trim(),
            city: a.city,
            state: a.state,
            zip: a.postalCode,
            neighborhood: a.neighborhood,
            inspection_district: a.inspectionDistrict,
            coordinates: a.xCoordinate && a.yCoordinate
              ? `${a.yCoordinate}, ${a.xCoordinate}`
              : undefined,
            status: a.status,
            is_primary: a.isPrimary,
          })),
          total,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 10: Search Parcels (Accela) ──

server.tool(
  "search_parcels",
  "Search City of San Diego parcel data by APN, owner name, or address. Returns parcel details including APN, legal description, assessed values, census/council districts, and associated owners and addresses.",
  {
    parcel_number: z.string().optional().describe("APN (Assessor Parcel Number), partial match supported"),
    owner_name: z.string().optional().describe("Property owner name (partial match)"),
    street_name: z.string().optional().describe("Street name for address-based parcel lookup"),
    city: z.string().optional().describe("City name for address filter"),
    subdivision: z.string().optional().describe("Subdivision name (partial match)"),
    limit: z.number().optional().default(20).describe("Max results (default 20)"),
  },
  async (input) => {
    if (!isAccelaConfigured()) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Accela API not configured. Set ACCELA_APP_ID environment variable.",
            suggestion: "Register at developer.accela.com to get an App ID.",
          }),
        }],
      };
    }

    const { results, total } = await accelaSearchParcels({
      parcelNumber: input.parcel_number,
      ownerName: input.owner_name,
      streetName: input.street_name,
      city: input.city,
      subdivision: input.subdivision,
      limit: input.limit,
      expand: ["addresses", "owners"],
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source: "City of San Diego (Accela API, live)",
          results: results.map((p) => ({
            apn: p.parcelNumber,
            block: p.block,
            lot: p.lot,
            legal_description: p.legalDescription,
            subdivision: p.subdivision,
            status: p.status,
            parcel_area: p.parcelArea,
            land_value: p.landValue,
            improved_value: p.improvedValue,
            exemption_value: p.exemptionValue,
            census_tract: p.censusTract,
            council_district: p.councilDistrict,
            supervisor_district: p.supervisorDistrict,
            book: p.book,
            page: p.page,
            map_number: p.mapNumber,
            addresses: p.addresses?.map((a) => ({
              address: a.addressLine1 || `${a.streetStart || ""} ${a.streetName || ""}`.trim(),
              city: a.city,
              zip: a.postalCode,
              neighborhood: a.neighborhood,
            })),
            owners: p.owners?.map((o) => ({
              name: o.ownerFullName,
              address: o.mailAddress1,
              city: o.mailCity,
              state: o.mailState,
              zip: o.mailZip,
            })),
          })),
          total,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 11: Property Zoning Lookup (ArcGIS) ──

server.tool(
  "lookup_property_zoning",
  "Look up zoning designation, property type, and overlay restrictions for any San Diego address. Returns the base zone code (e.g., RS-1-7), plain-English zone description, property type (single-family, multi-family, commercial, industrial), lot size, APN, year built, and overlay flags (coastal zone, historic district). Uses City of San Diego ArcGIS services. Call this tool when you need to know a property's zoning before advising on permits, setbacks, height limits, or allowed uses.",
  {
    address: z.string().describe("Street address in San Diego (e.g., '4225 Park Blvd, San Diego, CA')"),
  },
  async (input) => {
    const data = await lookupPropertyZoning(input.address);

    if (!data.address) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Could not geocode address. Make sure it's a valid San Diego address.",
            suggestion: "Try including street number, name, and 'San Diego, CA'.",
          }),
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source: "City of San Diego ArcGIS",
          address: data.address,
          coordinates: { lat: data.lat, lng: data.lng },
          zoning: {
            zone_code: data.zone_code ?? "Not found",
            zone_description: data.zone_plain_english ?? "Not found",
            property_type: data.property_type ?? "unknown",
          },
          parcel: {
            apn: data.apn ?? "Not found",
            lot_size_sqft: data.lot_size_sqft ?? "Not found",
            year_built: data.year_built ?? "Not found",
          },
          overlays: data.overlays.length > 0 ? data.overlays : "None detected",
          is_coastal: data.is_coastal,
          is_historic: data.is_historic,
          data_sources: data.data_sources,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 12: Project Cost Estimator ──

server.tool(
  "estimate_project_cost",
  "Estimate total project cost for any San Diego home improvement project. Returns itemized breakdown of construction costs, permit fees (based on City of SD IB-501 fee schedule), professional fees (architect, engineer, etc.), timeline, warnings, and savings tips. Covers ADUs, kitchen/bathroom remodels, solar, room additions, decks, fences, HVAC, roofing, electrical panels, and more. Uses San Diego 2025-2026 market data.",
  estimateCostSchema.shape,
  async (input) => {
    const result = handleEstimateCost(input);
    return { content: [{ type: "text", text: result }] };
  }
);

// ── Tool 13: Building Plans Guide ──

server.tool(
  "get_building_plans_guide",
  "Get a personalized guide for obtaining existing building floor plans for a San Diego property. Determines if your project needs existing plans, looks up permit history and property data, and provides step-by-step instructions for requesting plan copies from the City of San Diego DSD or San Diego County PDS. Covers appointment scheduling, Plan Duplication Application process, copyright requirements, and alternatives if plans aren't on file.",
  buildingPlansGuideSchema.shape,
  async (input) => {
    const result = await handleBuildingPlansGuide(input);
    return { content: [{ type: "text", text: result }] };
  }
);

// ── Start server ──

async function main() {
  // Validate Accela connection on startup (non-blocking)
  if (isAccelaConfigured()) {
    validateAccelaConnection().catch((err) =>
      console.error("Accela connection check failed:", err)
    );
  } else {
    console.error(
      "ACCELA_APP_ID not set — City permit search will use CSV fallback. " +
      "Set ACCELA_APP_ID and ACCELA_APP_SECRET env vars for live Accela API access."
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PermitPal SD MCP Server v3.0 running on stdio (13 tools)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
