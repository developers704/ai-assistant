import { describe, expect, it } from "vitest";
import {
  directoryStoreAllowedForSession,
  filterDirectoryStoresForSession,
  scopeStoresForUser,
} from "@/lib/auth/scope-stores";
import type { SessionPayload } from "@/lib/auth/session-token";

const shaun: SessionPayload = {
  sub: "shaun",
  username: "shaun",
  name: "Shaun McCullough",
  role: "dm",
  title: "District Manager",
  storeCodes: ["VJ-HEND", "VJ-CULVER", "VJ-PB"],
};

const kash: SessionPayload = {
  sub: "kash",
  username: "kash",
  name: "Kash",
  role: "admin",
  title: "Founder",
  storeCodes: null,
};

describe("scopeStoresForUser", () => {
  it("admin passthrough", () => {
    expect(scopeStoresForUser(kash, []).stores).toBeUndefined();
    expect(scopeStoresForUser(kash, ["VJ-FRE"]).stores).toEqual(["VJ-FRE"]);
  });

  it("dm empty request forces district list", () => {
    expect(scopeStoresForUser(shaun, []).stores).toEqual([
      "VJ-HEND",
      "VJ-CULVER",
      "VJ-PB",
    ]);
  });

  it("dm drops foreign stores", () => {
    expect(scopeStoresForUser(shaun, ["VJ-FRE", "VJ-HEND"]).stores).toEqual([
      "VJ-HEND",
    ]);
  });

  it("dm only-foreign request falls back to full district", () => {
    expect(scopeStoresForUser(shaun, ["VJ-FRE"]).stores).toEqual([
      "VJ-HEND",
      "VJ-CULVER",
      "VJ-PB",
    ]);
  });
});

describe("directoryStoreAllowedForSession", () => {
  it("admin sees all directory stores", () => {
    const stores = [
      { storeCode: "VJ-FRE", name: "Fremont" },
      { storeCode: "VJ-HEND", name: "Henderson" },
    ];
    expect(filterDirectoryStoresForSession(kash, stores)).toHaveLength(2);
  });

  it("dm only sees matching storeCode / alias", () => {
    const stores = [
      { storeCode: "VJ-FRE", name: "Fremont" },
      { storeCode: "VJ-HEND", name: "Henderson" },
      { storeCode: null, name: "Culver", aliases: ["VJ-CULVER"] },
    ];
    expect(filterDirectoryStoresForSession(shaun, stores).map((s) => s.name)).toEqual([
      "Henderson",
      "Culver",
    ]);
    expect(directoryStoreAllowedForSession(shaun, stores[0])).toBe(false);
  });
});
