import { describe, expect, it } from "vitest";
import {
  canonicalPaycode,
  canonicalizePaycodeList,
  leakedPaycodeAliases,
  paycodeMatchesFilterQuery,
  sortPaycodeLabels,
} from "@/lib/sales/paycode-normalize";

describe("canonicalPaycode", () => {
  it("uses the token after the store hyphen", () => {
    expect(canonicalPaycode("VJS-CASH")).toBe("CASH");
    expect(canonicalPaycode("VJE-CC")).toBe("CC");
    expect(canonicalPaycode("BB - CC")).toBe("CC");
    expect(canonicalPaycode("VJST - MULBRY")).toBe("MULBRY");
    expect(canonicalPaycode("CASH")).toBe("CASH");
    expect(canonicalPaycode("CORP-CHK")).toBe("CHK");
  });

  it("does not treat store prefixes as paycodes", () => {
    expect(canonicalPaycode("VJF")).toBe("");
    expect(canonicalPaycode("VIS")).toBe("");
    expect(canonicalPaycode("VJPB")).toBe("");
    expect(canonicalPaycode("VJS")).toBe("");
  });

  it("folds IDEA + IDEAL + IDDEAL into IDDEAL", () => {
    expect(canonicalPaycode("VJE-IDDEAL")).toBe("IDDEAL");
    expect(canonicalPaycode("DBCST-IDEA")).toBe("IDDEAL");
    expect(canonicalPaycode("VJSL-IDEAL")).toBe("IDDEAL");
    expect(canonicalPaycode("IDEA")).toBe("IDDEAL");
  });

  it("folds SYNC + SYNY + Synchrony truncations into SYNC", () => {
    expect(canonicalPaycode("BB-SYNC")).toBe("SYNC");
    expect(canonicalPaycode("VJRE-SYNY")).toBe("SYNC");
    expect(canonicalPaycode("VJA-SYNCHY")).toBe("SYNC");
    expect(canonicalPaycode("VJV-SYNCH")).toBe("SYNC");
    expect(canonicalPaycode("VJCL-SYNCY")).toBe("SYNC");
    expect(canonicalPaycode("VJVF-SYCHY")).toBe("SYNC");
    expect(canonicalPaycode("VJCH-SYNCHRONY")).toBe("SYNC");
    expect(canonicalPaycode("BB-SYNCHRO")).toBe("SYNC");
  });

  it("folds PROG + PROGR + PROGRE + PROGRESSIVE into PROG", () => {
    expect(canonicalPaycode("VJB-PROG")).toBe("PROG");
    expect(canonicalPaycode("HD-PROGR")).toBe("PROG");
    expect(canonicalPaycode("VJF-PROGRE")).toBe("PROG");
    expect(canonicalPaycode("VJLV-PROGRESSIVE")).toBe("PROG");
  });

  it("folds ACIMA + ACIM into ACIMA", () => {
    expect(canonicalPaycode("VJSO-ACIMA")).toBe("ACIMA");
    expect(canonicalPaycode("DBCST-ACIM")).toBe("ACIMA");
    expect(canonicalPaycode("ACIM")).toBe("ACIMA");
  });

  it("folds AFFIRM + AFFR + AFRIM into AFFIRM", () => {
    expect(canonicalPaycode("DES-AFFIRM")).toBe("AFFIRM");
    expect(canonicalPaycode("DBCST-AFFR")).toBe("AFFIRM");
    expect(canonicalPaycode("VJST-AFRIM")).toBe("AFFIRM");
    expect(canonicalPaycode("AFRIM")).toBe("AFFIRM");
  });

  it("folds WELLS + WELL + WELS + WELLS FARGO into WELLS", () => {
    expect(canonicalPaycode("VJO-WELLS")).toBe("WELLS");
    expect(canonicalPaycode("VJPB-WELL")).toBe("WELLS");
    expect(canonicalPaycode("DBCST-WELS")).toBe("WELLS");
    expect(canonicalPaycode("VJST-WELLS FARGO")).toBe("WELLS");
    expect(canonicalPaycode("WELLS FARGO")).toBe("WELLS");
    expect(canonicalPaycode("VJPB-WE")).toBe("WELLS");
  });

  it("dedupes mixed raw + canonical selections", () => {
    expect(canonicalizePaycodeList(["VJE-IDDEAL", "IDEA", "IDDEAL", "VJS-CASH"])).toEqual([
      "IDDEAL",
      "CASH",
    ]);
  });

  it("orders the named methods first in the filter list", () => {
    expect(sortPaycodeLabels(["GE", "ACIMA", "CASH", "IDDEAL", "WELLS"])).toEqual([
      "CASH",
      "IDDEAL",
      "GE",
      "ACIMA",
      "WELLS",
    ]);
  });

  it("filter search matches POS truncations to the canonical option", () => {
    expect(paycodeMatchesFilterQuery("ACIMA", "acim")).toBe(true);
    expect(paycodeMatchesFilterQuery("AFFIRM", "affr")).toBe(true);
    expect(paycodeMatchesFilterQuery("AFFIRM", "afrim")).toBe(true);
    expect(paycodeMatchesFilterQuery("WELLS", "wels")).toBe(true);
    expect(paycodeMatchesFilterQuery("WELLS", "wells fargo")).toBe(true);
    expect(paycodeMatchesFilterQuery("SYNC", "syny")).toBe(true);
    expect(paycodeMatchesFilterQuery("SYNC", "synchro")).toBe(true);
    expect(paycodeMatchesFilterQuery("WELLS", "we")).toBe(true);
    expect(paycodeMatchesFilterQuery("CASH", "affr")).toBe(false);
  });

  it("flags POS truncations that must not appear as filter labels", () => {
    expect(leakedPaycodeAliases(["ACIMA", "ACIM", "AFFIRM", "AFFR", "WELLS", "WELS", "WE", "SYNCHRO"])).toEqual([
      "ACIM",
      "AFFR",
      "WELS",
      "WE",
      "SYNCHRO",
    ]);
  });
});
