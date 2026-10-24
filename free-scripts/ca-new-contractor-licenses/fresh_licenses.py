#!/usr/bin/env python3
"""Filter the CSLB master license CSV to recently issued licenses."""
import argparse, csv, sys
from datetime import datetime, timedelta

FORMATS = ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y", "%Y%m%d")


def parse(s):
    s = (s or "").strip()
    for f in FORMATS:
        try:
            return datetime.strptime(s, f)
        except ValueError:
            pass
    return None


def find(headers, *keys):
    for h in headers:
        if any(k in h.lower().replace("-", "").replace("_", "").replace(" ", "") for k in keys):
            return h
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_file")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--city", default="")
    a = ap.parse_args()
    cutoff = datetime.now() - timedelta(days=a.days)
    with open(a.csv_file, newline="", encoding="utf-8-sig", errors="replace") as f:
        r = csv.DictReader(f)
        issue = find(r.fieldnames, "issuedate", "issued")
        city = find(r.fieldnames, "city")
        if not issue:
            sys.exit("No issue-date column found. Headers: %s" % r.fieldnames)
        w = csv.DictWriter(sys.stdout, fieldnames=r.fieldnames)
        w.writeheader()
        n = 0
        for row in r:
            d = parse(row.get(issue))
            if not d or d < cutoff:
                continue
            if a.city and city and a.city.lower() not in (row.get(city) or "").lower():
                continue
            w.writerow(row)
            n += 1
    sys.stderr.write("%d licenses issued in the last %d days\n" % (n, a.days))


if __name__ == "__main__":
    main()
