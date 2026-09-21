import { describe, expect, it } from "vitest";
import { parseInventoryCsv } from "@/lib/inventory/parse-csv";

describe("inventory CSV Image Dir", () => {
  it("maps Image Dir. and forces jpg to webp like sales", () => {
    const csv = [
      "SKU #,Item Desc,Vendor Model,Vendor,Individual Selling Value,Individual Cost Value,Whole Cost,Store,On-Hand,Department,Design,Class,Sub-Class,Image Dir.",
      '231443,14KT RING,RR8179WS,RCN,1719,761,400,VJ-SERRA,2,LADYS RING,NOVELLO,14KT,BIRTHSTONE,\\191402.jpg',
    ].join("\n");
    const rows = parseInventoryCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.imageDir).toBe("\\191402.webp");
  });
});
