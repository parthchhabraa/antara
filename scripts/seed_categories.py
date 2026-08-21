#!/usr/bin/env python3
"""
Antara Categories Seeder
Populates the spending categories into Firestore `categories` collection.

Realigned 2026-08-21 to match the real teen spending survey's actual
Firestore field ids (`survey_responses.{doc}.category_spend`) — see
frontend/src/lib/constants.ts for the full old-id -> new-id mapping and the
reasoning (renames, merges, and genuinely new categories the survey covers
that nothing existed for before: movies-entertainment, charity-donations,
fantasy-betting). Kept in sync with that file and backend/app/ml/engine.py's
CATEGORIES_METADATA. Still doesn't seed monthly_cap (never did, even
pre-realignment) — that only lives in constants.ts, where it's set from real
survey medians for the categories that have one yet.

This re-seed also deletes the stale pre-realignment category docs (the old
ids like "gaming", "transport", "fashion" etc.) so the `categories`
collection doesn't end up with both the old and new id sets sitting side by
side — see delete_stale_categories() below.
"""

import sys
import os
import firebase_admin
from firebase_admin import firestore, credentials

CATEGORIES = [
    {
        "id": "food-snacks",
        "name": "Food, drinks & snacks",
        "icon": "Utensils",
        "color": "#F97316",
        "subcategories": ["Swiggy/Zomato", "Street Food/Chaat", "Chips & Cold Drinks", "Cafe & Snacks", "Groceries"],
        "is_essential": False,
        "description": "Daily food, drinks, snacks, deliveries, and chai/tiffin."
    },
    {
        "id": "dates-outings",
        "name": "Dating & going out",
        "icon": "Heart",
        "color": "#FB7185",
        "subcategories": ["Cafes/Restaurants Together", "Outing Tickets"],
        "is_essential": False,
        "description": "Spending on dates or outings with friends — separate from solo food or movies."
    },
    {
        "id": "clothes-shoes",
        "name": "Clothes & shoes",
        "icon": "ShoppingBag",
        "color": "#F43F5E",
        "subcategories": ["Myntra/Ajio/Urbanic", "Thrifting/Streetwear", "Sneakers", "Watches/Jewelry"],
        "is_essential": False,
        "description": "Clothing, sneakers, streetwear, and style accessories."
    },
    {
        "id": "gifting-friends",
        "name": "Gifts & money to friends",
        "icon": "HandCoins",
        "color": "#EAB308",
        "subcategories": ["Birthday Gifts", "Lent to a Friend", "Splitting a Bill Upfront", "Festival Gifting"],
        "is_essential": False,
        "description": "Cash, UPI, or gifts to friends — lending, splitting a bill, or giving something for an occasion."
    },
    {
        "id": "fitness",
        "name": "Fitness & fitness products",
        "icon": "Dumbbell",
        "color": "#84CC16",
        "subcategories": ["Gym Membership", "Sports Gear", "Fitness Classes", "Protein Powder & Supplements"],
        "is_essential": False,
        "description": "Gym memberships, sports gear, fitness classes, and supplements."
    },
    {
        "id": "transportation",
        "name": "Transportation",
        "icon": "Car",
        "color": "#06B6D4",
        "subcategories": ["Metro SmartCard", "Auto/Rickshaw", "Uber/Ola", "Bus Pass", "Fuel/Scooty"],
        "is_essential": True,
        "description": "Daily commute, public transport, cabs, and fuel."
    },
    {
        "id": "grooming",
        "name": "Grooming & personal care",
        "icon": "Sparkles",
        "color": "#A855F7",
        "subcategories": ["Salon & Haircut", "Skincare & Grooming", "Pharmacy & Health"],
        "is_essential": False,
        "description": "Skin, hair, grooming products, and haircuts."
    },
    {
        "id": "subscriptions",
        "name": "OTT & music subscriptions",
        "icon": "Film",
        "color": "#D946EF", # Fuchsia — not #8B5CF6, which is now the brand `primary` token.
        "subcategories": ["Spotify/Apple Music", "Netflix/Prime", "YouTube Premium", "Discord Nitro", "Cloud Storage"],
        "is_essential": False,
        "description": "Monthly entertainment, audio, and streaming subscriptions."
    },
    {
        "id": "movies-entertainment",
        "name": "Movies & entertainment",
        "icon": "Clapperboard",
        "color": "#F59E0B",
        "subcategories": ["Movie Tickets", "Events/Concerts", "One-off Rentals"],
        "is_essential": False,
        "description": "Movie tickets, events, and one-off entertainment — separate from monthly OTT subscriptions."
    },
    {
        "id": "tech-gadgets",
        "name": "Technology & gadgets",
        "icon": "Laptop",
        "color": "#0EA5E9",
        "subcategories": ["Earphones/Headphones", "Phone Case & Accessories", "Chargers & Cables", "Small Electronics"],
        "is_essential": False,
        "description": "Gadgets, accessories, and small electronics purchases."
    },
    {
        "id": "gaming-inapp",
        "name": "Gaming (in-app/top-ups)",
        "icon": "Gamepad2",
        "color": "#EC4899",
        "subcategories": ["BGMI UC", "Valorant Points", "PlayStore Top-up", "Steam Games", "Skins & Passes"],
        "is_essential": False,
        "description": "In-game currency, battle passes, game purchases, and skins."
    },
    {
        "id": "investments",
        "name": "Investments & savings",
        "icon": "PiggyBank",
        "color": "#22C55E",
        "subcategories": ["Emergency Fund", "Digital Gold", "Mutual Funds/SIP", "Pocket Money Savings"],
        "is_essential": True,
        "description": "Money set aside, recurring deposits, or teen investment."
    },
    {
        "id": "charity-donations",
        "name": "Charity & donations",
        "icon": "HeartHandshake",
        "color": "#F472B6",
        "subcategories": ["Temple/Religious Donations", "NGO/Charity Drives", "Crowdfunding"],
        "is_essential": False,
        "description": "Religious donations, charity drives, and crowdfunding contributions."
    },
    {
        "id": "mobile-recharge",
        "name": "Mobile recharge/data",
        "icon": "Smartphone",
        "color": "#3B82F6",
        "subcategories": ["Jio/Airtel/Vi Prepaid", "Add-on Data Packs", "Family Plan", "Hotspot"],
        "is_essential": True,
        "description": "Mobile plans, data top-ups, and connectivity."
    },
    {
        "id": "books",
        "name": "Books & stationery",
        "icon": "BookOpen",
        "color": "#14B8A6",
        "subcategories": ["Notebooks & Pens", "Reference Books", "Photocopy/Printouts", "Novel/Manga"],
        "is_essential": True,
        "description": "Notebooks, stationery, textbooks, and reading."
    },
    {
        "id": "fantasy-betting",
        "name": "Fantasy sports & betting",
        "icon": "Dices",
        "color": "#EF4444",
        "subcategories": ["Dream11/Fantasy Sports", "Online Betting/Poker"],
        "is_essential": False,
        "description": "Fantasy sports entries and online betting."
    },
    {
        "id": "tuition-coaching",
        "name": "Coaching/tuition/exam fees",
        "icon": "GraduationCap",
        "color": "#10B981",
        "subcategories": ["Coaching Installments", "Mock Tests & Series", "Exam Application Fees", "Online Courses"],
        "is_essential": True,
        "description": "Tuition, competitive exam prep, registrations, and courses."
    },
    {
        "id": "miscellaneous",
        "name": "Miscellaneous",
        "icon": "HelpCircle",
        "color": "#64748B",
        "subcategories": ["Emergency Cash", "ATM Withdrawals", "Repayments", "Uncategorized"],
        "is_essential": False,
        "description": "Ad-hoc expenses, cash withdrawals, and general items not covered by the survey."
    },
]

