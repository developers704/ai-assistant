import { describe, expect, it } from "vitest";
import { defaultHrNoticeSettings } from "@/lib/hr/notice-settings";

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
});
