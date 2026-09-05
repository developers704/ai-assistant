import { afterEach, describe, expect, it } from "vitest";
import {
  applyUserDirectory,
  deleteDirectoryUser,
  isProtectedUsername,
  patchDirectoryUser,
  writeDirectoryUser,
} from "@/lib/auth/user-directory-store";
import { findAuthUser, listAuthUsers, type AuthUserRecord } from "@/lib/auth/users";

const TEST_USER: AuthUserRecord = {
  username: "cursor-test-admin-user",
  name: "Cursor Test User",
  email: "cursor-test-admin-user@valliani.app",
  passwordHash: "x",
  role: "employee",
  storeCodes: ["VJ-OAK"],
  title: "Employee",
  employeeCode: "CT1",
  designation: "Sales Associate",
};

afterEach(() => {
  deleteDirectoryUser(TEST_USER.username);
});

describe("dynamic user directory", () => {
  it("protects Kash from delete/demote helpers", () => {
    expect(isProtectedUsername("kash")).toBe(true);
    expect(isProtectedUsername("Kash")).toBe(true);
    expect(isProtectedUsername("admin")).toBe(false);
    expect(deleteDirectoryUser("kash")).toBe(false);
    expect(findAuthUser("kash")?.role).toBe("admin");
  });

  it("shows security guards under their real names", () => {
    expect(findAuthUser("notfound2@gmail.com")?.name).toBe("Muhammad Aleem");
    expect(findAuthUser("notfound1@gmail.com")?.name).toBe("Syed Muqeet Asim");
    expect(listAuthUsers().some((u) => /^(\d+)\s*,?\s*security guard$/i.test(u.name))).toBe(false);
  });

  it("creates, edits, and deletes overlay users on top of builtins", () => {
    expect(findAuthUser(TEST_USER.username)).toBeNull();
    writeDirectoryUser(TEST_USER);
    expect(findAuthUser(TEST_USER.username)?.name).toBe("Cursor Test User");
    expect(findAuthUser(TEST_USER.username)?.employeeCode).toBe("CT1");

    patchDirectoryUser(findAuthUser(TEST_USER.username)!, {
      name: "Cursor Test Edited",
      role: "hr",
      designation: "HR Manager",
    });
    expect(findAuthUser(TEST_USER.username)?.name).toBe("Cursor Test Edited");
    expect(findAuthUser(TEST_USER.username)?.role).toBe("hr");

    expect(deleteDirectoryUser(TEST_USER.username)).toBe(true);
    expect(findAuthUser(TEST_USER.username)).toBeNull();
    const merged = applyUserDirectory(listAuthUsers());
    expect(merged.some((u) => u.username === TEST_USER.username)).toBe(false);
  });
});
