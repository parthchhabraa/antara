#!/usr/bin/env python3
"""
Antara Categories Seeder
Populates the 12 spending categories into Firestore `categories` collection.
"""

import sys
import os
import firebase_admin
from firebase_admin import firestore, credentials

CATEGORIES = [
    {
        "id": "food-delivery",
        "name": "Food delivery & street food",
        "icon": "Utensils",
        "color": "#F97316", # Orange
        "subcategories": ["Swiggy/Zomato", "Street Food/Chaat", "Cafe & Snacks", "Canteen", "Groceries"],
        "is_essential": False,
        "description": "Daily food, snacks, deliveries, and chai/tiffin."
    },
    {
        "id": "mobile-recharge",
        "name": "Mobile recharge/data",
        "icon": "Smartphone",
        "color": "#3B82F6", # Blue
        "subcategories": ["Jio/Airtel/Vi Prepaid", "Add-on Data Packs", "Family Plan", "Hotspot"],
        "is_essential": True,
        "description": "Mobile plans, data top-ups, and connectivity."
    },
    {
        "id": "subscriptions",
        "name": "OTT & music subscriptions",
        "icon": "Film",
        "color": "#8B5CF6", # Purple
        "subcategories": ["Spotify/Apple Music", "Netflix/Prime", "YouTube Premium", "Discord Nitro", "Cloud Storage"],
        "is_essential": False,
        "description": "Monthly entertainment, audio, and streaming subscriptions."
    },
    {
        "id": "gaming",
        "name": "Gaming (in-app/top-ups)",
        "icon": "Gamepad2",
        "color": "#EC4899", # Pink
        "subcategories": ["BGMI UC", "Valorant Points", "PlayStore Top-up", "Steam Games", "Skins & Passes"],
        "is_essential": False,
        "description": "In-game currency, battle passes, game purchases, and skins."
    },
    {
        "id": "transport",
        "name": "Transport",
        "icon": "Car",
        "color": "#06B6D4", # Cyan
        "subcategories": ["Metro SmartCard", "Auto/Rickshaw", "Uber/Ola", "Bus Pass", "Fuel/Scooty"],
        "is_essential": True,
        "description": "Daily commute, public transport, cabs, and fuel."
    },
    {
        "id": "fashion",
        "name": "Fashion & accessories",
        "icon": "ShoppingBag",
        "color": "#F43F5E", # Rose
        "subcategories": ["Myntra/Ajio/Urbanic", "Thrifting/Streetwear", "Sneakers", "Watches/Jewelry"],
        "is_essential": False,
        "description": "Clothing, sneakers, streetwear, and style accessories."
    },
    {
        "id": "education",
        "name": "Coaching/tuition/exam fees",
        "icon": "GraduationCap",
        "color": "#10B981", # Emerald
        "subcategories": ["Coaching Installments", "Mock Tests & Series", "Exam Application Fees", "Online Courses"],
        "is_essential": True,
        "description": "Tuition, competitive exam prep, registrations, and courses."
    },
    {
        "id": "personal-care",
        "name": "Personal care",
        "icon": "Sparkles",
        "color": "#A855F7", # Indigo
        "subcategories": ["Salon & Haircut", "Skincare & Grooming", "Pharmacy & Health", "Gym/Fitness"],
        "is_essential": False,
        "description": "Grooming, skincare products, haircuts, and fitness."
    },
    {
        "id": "social-gifts",
        "name": "Gifts & social spending",
        "icon": "Gift",
        "color": "#EAB308", # Yellow
        "subcategories": ["Birthday Gifts", "Treats & Group Splits", "Festival Gifting", "Party Contributions"],
        "is_essential": False,
        "description": "Friend celebrations, shared outing splits, and gifts."
    },
    {
        "id": "stationery",
        "name": "Stationery/books",
        "icon": "BookOpen",
        "color": "#14B8A6", # Teal
        "subcategories": ["Notebooks & Pens", "Reference Books", "Photocopy/Printouts", "Novel/Manga"],
        "is_essential": True,
        "description": "Notebooks, stationery, textbooks, and reading."
    },
    {
        "id": "savings",
        "name": "Savings/investment",
        "icon": "PiggyBank",
        "color": "#22C55E", # Green
        "subcategories": ["Emergency Fund", "Digital Gold", "Mutual Funds/SIP", "Pocket Money Savings"],
        "is_essential": True,
        "description": "Money set aside, recurring deposits, or teen investment."
    },
    {
        "id": "miscellaneous",
        "name": "Miscellaneous",
        "icon": "HelpCircle",
        "color": "#64748B", # Slate
        "subcategories": ["Emergency Cash", "ATM Withdrawals", "Repayments", "Uncategorized"],
        "is_essential": False,
        "description": "Ad-hoc expenses, cash withdrawals, and general items."
    }
]

def seed_categories(cred_path=None):
    if not firebase_admin._apps:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
            
    db = firestore.client()
    print("[*] Starting category seeding into Firestore collection 'categories'...")
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
    print("[SUCCESS] All 12 categories seeded successfully!")

if __name__ == "__main__":
    cred = sys.argv[1] if len(sys.argv) > 1 else None
    seed_categories(cred)
