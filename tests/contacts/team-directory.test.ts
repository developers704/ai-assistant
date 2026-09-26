import { describe, expect, it } from "vitest";
import { mockContacts } from "@/lib/mock-data";
import { getDefaultPermissionMapForRole } from "@/lib/auth/user-permissions";

const added = [
  ["Adeel Valliani", "District Manager", "+1 (765) 409-6611"],
  ["Anh Dao", "Corporate Manager", "+1 (408) 591-0648"],
  ["Cecelia", "Palmdale Store Manager", "+1 (323) 633-5984"],
  ["Fayaz Jivani", "Office", "+1 (559) 362-6817"],
  ["Jorge", "Northridge Store Manager", "+1 (805) 746-7656"],
  ["Kevin", "Corporate Manager", "+1 (707) 592-6504"],
  ["Shazia", "Corporate Manager", "+1 (510) 409-8209"],
  ["Zoya Artani", "Salesperson", "+1 (650) 519-7938"],
  ["Rosela", "Ontario Store Manager", "+1 (619) 818-0579"],
  ["Robert Camacho", "Bakersfield Store Manager", "+1 (408) 518-9137"],
  ["Lynette", "Valley Fair Store Manager", "+1 (510) 509-0943"],
  ["Lalith Samararathnage", "Corporate Manager", "+1 (203) 841-6289"],
  ["Alexzandra Reyes", "Victorville Store Manager", "+1 (562) 351-6038"],
  ["Shakib Nakhwa", "Arden Store Manager", "+1 (408) 768-2480"],
  ["Aurelia Silva", "Eastridge Store Manager", "+1 (408) 912-4665"],
  ["Maria Beth", "Serramonte Store Manager", "+1 (650) 430-9756"],
  ["Cynthia", "Salinas Store Manager", "+1 (831) 540-8042"],
  ["Issah Salameh", "Inland Store Manager", "+1 (951) 732-6633"],
  ["Lourdes Vilchis", "Fresno Store Manager", "+1 (559) 270-2121"],
  ["Maria Morales", "Modesto Store Manager", "+1 (650) 862-3881"],
  ["Steven Rosales", "Culver City Store Manager", "+1 (209) 688-6243"],
  ["Syed", "Plaza Bonita Store Manager", "+1 (341) 465-7118"],
  ["Fahad", "Oakridge Store Manager", "+1 (510) 253-8463"],
  ["Jhovelyn", "Chandler Store Manager", "+1 (415) 988-0472"],
  ["Joyce Bermudez", "Stockton Store Manager", "+1 (209) 373-5546"],
  ["Omar Siddique", "Roseville Store Manager", "+1 (925) 550-3030"],
] as const;

describe("shared team contacts", () => {
  it("includes every added manager with the same phone on WhatsApp", () => {
    for (const [name, role, phone] of added) {
      const contact = mockContacts.find((c) => c.name === name);
      expect(contact, name).toBeTruthy();
      expect(contact?.role).toBe(role);
      expect(contact?.phone).toBe(phone);
      expect(contact?.whatsapp).toBe(phone);
      expect(contact?.company).toBe("Valliani Jewelers");
    }
  });

  it("keeps the earlier directory names", () => {
    expect(mockContacts.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Ross", "Umair", "Shaun", "AJ", "Adeel Valliani", "Omar Siddique"])
    );
  });

  it("opens Contacts for every role", () => {
    for (const role of ["admin", "dm", "hr", "employee"] as const) {
      expect(getDefaultPermissionMapForRole(role).contacts).toBe(true);
    }
  });
});
