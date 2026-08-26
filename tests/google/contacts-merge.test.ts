import { describe, expect, it } from "vitest";
import type { Contact } from "@/types";
import { mergeContactLists } from "@/lib/google/contacts";

const team: Contact[] = [
  {
    id: "c1",
    name: "Ross",
    role: "Global Director",
    company: "Valliani",
    phone: "+1 (510) 298-6571",
    isImportant: true,
  },
];

describe("mergeContactLists", () => {
  it("keeps team contacts when Google sync is empty", () => {
    expect(mergeContactLists(team, [])).toEqual(team);
  });

  it("appends Google contacts and dedupes by matching email", () => {
    const teamWithEmail: Contact[] = [
      {
        ...team[0],
        email: "ross@valliani.com",
      },
    ];
    const google: Contact[] = [
      {
        id: "g1",
        name: "Ross Valliani",
        role: "",
        company: "",
        email: "ross@valliani.com",
        isImportant: false,
      },
      {
        id: "g2",
        name: "Jane Doe",
        role: "Vendor",
        company: "Acme",
        email: "jane@example.com",
        isImportant: false,
      },
    ];
    const merged = mergeContactLists(teamWithEmail, google);
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.name)).toEqual(["Jane Doe", "Ross"]);
  });
});
