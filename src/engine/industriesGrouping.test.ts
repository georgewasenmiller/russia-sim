import { describe, expect, it } from "vitest";
import { groupIndustriesBySector } from "./industries";
import type { Industry } from "./types";

function makeIndustry(overrides: Partial<Industry>): Industry {
  return {
    id: "x",
    regionId: "moscow",
    sector: "manufacturing",
    label: "Test",
    status: "operational",
    startedAtGameDay: 0,
    completesAtGameDay: 0,
    localInfraMultiplier: 1,
    nationalMultiplier: 1,
    jobs: 10,
    outputContribution: 0.1,
    maintenanceCost: 0.1,
    exportVolumeContribution: 0,
    origin: "built",
    ...overrides,
  };
}

describe("groupIndustriesBySector", () => {
  it("counts operational industries by sector and lists building ones separately", () => {
    const industries: Industry[] = [
      makeIndustry({ id: "1", sector: "oil_gas", status: "operational" }),
      makeIndustry({ id: "2", sector: "oil_gas", status: "operational" }),
      makeIndustry({ id: "3", sector: "tech", status: "operational" }),
      makeIndustry({ id: "4", sector: "agriculture", status: "building", completesAtGameDay: 2 }),
    ];

    const grouping = groupIndustriesBySector(industries);
    expect(grouping.operational).toEqual({ oil_gas: 2, tech: 1 });
    expect(grouping.building).toEqual([{ sector: "agriculture", completesAtGameDay: 2 }]);
  });

  it("returns empty grouping for no industries", () => {
    const grouping = groupIndustriesBySector([]);
    expect(grouping.operational).toEqual({});
    expect(grouping.building).toEqual([]);
  });
});
