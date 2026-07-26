import csv
import datetime
from pathlib import Path

p = Path(r"c:\Users\ACCTON-PC-KM-MR-60\Downloads\sale thru 1-jan-26  to  25-july-26.CSV")

def num(v: str) -> float:
    s = str(v or "").strip().replace(",", "").replace('"', "").replace("$", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s) if s else 0.0
    except ValueError:
        return 0.0

with p.open(newline="", encoding="utf-8-sig", errors="replace") as f:
    r = csv.DictReader(f)
    row = next(r)
    for k in [
        "Store",
        "Total",
        "Profit Amount",
        "Salespersons",
        "Qty",
        "Inventory Cost",
        "Transaction Date",
        "Vendor Model",
    ]:
        print(repr(k), "=>", repr(row.get(k)))

with p.open(newline="", encoding="utf-8-sig", errors="replace") as f:
    r = csv.DictReader(f)
    parsed = []
    for row in r:
        d = row.get("Transaction Date") or ""
        try:
            m, d2, y = d.split("/")
            parsed.append(datetime.date(int(y), int(m), int(d2)))
        except Exception:
            pass
    print("min", min(parsed), "max", max(parsed), "count", len(parsed))

with p.open(newline="", encoding="utf-8-sig", errors="replace") as f:
    r = csv.DictReader(f)
    jrs = []
    for row in r:
        if (row.get("Vendor Model") or "").strip().upper() == "JRS90653FG4WXENQ4":
            jrs.append(
                (
                    row.get("Transaction Date"),
                    row.get("SKU  #"),
                    row.get("Qty"),
                    num(row.get("Total")),
                    num(row.get("Inventory Cost")),
                    num(row.get("Profit Amount")),
                    row.get("Salespersons"),
                    row.get("Store"),
                )
            )
    print("jrs lines", len(jrs))
    for x in jrs:
        print(x)
    tot = sum(x[3] for x in jrs)
    cost = sum(x[4] for x in jrs)
    prof = sum(x[5] for x in jrs)
    print(
        "sum total",
        tot,
        "sum cost",
        cost,
        "sum profit amt",
        prof,
        "calc total-cost",
        tot - cost,
        "margin",
        (prof / tot) if tot else None,
    )
