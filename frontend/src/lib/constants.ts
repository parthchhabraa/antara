import { Category, Transaction } from "@/types";

// Category ids were realigned on 2026-08-21 to match the real teen spending
// survey's actual Firestore schema (`survey_responses.{doc}.category_spend`
// field names) rather than the earlier Step 8 taxonomy, which was built off
// a paraphrased list of category *names* and didn't exactly match the
// survey webapp's real field ids once it went live. Aligning ids means
// transactions logged in the app correlate directly with the survey's
// benchmark data — no translation table needed between "what a user logs"
// and "what the survey measured."
//
// Renamed (same concept, id now matches the survey field): gaming ->
// gaming-inapp, fashion -> clothes-shoes, transport -> transportation,
// personal-care -> grooming, education -> tuition-coaching, savings ->
// investments, dating-outings -> dates-outings (survey's own spelling),
// stationery -> books (survey has no separate "stationery" field; folds in).
//
// Merged (survey treats these as one field, so the app now does too):
// food-delivery + snacks -> food-snacks. money-to-friends + social-gifts ->
// gifting-friends. supplements folded into fitness as a subcategory (the
// survey's single "fitness" field would already include supplement spend —
// splitting it here would have nowhere real to allocate the number).
//
// New (the survey covers these; nothing existed for them before):
// movies-entertainment, charity-donations, fantasy-betting.
//
// Kept, not in the survey at all: miscellaneous (catch-all safety net).
//
// benchmark_pct/median_spend_inr for the ML engine (backend/app/ml/engine.py)
// and `monthly_cap` below are real numbers computed from actual survey
// responses — no longer guessed. Refreshed 2026-08-22 (Step 15) against
// n=36 (every category now at the "confident" tier, ≥20 responses) via
// backend/app/ml/survey_etl.py's real compute path — the same Step 10
// admin/dataConfig recompute mechanism the backend's live benchmarks use
// (POST /api/v1/admin/recompute-benchmarks), not scripts/
// compute_category_benchmarks.py (an older, pre-Step-10 script that writes
// a differently-shaped admin/categoryBenchmarks doc — superseded, left
// alone, not run this pass to avoid clobbering survey_etl.py's schema).
// `monthly_cap` is still set to the category's real median (same
// convention the original 3-response version used, just re-applied to a
// real sample now) EXCEPT where the real, confident-tier median is
// genuinely ₹0 — investments, fitness, gaming-inapp, tuition-coaching, and
// charity-donations all report a true ₹0 median at n≥27 each, not
// under-sampling noise anymore, but a ₹0 cap still isn't useful "spend
// advice" (it would flag literally the first rupee logged as over cap), so
// those categories deliberately stay uncapped. Re-run the recompute
// endpoint and refresh both files again as the sample keeps growing.
export const STARTER_CATEGORIES: Category[] = [
  {
    id: "food-snacks",
    name: "Food, drinks & snacks",
    short: "Food",
    icon: "Utensils",
    color: "#F97316",
    subcategories: ["Swiggy/Zomato", "Street Food/Chaat", "Chips & Cold Drinks", "Cafe & Snacks", "Groceries"],
    is_essential: false,
    description: "Daily food, drinks, snacks, deliveries, and chai/tiffin.",
    monthly_cap: 2000 // survey median, n=36 (Step 15, was 2500 at n=3)
  },
  {
    id: "dates-outings",
    name: "Dating & going out",
    short: "Dating",
    icon: "Heart",
    color: "#FB7185",
    subcategories: ["Cafes/Restaurants Together", "Outing Tickets"],
    is_essential: false,
    description: "Spending on dates or outings with friends — separate from solo food or movies.",
    monthly_cap: 1000 // survey median, n=36 (Step 15, was 2000 at n=3)
  },
  {
    id: "clothes-shoes",
    name: "Clothes & shoes",
    short: "Clothes",
    icon: "ShoppingBag",
    color: "#F43F5E",
    subcategories: ["Myntra/Ajio/Urbanic", "Thrifting/Streetwear", "Sneakers", "Watches/Jewelry"],
    is_essential: false,
    description: "Clothing, sneakers, streetwear, and style accessories.",
    monthly_cap: 1000 // survey median, n=36 (Step 15, was 2000 at n=3)
  },
  {
    id: "gifting-friends",
    name: "Gifts & money to friends",
    short: "Gifts",
    icon: "HandCoins",
    color: "#EAB308",
    subcategories: ["Birthday Gifts", "Lent to a Friend", "Splitting a Bill Upfront", "Festival Gifting"],
    is_essential: false,
    description: "Cash, UPI, or gifts to friends — lending, splitting a bill, or giving something for an occasion.",
    monthly_cap: 100 // survey median, n=36 (Step 15, new — n=3 was too thin to set one)
  },
  {
    id: "fitness",
    name: "Fitness & fitness products",
    short: "Fitness",
    icon: "Dumbbell",
    color: "#84CC16",
    subcategories: ["Gym Membership", "Sports Gear", "Fitness Classes", "Protein Powder & Supplements"],
    is_essential: false,
    // No monthly_cap: real median (n=36, confident tier) is ₹0 — see the
    // header comment above for why that stays uncapped rather than capped at 0.
    description: "Gym memberships, sports gear, fitness classes, and supplements."
  },
  {
    id: "transportation",
    name: "Transportation",
    short: "Transport",
    icon: "Car",
    color: "#06B6D4",
    subcategories: ["Metro SmartCard", "Auto/Rickshaw", "Uber/Ola", "Bus Pass", "Fuel/Scooty"],
    is_essential: true,
    description: "Daily commute, public transport, cabs, and fuel.",
    monthly_cap: 500 // survey median, n=36 (Step 15, new — n=3 was too thin to set one)
  },
  {
    id: "grooming",
    name: "Grooming & personal care",
    short: "Grooming",
    icon: "Sparkles",
    color: "#A855F7",
    subcategories: ["Salon & Haircut", "Skincare & Grooming", "Pharmacy & Health"],
    is_essential: false,
    description: "Skin, hair, grooming products, and haircuts.",
    monthly_cap: 500 // survey median, n=36 (Step 15, new — n=3 was too thin to set one)
  },
  {
    id: "subscriptions",
    name: "OTT & music subscriptions",
    short: "OTT",
    icon: "Film",
    color: "#D946EF", // fuchsia — changed from #8B5CF6 in Step 8: that hex is now literally
    // the brand `primary` token (Step 7's violet revert), so a category sharing it exactly
    // undermined the "category colors are a separate palette" rule this file otherwise follows.
    subcategories: ["Spotify/Apple Music", "Netflix/Prime", "YouTube Premium", "Discord Nitro", "Cloud Storage"],
    is_essential: false,
    description: "Monthly entertainment, audio, and streaming subscriptions.",
    monthly_cap: 200 // survey median, n=36 (Step 15, new — n=3 was too thin to set one)
  },
  {
    id: "movies-entertainment",
    name: "Movies & entertainment",
    short: "Movies",
    icon: "Clapperboard",
    color: "#F59E0B",
    subcategories: ["Movie Tickets", "Events/Concerts", "One-off Rentals"],
    is_essential: false,
    description: "Movie tickets, events, and one-off entertainment — separate from monthly OTT subscriptions.",
    monthly_cap: 150 // survey median, n=36 (Step 15, new — n=3 was too thin to set one)
  },
  {
    id: "tech-gadgets",
    name: "Technology & gadgets",
    short: "Tech",
    icon: "Laptop",
    color: "#0EA5E9",
    subcategories: ["Earphones/Headphones", "Phone Case & Accessories", "Chargers & Cables", "Small Electronics"],
    is_essential: false,
    description: "Gadgets, accessories, and small electronics purchases.",
    monthly_cap: 100 // survey median, n=36 (Step 15, new — n=3 was too thin to set one)
  },
  {
    id: "gaming-inapp",
    name: "Gaming (in-app/top-ups)",
    short: "Gaming",
    icon: "Gamepad2",
    color: "#EC4899",
    subcategories: ["BGMI UC", "Valorant Points", "PlayStore Top-up", "Steam Games", "Skins & Passes"],
    is_essential: false,
    // No monthly_cap: real median (n=36, confident tier) is ₹0 — see the
    // header comment above for why that stays uncapped rather than capped at 0.
    description: "In-game currency, battle passes, game purchases, and skins."
  },
  {
    id: "investments",
    name: "Investments & savings",
    short: "Savings",
    icon: "PiggyBank",
    color: "#22C55E",
    subcategories: ["Emergency Fund", "Digital Gold", "Mutual Funds/SIP", "Pocket Money Savings"],
    is_essential: true,
    // No monthly_cap: real median (n=36, confident tier) is ₹0, and this
    // category conceptually shouldn't have a spend "cap" at all — capping
    // savings would penalize saving more, the opposite of the intent.
    description: "Money set aside, recurring deposits, or teen investment."
  },
  {
    id: "charity-donations",
    name: "Charity & donations",
    short: "Charity",
    icon: "HeartHandshake",
    color: "#F472B6",
    subcategories: ["Temple/Religious Donations", "NGO/Charity Drives", "Crowdfunding"],
    is_essential: false,
    // No monthly_cap: real median (n=36, confident tier) is ₹0 — see the
    // header comment above for why that stays uncapped rather than capped at 0.
    description: "Religious donations, charity drives, and crowdfunding contributions."
  },
  {
    id: "mobile-recharge",
    name: "Mobile recharge/data",
    short: "Recharge",
    icon: "Smartphone",
    color: "#3B82F6",
    subcategories: ["Jio/Airtel/Vi Prepaid", "Add-on Data Packs", "Family Plan", "Hotspot"],
    is_essential: true,
    description: "Mobile plans, data top-ups, and connectivity.",
    monthly_cap: 50 // survey median, n=36 (Step 15, new — n=3 previously reported ₹0, too thin to trust)
  },
  {
    id: "books",
    name: "Books & stationery",
    short: "Books",
    icon: "BookOpen",
    color: "#14B8A6",
    subcategories: ["Notebooks & Pens", "Reference Books", "Photocopy/Printouts", "Novel/Manga"],
    is_essential: true,
    description: "Notebooks, stationery, textbooks, and reading.",
    monthly_cap: 100 // survey median, n=36 (Step 15, new — n=3 previously reported ₹0, too thin to trust)
  },
  {
    id: "fantasy-betting",
    name: "Fantasy sports & betting",
    short: "Fantasy",
    icon: "Dices",
    color: "#EF4444",
    subcategories: ["Dream11/Fantasy Sports", "Online Betting/Poker"],
    is_essential: false,
    // No monthly_cap: real median (n=36, confident tier) is ₹0 — see the
    // header comment above for why that stays uncapped rather than capped at 0.
    description: "Fantasy sports entries and online betting."
  },
  {
    id: "tuition-coaching",
    name: "Coaching/tuition/exam fees",
    short: "Coaching",
    icon: "GraduationCap",
    color: "#10B981",
    subcategories: ["Coaching Installments", "Mock Tests & Series", "Exam Application Fees", "Online Courses"],
    is_essential: true,
    // No monthly_cap: real median (n=36, confident tier) is ₹0 — see the
    // header comment above for why that stays uncapped rather than capped at 0.
    description: "Tuition, competitive exam prep, registrations, and courses."
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    short: "Misc",
    icon: "HelpCircle",
    color: "#64748B",
    subcategories: ["Emergency Cash", "ATM Withdrawals", "Repayments", "Uncategorized"],
    is_essential: false,
    description: "Ad-hoc expenses, cash withdrawals, and general items not covered by the survey."
  }
];

