// Zone development rules derived from San Diego Municipal Code
// Chapter 13, Article 1, Division 4, Tables 131-04C through 131-04G
// Source: https://docs.sandiego.gov/municode/MuniCodeChapter13/Ch13Art01Division04.pdf

export interface ZoneDevelopmentRules {
  max_height_ft: number | null;
  height_note?: string;
  front_setback_ft: number;
  side_setback_ft: number;
  rear_setback_ft: number;
  setback_note?: string;
  min_lot_area_sf: number;
  density_sf_per_du?: number; // sq ft of lot area per dwelling unit (RM zones)
  code_reference: string;
}

interface ZoneEntry {
  height: number | null;
  height_note?: string;
  front: number;
  side: number;
  rear: number;
  setback_note?: string;
  min_lot: number;
  lot_width?: number; // for computing formula-based side setbacks
  density?: number;   // sf per DU (RM zones)
}

// Table 131-04C — RE Zones
const RE_ZONES: Record<string, ZoneEntry> = {
  "RE-1-1": { height: 30, front: 25, side: 20, rear: 25, min_lot: 435600, lot_width: 200 },
  "RE-1-2": { height: 30, front: 25, side: 20, rear: 25, min_lot: 217800, lot_width: 200 },
  "RE-1-3": { height: 30, front: 25, side: 20, rear: 25, min_lot: 43560, lot_width: 100 },
};

// Table 131-04D — RS Zones
// RS-1-1 through RS-1-7: height 24/30 (footnote 4: §131.0444(b)), side = 0.08 × lot_width
// RS-1-8 through RS-1-14: height 35, side is fixed
const RS_ZONES: Record<string, ZoneEntry> = {
  "RS-1-1":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 25, side: 8, rear: 25, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 40000, lot_width: 100 },
  "RS-1-2":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 25, side: 6, rear: 25, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 20000, lot_width: 80 },
  "RS-1-3":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 20, side: 6, rear: 20, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 15000, lot_width: 75 },
  "RS-1-4":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 20, side: 5, rear: 20, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 10000, lot_width: 65 },
  "RS-1-5":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 20, side: 5, rear: 20, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 8000, lot_width: 60 },
  "RS-1-6":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 15, side: 5, rear: 15, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 6000, lot_width: 60 },
  "RS-1-7":  { height: 30, height_note: "24 ft base; 30 ft with pitched roof per §131.0444(b)", front: 15, side: 4, rear: 13, setback_note: "Side = 8% of lot width (min 4 ft)", min_lot: 5000, lot_width: 50 },
  "RS-1-8":  { height: 35, front: 25, side: 10, rear: 10, min_lot: 40000, lot_width: 100 },
  "RS-1-9":  { height: 35, front: 25, side: 8,  rear: 10, min_lot: 20000, lot_width: 80 },
  "RS-1-10": { height: 35, front: 25, side: 7,  rear: 10, min_lot: 15000, lot_width: 75 },
  "RS-1-11": { height: 35, front: 20, side: 6,  rear: 10, min_lot: 10000, lot_width: 65 },
  "RS-1-12": { height: 35, front: 20, side: 5,  rear: 10, min_lot: 8000, lot_width: 60 },
  "RS-1-13": { height: 35, front: 15, side: 5,  rear: 15, min_lot: 6000, lot_width: 60 },
  "RS-1-14": { height: 35, front: 15, side: 4,  rear: 13, min_lot: 5000, lot_width: 50 },
};

// Table 131-04E — RX Zones
const RX_ZONES: Record<string, ZoneEntry> = {
  "RX-1-1": { height: 30, front: 15, side: 3, rear: 10, setback_note: "Side 0 ft if attached", min_lot: 4000, lot_width: 35 },
  "RX-1-2": { height: 30, front: 15, side: 3, rear: 10, setback_note: "Side 0 ft if attached", min_lot: 3000, lot_width: 35 },
};

// Table 131-04F — RT Zones
// Height varies by story/floor type: 1-2 story slab=21, raised=25; 3 story slab=31, raised=35
const RT_ZONES: Record<string, ZoneEntry> = {
  "RT-1-1": { height: 35, height_note: "21-35 ft depending on stories and floor type", front: 5, side: 0, rear: 3, setback_note: "Front 5-15 ft; side 0 ft (5 ft street side)", min_lot: 3500, lot_width: 25 },
  "RT-1-2": { height: 35, height_note: "21-35 ft depending on stories and floor type", front: 5, side: 0, rear: 3, setback_note: "Front 5-15 ft; side 0 ft (5 ft street side)", min_lot: 3000, lot_width: 25 },
  "RT-1-3": { height: 35, height_note: "21-35 ft depending on stories and floor type", front: 5, side: 0, rear: 3, setback_note: "Front 5-15 ft; side 0 ft (5 ft street side)", min_lot: 2500, lot_width: 25 },
  "RT-1-4": { height: 35, height_note: "21-35 ft depending on stories and floor type", front: 5, side: 0, rear: 3, setback_note: "Front 5-15 ft; side 0 ft (5 ft street side)", min_lot: 2200, lot_width: 25 },
  "RT-1-5": { height: 35, height_note: "21-35 ft depending on stories and floor type", front: 5, side: 0, rear: 3, setback_note: "Front 5-10 ft; side 0 ft (5 ft street side)", min_lot: 1600, lot_width: 18 },
};

