/** Map HR timecard store names to POS store codes used on sales rows. */

const HR_STORE_TO_POS: Record<string, string> = {
  "valley fair": "VJ-VAL",
  oakridge: "VJ-OAK",
  eastridge: "VJ-EAST",
  salinas: "VJ-SAL",
  roseville: "VJ-ROSE",
  "culver city": "VJ-CULVER",
  modesto: "VJ-MOD",
  fresno: "VJ-FRE",
  bakersfield: "VJ-BAKER",
  ontario: "VJ-ONT",
  serramonte: "VJ-SERRA",
  livermore: "VJ-LIV",
  stockton: "DBC-STOCK",
  "great mall": "DBC-GM",
  greatmall: "DBC-GM",
  inland: "VJ-INLND",
  northridge: "VJ-NORTH",
  arden: "VJ-ARDN",
  "santa anita": "VJ-S.ANITA",
  "plaza bonita": "VJ-PB",
  palmdale: "VJ-PALM",
  victorville: "VJ-VICTOR",
  "victor ville": "VJ-VICTOR",
  admin: "Admin",
};

export function posStoreCodeFromHrStore(store: string | null | undefined): string | null {
  const raw = String(store ?? "").trim();
  if (!raw) return null;
  if (/^[A-Z]{2,3}-[A-Z0-9.]+$/i.test(raw) || raw === "Admin") return raw.toUpperCase() === "ADMIN" ? "Admin" : raw.toUpperCase();
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return HR_STORE_TO_POS[key] ?? null;
}

function titleCaseStoreName(name: string): string {
  if (name === "greatmall") return "Great Mall";
  return name
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Reverse of posStoreCodeFromHrStore — VJ-VAL → "Valley Fair". */
export function hrStoreNameFromPosCode(code: string | null | undefined): string | null {
  const raw = String(code ?? "").trim();
  if (!raw) return null;
  for (const [name, pos] of Object.entries(HR_STORE_TO_POS)) {
    if (name === "greatmall") continue;
    if (pos === raw || pos.toUpperCase() === raw.toUpperCase()) {
      return titleCaseStoreName(name);
    }
  }
  return raw;
}
