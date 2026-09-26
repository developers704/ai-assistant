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

  it("replaces Irtiza Manager with IT Head and keeps a single card", () => {
    const google: Contact[] = [
      {
        id: "g-irtiza",
        name: "Irtiza Manager",
        role: "Manager",
        company: "Valliani Jewelers",
        email: "irtiza@example.com",
        phone: "+1 (408) 555-0100",
        isImportant: false,
      },
    ];
    const directory: Contact[] = [
      ...team,
      {
        id: "c36",
        name: "Irtiza",
        role: "IT Head",
        company: "Valliani Jewelers",
        email: "irtaza@valliani.app",
        isImportant: true,
      },
    ];
    const merged = mergeContactLists(directory, google);
    const irtiza = merged.filter((c) => c.name === "Irtiza");
    expect(irtiza).toHaveLength(1);
    expect(irtiza[0]?.role).toBe("IT Head");
    expect(irtiza[0]?.phone).toBe("+1 (408) 555-0100");
    expect(merged.some((c) => c.role === "Manager" && /irtiz/i.test(c.name))).toBe(false);
  });
});
