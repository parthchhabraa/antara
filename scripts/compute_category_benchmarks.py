#!/usr/bin/env python3
"""
Antara Category Benchmark Computer

Reads every document in Firestore's `survey_responses` collection (added
2026-08-21, schema_version 2 — a real teen spending survey, not synthetic
data) and computes, per category:
  - benchmark_pct: that category's share of total reported spend across all
    respondents (what the ML cold-start heuristic uses to judge "is this
    category getting an unusually large share").
  - median_spend_inr: the median reported amount for that category across
    respondents (including zeros — this deliberately answers "what does a
    typical respondent report here," not "what do people who spend here at
    all report," since most categories in category_spend are 0 for most
    respondents).
  - sample_size: how many survey responses this was computed from — always
    print/store this alongside the numbers themselves, because n=3 (today's
    actual count) is a genuinely thin sample and any consumer of these
    numbers needs to know that, not just see a confident-looking percentage.

Writes the result to Firestore `admin/categoryBenchmarks` (audit trail: what
was computed, from how many responses, when) AND prints a Python dict
snippet ready to paste into backend/app/ml/engine.py's CATEGORIES_METADATA —
deliberately not auto-patching that file, since the benchmark numbers are a
product/data decision worth a human glance before they start driving what
users are told, not just a mechanical find-and-replace.

Re-run this whenever survey_responses grows meaningfully, and manually
refresh engine.py's CATEGORIES_METADATA with the new output.
"""

import sys
import json
import statistics
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import firestore, credentials

# The survey's own category_spend field names ARE the category ids used
# throughout the app as of the 2026-08-21 taxonomy realignment — see
# frontend/src/lib/constants.ts's STARTER_CATEGORIES for the full mapping
# from the old (pre-realignment) ids to these.
SURVEY_CATEGORY_KEYS = [
    "food-snacks", "mobile-recharge", "subscriptions", "movies-entertainment",
    "charity-donations", "gaming-inapp", "fitness", "gifting-friends",
    "clothes-shoes", "tech-gadgets", "transportation", "grooming", "books",
    "fantasy-betting", "tuition-coaching", "investments", "dates-outings",
]


def compute_benchmarks(cred_path=None):
    if not firebase_admin._apps:
        if cred_path:
            firebase_admin.initialize_app(credentials.Certificate(cred_path))
        else:
            firebase_admin.initialize_app()

    db = firestore.client()
    responses = [d.to_dict() for d in db.collection("survey_responses").stream()]
    n = len(responses)
    if n == 0:
        print("[!] No survey responses found — nothing to compute. Leaving benchmarks as-is.")
        return

    per_category_amounts = {k: [] for k in SURVEY_CATEGORY_KEYS}
    grand_total = 0.0
    for r in responses:
        spend = r.get("category_spend", {})
        for k in SURVEY_CATEGORY_KEYS:
            amt = float(spend.get(k, 0) or 0)
            per_category_amounts[k].append(amt)
            grand_total += amt

    results = {}
    for k in SURVEY_CATEGORY_KEYS:
        amounts = per_category_amounts[k]
        cat_total = sum(amounts)
        benchmark_pct = round(cat_total / grand_total, 4) if grand_total > 0 else 0.0
        median_spend = round(statistics.median(amounts), 2) if amounts else 0.0
        results[k] = {
            "benchmark_pct": benchmark_pct,
            "median_spend_inr": median_spend,
            "total_reported": cat_total,
            "sample_size": n,
        }

    doc_ref = db.collection("admin").document("categoryBenchmarks")
    doc_ref.set({
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "sample_size": n,
        "categories": results,
    })

    print(f"[*] Computed benchmarks from {n} survey response(s), grand total ₹{grand_total:.0f}")
    print(f"[*] Written to Firestore: admin/categoryBenchmarks")
    if n < 20:
        print(f"[!] n={n} is a thin sample — treat these as directional, not final, and re-run as more responses arrive.")
    print()
    print("--- Paste into backend/app/ml/engine.py's CATEGORIES_METADATA (benchmark_pct / median_spend_inr only) ---")
    for k, v in sorted(results.items(), key=lambda kv: -kv[1]["benchmark_pct"]):
        print(f'    "{k}": benchmark_pct={v["benchmark_pct"]}, median_spend_inr={v["median_spend_inr"]}  # n={v["sample_size"]}, total=₹{v["total_reported"]:.0f}')


if __name__ == "__main__":
    cred = sys.argv[1] if len(sys.argv) > 1 else None
    compute_benchmarks(cred)
