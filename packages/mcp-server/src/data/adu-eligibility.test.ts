import { describe, it, expect } from "vitest";
import { checkAduEligibility, AduEligibility } from "./adu-eligibility.js";
import { PropertyZoningData } from "./property-lookup.js";

function makeZoning(overrides: Partial<PropertyZoningData> = {}): PropertyZoningData {
  return {
    overlays: [],
    is_coastal: false,
    is_historic: false,
    data_sources: ["test"],
    ...overrides,
  };
}

describe("checkAduEligibility", () => {
  describe("single-family zones", () => {
    it("returns eligible for RS zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RS-1-7", zone_plain_english: "Single-Family Residential", property_type: "single-family" }),
      );
      expect(result.eligible).toBe(true);
      expect(result.eligibility_type).toBe("single-family");
      expect(result.rules).toContain("One ADU + one JADU allowed per lot");
    });

    it("returns eligible for RE zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RE-1", zone_plain_english: "Residential Estate", property_type: "single-family" }),
      );
      expect(result.eligible).toBe(true);
      expect(result.eligibility_type).toBe("single-family");
    });

    it("includes coastal warning when in coastal zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RS-1-7", property_type: "single-family", is_coastal: true, overlays: ["Coastal Zone"] }),
      );
      expect(result.eligible).toBe(true);
      expect(result.warnings.some((w) => w.includes("Coastal"))).toBe(true);
    });

    it("includes historic warning when in historic district", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RS-1-7", property_type: "single-family", is_historic: true }),
      );
      expect(result.eligible).toBe(true);
      expect(result.warnings.some((w) => w.includes("Historic"))).toBe(true);
    });

    it("includes transit area note", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RS-1-7", property_type: "single-family", overlays: ["Transit Area"] }),
      );
      expect(result.warnings.some((w) => w.includes("Transit"))).toBe(true);
    });
  });

  describe("multi-family zones", () => {
    it("returns eligible with multi-family rules for RM zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RM-1-1", zone_plain_english: "Multi-Family Residential (low density)", property_type: "multi-family" }),
      );
      expect(result.eligible).toBe(true);
      expect(result.eligibility_type).toBe("multi-family");
      expect(result.rules.some((r) => r.includes("non-livable space"))).toBe(true);
      expect(result.rules.some((r) => r.includes("25%"))).toBe(true);
      expect(result.rules.some((r) => r.includes("JADU"))).toBe(true);
    });

    it("returns eligible for RT zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RT-1-1", zone_plain_english: "Residential Two-Family", property_type: "multi-family" }),
      );
      expect(result.eligible).toBe(true);
      expect(result.eligibility_type).toBe("multi-family");
    });
  });

  describe("commercial zones", () => {
    it("returns not eligible for CC zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "CC-3-5", zone_plain_english: "Commercial Community", property_type: "commercial" }),
      );
      expect(result.eligible).toBe(false);
      expect(result.eligibility_type).toBe("not-eligible");
      expect(result.message).toContain("CC-3-5");
      expect(result.message).toContain("not permitted");
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it("returns not eligible for CCPD-CORE zone (apartment complex)", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "CCPD-CORE", zone_plain_english: "Commercial Community", property_type: "commercial" }),
      );
      expect(result.eligible).toBe(false);
      expect(result.eligibility_type).toBe("not-eligible");
      expect(result.message).toContain("CCPD-CORE");
    });

    it("returns not eligible for CX zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "CX-1", zone_plain_english: "Mixed Commercial", property_type: "commercial" }),
      );
      expect(result.eligible).toBe(false);
      expect(result.eligibility_type).toBe("not-eligible");
    });

    it("suggests alternatives for commercial zones", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "CC-3-5", property_type: "commercial" }),
      );
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.some((a) => a.includes("DSD") || a.includes("Development Services"))).toBe(true);
    });
  });

  describe("industrial zones", () => {
    it("returns not eligible for IP zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "IP-1-1", zone_plain_english: "Industrial Park", property_type: "industrial" }),
      );
      expect(result.eligible).toBe(false);
      expect(result.eligibility_type).toBe("not-eligible");
      expect(result.message).toContain("industrial");
    });

    it("returns not eligible for IL zone", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "IL-1-1", zone_plain_english: "Limited Industrial", property_type: "industrial" }),
      );
      expect(result.eligible).toBe(false);
    });
  });

  describe("unknown zones", () => {
    it("returns unknown type when property_type is unknown", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "XYZ-1", property_type: "unknown" }),
      );
      expect(result.eligible).toBe(true); // don't block
      expect(result.eligibility_type).toBe("unknown");
      expect(result.warnings.some((w) => w.includes("verify") || w.includes("confirm"))).toBe(true);
    });

    it("returns unknown type when property_type is undefined", () => {
      const result = checkAduEligibility(makeZoning({}));
      expect(result.eligibility_type).toBe("unknown");
    });
  });

  describe("return shape", () => {
    it("always includes zone_code and zone_description", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "RS-1-7", zone_plain_english: "Single-Family Residential", property_type: "single-family" }),
      );
      expect(result.zone_code).toBe("RS-1-7");
      expect(result.zone_description).toBe("Single-Family Residential");
    });

    it("has empty rules and warnings for ineligible zones", () => {
      const result = checkAduEligibility(
        makeZoning({ zone_code: "CC-3-5", property_type: "commercial" }),
      );
      expect(result.rules).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });
});
