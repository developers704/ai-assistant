import { refreshSalesData } from "../src/lib/sales/refresh/service";

async function main() {
  const r = await refreshSalesData({ force: true, clearMemory: true });
  console.log(JSON.stringify(r, null, 2));
  if (!r.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
