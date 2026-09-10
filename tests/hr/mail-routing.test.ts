import { describe, expect, it } from "vitest";
import {
  defaultHrMailRouting,
  formatHrMailTo,
  parseHrMailAddresses,
  validateHrMailRoutingInput,
} from "@/lib/hr/mail-routing";
import { draftWarningNotice } from "@/lib/hr/warning-notice";
import { draftWriteUpNotice } from "@/lib/hr/write-up-notice";

const shazia = {
  employeeName: "Ahmed, Shazia",
  date: "2026-06-07",
  employeeCode: "SA2",
  jobTitle: "Corporate Manager",
  manager: "AJ",
  lateMinutes: 29,
};

describe("HR test mail routing", () => {
  it("parses one From and several To addresses", () => {
    expect(parseHrMailAddresses("umairj@valliani.app")).toEqual(["umairj@valliani.app"]);
    expect(
      parseHrMailAddresses("one@valliani.app, two@gmail.com\nthree@valliani.app; one@valliani.app")
    ).toEqual(["one@valliani.app", "two@gmail.com", "three@valliani.app"]);
  });

  it("rejects empty To and more than one From", () => {
    expect(validateHrMailRoutingInput({ from: "not-an-email", to: "a@b.com" }).ok).toBe(false);
    expect(validateHrMailRoutingInput({ from: "a@b.com", to: "nope" }).ok).toBe(false);
    const ok = validateHrMailRoutingInput({
      from: "sender@valliani.app",
      to: "one@x.com\ntwo@x.com",
    });
    expect(ok).toEqual({
      ok: true,
      routing: { from: "sender@valliani.app", to: ["one@x.com", "two@x.com"] },
    });
  });

  it("applies routing to warning and write-up drafts", () => {
    const routing = {
      from: "tester@valliani.app",
      to: ["alpha@gmail.com", "beta@valliani.app"],
    };
    const warning = draftWarningNotice(shazia, routing);
    expect(warning.from).toBe("tester@valliani.app");
    expect(warning.to).toBe("alpha@gmail.com, beta@valliani.app");
    const writeUp = draftWriteUpNotice(shazia, "Late Arrival by 29 minutes.", routing);
    expect(writeUp.from).toBe("tester@valliani.app");
    expect(writeUp.to).toBe(formatHrMailTo(routing.to));
  });

  it("keeps production defaults when routing is omitted", () => {
    const defaults = defaultHrMailRouting();
    const warning = draftWarningNotice(shazia);
    expect(warning.from).toBe(defaults.from);
    expect(warning.to).toBe(defaults.to[0]);
  });
});