// Table 131-04G — RM Zones
const RM_ZONES: Record<string, ZoneEntry> = {
  "RM-1-1": { height: 30, front: 15, side: 5, rear: 15, min_lot: 6000, lot_width: 50, density: 3000 },
  "RM-1-2": { height: 30, front: 15, side: 5, rear: 15, min_lot: 6000, lot_width: 50, density: 2500 },
  "RM-1-3": { height: 30, front: 15, side: 5, rear: 15, min_lot: 6000, lot_width: 50, density: 2000 },
  "RM-2-4": { height: 40, front: 15, side: 5, rear: 15, min_lot: 6000, lot_width: 50, density: 1750 },
  "RM-2-5": { height: 40, front: 15, side: 5, rear: 15, min_lot: 6000, lot_width: 50, density: 1500 },
  "RM-2-6": { height: 40, front: 15, side: 5, rear: 15, min_lot: 6000, lot_width: 50, density: 1250 },
  "RM-3-7": { height: 40, front: 10, side: 5, rear: 5,  min_lot: 7000, lot_width: 70, density: 1000 },
  "RM-3-8": { height: 50, front: 10, side: 5, rear: 5,  min_lot: 7000, lot_width: 70, density: 800 },
  "RM-3-9": { height: 60, front: 10, side: 5, rear: 5,  min_lot: 7000, lot_width: 70, density: 600 },
  "RM-4-10": { height: null, height_note: "Per community plan", front: 15, side: 5, rear: 15, setback_note: "Per community plan", min_lot: 7000, lot_width: 100, density: 400 },
  "RM-4-11": { height: null, height_note: "Per community plan", front: 15, side: 4, rear: 15, setback_note: "Per community plan", min_lot: 7000, lot_width: 100, density: 200 },
  "RM-5-12": { height: null, height_note: "Per community plan", front: 15, side: 4, rear: 15, setback_note: "Per community plan", min_lot: 10000, lot_width: 100, density: 1000 },
};

function findZoneEntry(zoneCode: string): { entry: ZoneEntry; table: string } | null {
  const z = zoneCode.toUpperCase().trim();

  // Exact match first
  if (RE_ZONES[z]) return { entry: RE_ZONES[z], table: "SDMC Table 131-04C" };
  if (RS_ZONES[z]) return { entry: RS_ZONES[z], table: "SDMC Table 131-04D" };
  if (RX_ZONES[z]) return { entry: RX_ZONES[z], table: "SDMC Table 131-04E" };
  if (RT_ZONES[z]) return { entry: RT_ZONES[z], table: "SDMC Table 131-04F" };
  if (RM_ZONES[z]) return { entry: RM_ZONES[z], table: "SDMC Table 131-04G" };

  // Fuzzy match: try common ArcGIS formats like "RS-1-7A" or "RS1-7"
  const normalized = z.replace(/[^A-Z0-9-]/g, "");
  for (const [tables, tableName] of [
    [RE_ZONES, "SDMC Table 131-04C"],
    [RS_ZONES, "SDMC Table 131-04D"],
    [RX_ZONES, "SDMC Table 131-04E"],
    [RT_ZONES, "SDMC Table 131-04F"],
    [RM_ZONES, "SDMC Table 131-04G"],
  ] as [Record<string, ZoneEntry>, string][]) {
    for (const key of Object.keys(tables)) {
      if (normalized.startsWith(key)) {
        return { entry: tables[key], table: tableName };
      }
    }
  }

  return null;
}

export function getZoneDevelopmentRules(zoneCode: string): ZoneDevelopmentRules | null {
  const match = findZoneEntry(zoneCode);
  if (!match) return null;
  const { entry, table } = match;

  return {
    max_height_ft: entry.height,
    height_note: entry.height_note,
    front_setback_ft: entry.front,
    side_setback_ft: entry.side,
    rear_setback_ft: entry.rear,
    setback_note: entry.setback_note,
    min_lot_area_sf: entry.min_lot,
    density_sf_per_du: entry.density,
    code_reference: table,
  };
}

export function getAllowedUnitsDescription(
  zoneCode: string,
  lotSizeSqft?: number
): string {
  const z = zoneCode.toUpperCase().trim();

  // Single-family residential
  if (z.startsWith("RS") || z.startsWith("RE")) {
    return "1 home + ADU + JADU";
  }

  // Small-lot residential (attached/detached single units)
  if (z.startsWith("RX")) {
    return "Up to 2 homes + ADU + JADU";
  }

  // Townhouse
  if (z.startsWith("RT")) {
    return "1 home + ADU + JADU";
  }

  // Multi-family: compute from density
  if (z.startsWith("RM")) {
    const match = findZoneEntry(z);
    if (match?.entry.density && lotSizeSqft) {
      const maxUnits = Math.floor(lotSizeSqft / match.entry.density);
      if (maxUnits > 1) {
        return `Up to ${maxUnits} units + ADUs`;
      }
      return "1 unit + ADU";
    }
    return "Multiple units (per density) + ADUs";
  }

  // Commercial / Industrial
  if (
    z.startsWith("CX") || z.startsWith("CN") || z.startsWith("CV") ||
    z.startsWith("CO") || z.startsWith("CC") || z.startsWith("CR") ||
    z.startsWith("IP") || z.startsWith("IL") || z.startsWith("IS")
  ) {
    return "Not residential";
  }

  return "Contact DSD for details";
}