# Ids from before the 2026-08-21 realignment — deleted so the collection
# doesn't end up carrying both generations of ids side by side.
STALE_PRE_REALIGNMENT_IDS = [
    "food-delivery", "snacks", "gaming", "transport", "fashion", "education",
    "personal-care", "social-gifts", "stationery", "savings", "money-to-friends",
    "dating-outings", "supplements",
]

def seed_categories(cred_path=None):
    if not firebase_admin._apps:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

    db = firestore.client()
    print(f"[*] Starting category seeding into Firestore collection 'categories' ({len(CATEGORIES)} categories)...")
    batch = db.batch()

    for cat in CATEGORIES:
        doc_ref = db.collection("categories").document(cat["id"])
        batch.set(doc_ref, {
            "name": cat["name"],
            "icon": cat["icon"],
            "color": cat["color"],
            "subcategories": cat["subcategories"],
            "is_essential": cat["is_essential"],
            "description": cat["description"],
            "updated_at": firestore.SERVER_TIMESTAMP
        }, merge=True)
        print(f"  -> Queued category: {cat['name']} ({cat['id']})")

    batch.commit()
    print(f"[SUCCESS] All {len(CATEGORIES)} categories seeded successfully!")

    delete_stale_categories(db)

def delete_stale_categories(db):
    existing_ids = {d.id for d in db.collection("categories").stream()}
    to_delete = [cid for cid in STALE_PRE_REALIGNMENT_IDS if cid in existing_ids]
    if not to_delete:
        print("[*] No stale pre-realignment category docs found — nothing to clean up.")
        return
    print(f"[*] Deleting {len(to_delete)} stale pre-realignment category doc(s): {', '.join(to_delete)}")
    batch = db.batch()
    for cid in to_delete:
        batch.delete(db.collection("categories").document(cid))
    batch.commit()
    print("[SUCCESS] Stale category docs removed.")

if __name__ == "__main__":
    cred = sys.argv[1] if len(sys.argv) > 1 else None
    seed_categories(cred)
