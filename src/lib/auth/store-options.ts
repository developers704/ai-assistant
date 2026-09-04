import { STORES } from "@/lib/inventory/types";
import { getAllStores } from "@/lib/stores/store-directory";

export function listUserStoreOptions(): { code: string; label: string }[] {
  const fromDir = getAllStores()
    .map((s) => {
      const code = (s.storeCode || "").trim();
      if (!code) return null;
      const name = s.mall || s.name || code;
      return { code, label: `${code} · ${name}` };
    })
    .filter((x): x is { code: string; label: string } => Boolean(x));

  const seen = new Set(fromDir.map((s) => s.code));
  const extras = STORES.filter((code) => !seen.has(code)).map((code) => ({
    code,
    label: code,
  }));
  const extraSpecial = [
    { code: "Admin", label: "Admin" },
    { code: "NA", label: "NA" },
  ].filter((s) => !seen.has(s.code));

  return [...fromDir, ...extras, ...extraSpecial].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}
