import { describe, expect, it } from "vitest";
import {
  ADEEL_STORES,
  AJ_STORES,
  ROZINA_STORES,
  SHAUN_STORES,
  findAuthUser,
  getAllowedStoreCodes,
} from "@/lib/auth/users";
import { withLiveStoreAccess } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/session-token";

describe("AJ store access", () => {
  it("includes Shaun stores and excludes Adeel and Rozina", () => {
    const aj = findAuthUser("aj");
    expect(aj).not.toBeNull();
    const codes = getAllowedStoreCodes(aj!);
    expect(codes).toEqual([...AJ_STORES, ...SHAUN_STORES]);
    for (const code of [...ADEEL_STORES, ...ROZINA_STORES]) {
      expect(codes).not.toContain(code);
    }
    expect(codes).toContain("VJ-CULVER");
    expect(codes).toContain("VJ-FRE");
  });

  it("leaves Shaun on Shaun stores only", () => {
    const shaun = findAuthUser("shaun");
    expect(shaun).not.toBeNull();
    const codes = getAllowedStoreCodes(shaun!);
    expect(codes).toEqual([...SHAUN_STORES]);
    expect(codes).not.toContain("VJ-FRE");
    expect(codes).not.toContain("DE-SOUTH");
    expect(codes).not.toContain("VJ-VIS");
  });

  it("refreshes a stale AJ cookie to the live store list", () => {
    const stale: SessionPayload = {
      sub: "aj",
      username: "aj",
      name: "AJ",
      role: "dm",
      title: "District Manager",
      storeCodes: [...AJ_STORES],
    };
    const live = withLiveStoreAccess(stale);
    expect(live?.storeCodes).toContain("VJ-HEND");
    expect(live?.storeCodes).toContain("VJ-PALM");
    expect(live?.storeCodes).not.toContain("DE-SOUTH");
    expect(live?.storeCodes).not.toContain("VJ-VIS");
    expect(live?.storeCodes).toHaveLength(AJ_STORES.length + SHAUN_STORES.length);
  });
});
