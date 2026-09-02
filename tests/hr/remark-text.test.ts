import { describe, expect, it } from "vitest";
import { replySubjectForThread, stripQuotedReply } from "@/lib/hr/remark-text";

const quoted = `I understand ,
Sorry for delay

On Thu, Sep 3, 2026 at 2:34 AM <umairj@valliani.app> wrote:

> Please see the attached Employee Warning Notice (PDF):
> *Employee-Warning-Notice-JA4-2026-06-07.pdf*
>
> Acosta, Jesus A — Late Arrival by 32 minutes.
>
> Reply to this email if you have remarks.
>`;

describe("stripQuotedReply", () => {
  it("keeps only the employee reply and drops the quoted original", () => {
    expect(stripQuotedReply(quoted)).toBe("I understand ,\nSorry for delay");
  });

  it("handles a narrow no-break space in Gmail timestamps", () => {
    const raw = `Alright, I understand actually i was stuck in traffic\n\nOn Thu, Sep 3, 2026 at 2:19\u202fAM <umairj@valliani.app> wrote:\n\n> VALLIANI JEWELERS`;
    expect(stripQuotedReply(raw)).toBe(
      "Alright, I understand actually i was stuck in traffic"
    );
  });

  it("drops leftover > quoted lines", () => {
    expect(stripQuotedReply("Thanks\n> old line\n> more")).toBe("Thanks");
  });
});

describe("replySubjectForThread", () => {
  it("prefixes Re: once", () => {
    expect(replySubjectForThread("[HR-LATE-JA4-2026-06-07] Employee Warning Notice — Acosta, Jesus A")).toBe(
      "Re: [HR-LATE-JA4-2026-06-07] Employee Warning Notice — Acosta, Jesus A"
    );
    expect(replySubjectForThread("Re: already")).toBe("Re: already");
  });
});
