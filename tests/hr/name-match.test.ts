import { describe, expect, it } from "vitest";
import { namesMatch, normalizeEmployeeName } from "@/lib/hr/name-match";

describe("HR employee name match", () => {
  it("treats payroll commas and extra middle initials as the same person", () => {
    expect(normalizeEmployeeName("1, security guard")).toBe("1 security guard");
    expect(namesMatch("1, security guard", "1 security guard")).toBe(true);
    expect(namesMatch("Acosta, Jesus A", "Acosta Jesus")).toBe(true);
    expect(namesMatch("Hossain, Mashrik MD", "Hossain Md Mashrik")).toBe(true);
    expect(namesMatch("Adnan, Sayed M", "Adnan Sayed")).toBe(true);
  });

  it("does not invent a match when last or first name disagrees", () => {
    expect(namesMatch("Jivani, Fayaz", "Jivani Akberali")).toBe(false);
    expect(namesMatch("Javer, Vannalyn Santos", "Javar Vannalyn")).toBe(false);
    expect(namesMatch("Garcia, Lidia R", "Garcia Jorge")).toBe(false);
    expect(namesMatch("1, security guard", "2 Security Guard")).toBe(false);
  });
});