// Fixed, deterministic timestamps (not Date.now()-relative): this module runs
// once at Next.js build time (static prerender) and again when the client
// bundle loads in the browser. Those are two different real-world moments, so
// any Date.now()-derived value here would differ between the server-rendered
// HTML and the client's first render and trigger a React hydration mismatch
// (errors #418/#423/#425). Demo data doesn't need to be "live," just stable.
export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "demo-tx-1",
    amount: 380,
    category: "food-snacks",
    subcategory: "Swiggy/Zomato",
    note: "Late night burger & shakes with Aryan",
    timestamp: "2026-08-19T09:00:00.000Z",
    source: "upi"
  },
  {
    id: "demo-tx-2",
    amount: 299,
    category: "mobile-recharge",
    subcategory: "Jio/Airtel/Vi Prepaid",
    note: "Monthly 2GB/day data booster",
    timestamp: "2026-08-18T12:00:00.000Z",
    source: "upi"
  },
  {
    id: "demo-tx-3",
    amount: 450,
    category: "gaming-inapp",
    subcategory: "BGMI UC",
    note: "Royal Pass Upgrade Season 12",
    timestamp: "2026-08-17T12:00:00.000Z",
    source: "upi"
  },
  {
    id: "demo-tx-4",
    amount: 119,
    category: "subscriptions",
    subcategory: "Spotify/Apple Music",
    note: "Spotify Student Premium Plan",
    timestamp: "2026-08-16T12:00:00.000Z",
    source: "card"
  },
  {
    id: "demo-tx-5",
    amount: 150,
    category: "transportation",
    subcategory: "Metro SmartCard",
    note: "Delhi Metro Card top-up for college",
    timestamp: "2026-08-15T12:00:00.000Z",
    source: "upi"
  },
  {
    id: "demo-tx-6",
    amount: 650,
    category: "tuition-coaching",
    subcategory: "Mock Tests & Series",
    note: "JEE Advanced Mock Test Series Pass",
    timestamp: "2026-08-14T12:00:00.000Z",
    source: "upi"
  },
  {
    id: "demo-tx-7",
    amount: 500,
    category: "investments",
    subcategory: "Pocket Money Savings",
    note: "Moved 500 to savings pot",
    timestamp: "2026-08-13T16:00:00.000Z",
    source: "upi"
  }
];

// Fixed "today" for demo mode's burn-rate math (matches DEMO_TRANSACTIONS'
// latest entry). Never call `new Date()` for this in demo mode — see the
// hydration note above DEMO_TRANSACTIONS.
export const DEMO_REFERENCE_DATE = new Date("2026-08-19T12:00:00.000Z");

export const FORMAT_INR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};
