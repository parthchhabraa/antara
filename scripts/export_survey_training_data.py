#!/usr/bin/env python3
"""
Antara Survey -> ML Training Data Exporter

Pulls every document out of the public `survey_responses` Firestore
collection and flattens it into a CSV + JSONL pair that's ready to hand to
a notebook, pandas, or straight into a training script — no Firestore
client needed downstream.

Usage:
    python3 scripts/export_survey_training_data.py [--cred path/to/serviceAccountKey.json]
                                                     [--out-dir ./survey_export]
                                                     [--format csv|jsonl|both]

Auth: same convention as scripts/set_superadmin.py — pass --cred, or set
GOOGLE_APPLICATION_CREDENTIALS, or rely on default credentials if you're
already `gcloud auth application-default login`'d.

On sample size: Antara's cold-start heuristic engine (backend/app/ml/engine.py,
CATEGORIES_METADATA) currently uses guessed `median_spend_inr` /
`benchmark_pct` values per category. Once you have ~100 real responses,
this export gives you enough to replace those guesses with real per-category
medians (grouped by demographics.city_tier / pocket_money_range if you want
segment-level numbers instead of one global median). Below ~100 responses,
treat any derived stats as directional, not authoritative — the categories
with the fewest respondents will be the noisiest.
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore

COLLECTION = "survey_responses"

# Keep this in sync with SURVEY_CATEGORIES ids in
# frontend/src/lib/surveyConstants.ts — used only to give every row the same
# flat set of category_* columns (missing categories in a doc default to 0
# rather than leaving a ragged CSV).
CATEGORY_IDS = [
    "food-snacks",
    "tech-gadgets",
    "subscriptions",
    "grooming",
    "clothes-shoes",
    "gifting-friends",
    "dates-outings",
    "transportation",
    "investments",
    "fitness",
    "mobile-recharge",
    "books",
    "gaming-inapp",
    "tuition-coaching",
    "movies-entertainment",
    "fantasy-betting",
    "charity-donations",
]

DEMOGRAPHIC_FIELDS = ["age_range", "gender", "city_tier", "pocket_money_range", "family_income_bracket"]
HABIT_FIELDS = ["payment_method", "pocket_money_duration", "tracks_spending"]


def init_firebase(cred_path=None):
    if firebase_admin._apps:
        return
    project_id = os.getenv("FIREBASE_PROJECT_ID", "antara-moneycontrol")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"projectId": project_id})
    else:
        try:
            firebase_admin.initialize_app(options={"projectId": project_id})
        except Exception as e:
            print(f"Error initializing Firebase Admin SDK: {e}")
            print("Pass --cred <path_to_service_account.json>, or set GOOGLE_APPLICATION_CREDENTIALS.")
            sys.exit(1)


def flatten(doc_id: str, data: dict) -> dict:
    demographics = data.get("demographics") or {}
    habits = data.get("habits") or {}
    category_spend = data.get("category_spend") or {}
    meta = data.get("meta") or {}
    submitted_at = data.get("submitted_at")

    row = {
        "response_id": doc_id,
        "schema_version": data.get("schema_version"),
        "submitted_at": submitted_at.isoformat() if hasattr(submitted_at, "isoformat") else submitted_at,
    }
    for field in DEMOGRAPHIC_FIELDS:
        row[f"demo_{field}"] = demographics.get(field)
    for field in HABIT_FIELDS:
        row[f"habit_{field}"] = habits.get(field)
    for cat_id in CATEGORY_IDS:
        row[f"category_{cat_id}"] = category_spend.get(cat_id, 0)
    row["category_spend_total"] = sum(category_spend.get(c, 0) or 0 for c in CATEGORY_IDS)
    row["other_spend_note"] = data.get("other_spend_note")
    row["meta_completion_seconds"] = meta.get("completion_seconds")
    row["meta_source"] = meta.get("source")
    # Deliberately excluded: beta_email. It's operational (beta-invite) data,
    # not a spend feature, and there's no reason a training export should
    # carry PII around.
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cred", default=None, help="Path to a Firebase service account JSON key")
    parser.add_argument("--out-dir", default="./survey_export", help="Output directory (default: ./survey_export)")
    parser.add_argument("--format", choices=["csv", "jsonl", "both"], default="both")
    args = parser.parse_args()

    init_firebase(args.cred)
    db = firestore.client()

    print(f"[*] Fetching '{COLLECTION}' from project '{os.getenv('FIREBASE_PROJECT_ID', 'antara-moneycontrol')}'...")
    docs = list(db.collection(COLLECTION).stream())
    print(f"[+] Found {len(docs)} responses.")

    if not docs:
        print("[!] Nothing to export yet.")
        sys.exit(0)

    rows = [flatten(d.id, d.to_dict()) for d in docs]

    os.makedirs(args.out_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    if args.format in ("csv", "both"):
        csv_path = os.path.join(args.out_dir, f"survey_responses_{stamp}.csv")
        fieldnames = list(rows[0].keys())
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"[+] Wrote {csv_path}")

    if args.format in ("jsonl", "both"):
        jsonl_path = os.path.join(args.out_dir, f"survey_responses_{stamp}.jsonl")
        with open(jsonl_path, "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"[+] Wrote {jsonl_path}")

    print(f"\n[i] {len(rows)} responses exported.")
    if len(rows) < 100:
        print(
            f"[i] That's under the ~100-response mark — treat per-category medians as "
            f"directional until you're past it (fewer respondents per category = noisier numbers)."
        )
    else:
        print(
            "[i] 100+ responses — enough to start replacing the guessed median_spend_inr / "
            "benchmark_pct values in backend/app/ml/engine.py (CATEGORIES_METADATA) with real ones."
        )


if __name__ == "__main__":
    main()
