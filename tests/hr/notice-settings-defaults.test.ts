import { describe, expect, it } from "vitest";
import {
  defaultHrNoticeSettings,
  resolveWarningChatFrom,
} from "@/lib/hr/notice-settings";

describe("hr notice settings defaults", () => {
  it("defaults warning chat sender to raza, not SMTP mailbox", () => {
    const defaults = defaultHrNoticeSettings();
    expect(defaults.warningFrom).toBe("raza@valliani.app");
    if (defaults.writeUpFrom) {
      expect(defaults.warningFrom.toLowerCase()).not.toBe(
        defaults.writeUpFrom.toLowerCase()
      );
    }
  });

  it("never uses the employee UserEmail as warning chat sender", () => {
    expect(
      resolveWarningChatFrom("naveed@valliani.app", [
        "naveed@valliani.app",
        "muqeet@example.com",
      ])
    ).toBe("raza@valliani.app");
    expect(
      resolveWarningChatFrom("raza@valliani.app", ["naveed@valliani.app"])
    ).toBe("raza@valliani.app");
  });
});
