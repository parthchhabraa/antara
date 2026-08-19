import { Category, Transaction } from "@/types";

export const STARTER_CATEGORIES: Category[] = [
  {
    id: "food-delivery",
    name: "Food delivery & street food",
    icon: "Utensils",
    color: "#F97316",
    subcategories: ["Swiggy/Zomato", "Street Food/Chaat", "Cafe & Snacks", "Canteen", "Groceries"],
    is_essential: false,
    description: "Daily food, snacks, deliveries, and chai/tiffin."
  },
  {
    id: "mobile-recharge",
    name: "Mobile recharge/data",
    icon: "Smartphone",
    color: "#3B82F6",
    subcategories: ["Jio/Airtel/Vi Prepaid", "Add-on Data Packs", "Family Plan", "Hotspot"],
    is_essential: true,
    description: "Mobile plans, data top-ups, and connectivity."
  },
  {
    id: "subscriptions",
    name: "OTT & music subscriptions",
    icon: "Film",
    color: "#8B5CF6",
    subcategories: ["Spotify/Apple Music", "Netflix/Prime", "YouTube Premium", "Discord Nitro", "Cloud Storage"],
    is_essential: false,
    description: "Monthly entertainment, audio, and streaming subscriptions."
  },
  {
    id: "gaming",
    name: "Gaming (in-app/top-ups)",
    icon: "Gamepad2",
    color: "#EC4899",
    subcategories: ["BGMI UC", "Valorant Points", "PlayStore Top-up", "Steam Games", "Skins & Passes"],
    is_essential: false,
    description: "In-game currency, battle passes, game purchases, and skins."
  },
  {
    id: "transport",
    name: "Transport",
    icon: "Car",
    color: "#06B6D4",
    subcategories: ["Metro SmartCard", "Auto/Rickshaw", "Uber/Ola", "Bus Pass", "Fuel/Scooty"],
    is_essential: true,
    description: "Daily commute, public transport, cabs, and fuel."
  },
  {
    id: "fashion",
    name: "Fashion & accessories",
    icon: "ShoppingBag",
    color: "#F43F5E",
    subcategories: ["Myntra/Ajio/Urbanic", "Thrifting/Streetwear", "Sneakers", "Watches/Jewelry"],
    is_essential: false,
    description: "Clothing, sneakers, streetwear, and style accessories."
  },
  {
    id: "education",
    name: "Coaching/tuition/exam fees",
    icon: "GraduationCap",
    color: "#10B981",
    subcategories: ["Coaching Installments", "Mock Tests & Series", "Exam Application Fees", "Online Courses"],
    is_essential: true,
    description: "Tuition, competitive exam prep, registrations, and courses."
  },
  {
    id: "personal-care",
    name: "Personal care",
    icon: "Sparkles",
    color: "#A855F7",
    subcategories: ["Salon & Haircut", "Skincare & Grooming", "Pharmacy & Health", "Gym/Fitness"],
    is_essential: false,
    description: "Grooming, skincare products, haircuts, and fitness."
  },
  {
    id: "social-gifts",
    name: "Gifts & social spending",
    icon: "Gift",
    color: "#EAB308",
    subcategories: ["Birthday Gifts", "Treats & Group Splits", "Festival Gifting", "Party Contributions"],
    is_essential: false,
    description: "Friend celebrations, shared outing splits, and gifts."
  },
  {
    id: "stationery",
    name: "Stationery/books",
    icon: "BookOpen",
    color: "#14B8A6",
    subcategories: ["Notebooks & Pens", "Reference Books", "Photocopy/Printouts", "Novel/Manga"],
    is_essential: true,
    description: "Notebooks, stationery, textbooks, and reading."
  },
  {
    id: "savings",
    name: "Savings/investment",
    icon: "PiggyBank",
    color: "#22C55E",
    subcategories: ["Emergency Fund", "Digital Gold", "Mutual Funds/SIP", "Pocket Money Savings"],
    is_essential: true,
    description: "Money set aside, recurring deposits, or teen investment."
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    icon: "HelpCircle",
    color: "#64748B",
    subcategories: ["Emergency Cash", "ATM Withdrawals", "Repayments", "Uncategorized"],
    is_essential: false,
    description: "Ad-hoc expenses, cash withdrawals, and general items."
  }
];

export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "demo-tx-1",
    amount: 380,
    category: "food-delivery",
    subcategory: "Swiggy/Zomato",
    note: "Late night burger & shakes with Aryan",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    source: "upi"
  },
  {
    id: "demo-tx-2",
    amount: 299,
    category: "mobile-recharge",
    subcategory: "Jio/Airtel/Vi Prepaid",
    note: "Monthly 2GB/day data booster",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    source: "upi"
  },
  {
    id: "demo-tx-3",
    amount: 450,
    category: "gaming",
    subcategory: "BGMI UC",
    note: "Royal Pass Upgrade Season 12",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    source: "upi"
  },
  {
    id: "demo-tx-4",
    amount: 119,
    category: "subscriptions",
    subcategory: "Spotify/Apple Music",
    note: "Spotify Student Premium Plan",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    source: "card"
  },
  {
    id: "demo-tx-5",
    amount: 150,
    category: "transport",
    subcategory: "Metro SmartCard",
    note: "Delhi Metro Card top-up for college",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    source: "upi"
  },
  {
    id: "demo-tx-6",
    amount: 650,
    category: "education",
    subcategory: "Mock Tests & Series",
    note: "JEE Advanced Mock Test Series Pass",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    source: "upi"
  },
  {
    id: "demo-tx-7",
    amount: 500,
    category: "savings",
    subcategory: "Pocket Money Savings",
    note: "Moved 500 to savings pot",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 140).toISOString(),
    source: "upi"
  }
];

export const FORMAT_INR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};
