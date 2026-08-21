import {
  Utensils,
  Cpu,
  Film,
  Sparkles,
  ShoppingBag,
  Gift,
  Fuel,
  Users,
  PenLine,
  TrendingUp,
  Dumbbell,
  Pill,
  Wifi,
  Bus,
  BookOpen,
  Gamepad2,
  GraduationCap,
  Clapperboard,
  Dice5,
  HandCoins,
  LucideIcon,
} from "lucide-react";

// Bump this if the question set or the shape of a submitted document changes —
// lets the ML pipeline branch on schema version when reading survey_responses.
export const SURVEY_SCHEMA_VERSION = 1;

export interface SurveyCategoryDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Kept as its own taxonomy (distinct from STARTER_CATEGORIES, which drives the
// live app's transaction logging) because this survey is intentionally
// broader — it's built to surface signal for the ML spend-prediction model,
// not to mirror the in-app quick-log categories one-to-one.
export const SURVEY_CATEGORIES: SurveyCategoryDef[] = [
  { id: "food-snacks", label: "Food, drinks & snacks", icon: Utensils },
  { id: "tech-gadgets", label: "Technology & gadgets", icon: Cpu },
  { id: "subscriptions", label: "Subscriptions (OTT / music / gaming)", icon: Film },
  { id: "grooming", label: "Skin, hair & grooming products", icon: Sparkles },
  { id: "clothes-shoes", label: "Clothes & shoes", icon: ShoppingBag },
  { id: "gifting-friends", label: "Gifting to friends", icon: Gift },
  { id: "fuel", label: "Fuel", icon: Fuel },
  { id: "dates-outings", label: "Dates & outings", icon: Users },
  { id: "stationery", label: "Stationery", icon: PenLine },
  { id: "investments", label: "Investments", icon: TrendingUp },
  { id: "fitness", label: "Fitness & fitness products", icon: Dumbbell },
  { id: "supplements", label: "Supplements", icon: Pill },
  { id: "mobile-recharge", label: "Mobile recharge / data", icon: Wifi },
  { id: "transportation", label: "Transportation", icon: Bus },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "gaming-inapp", label: "Gaming / in-app purchases", icon: Gamepad2 },
  { id: "tuition-coaching", label: "Tuition / coaching", icon: GraduationCap },
  { id: "movies-entertainment", label: "Movies & entertainment", icon: Clapperboard },
  { id: "fantasy-betting", label: "Fantasy sports / betting apps", icon: Dice5 },
  { id: "charity-donations", label: "Charity / donations", icon: HandCoins },
];

export const AGE_RANGES = ["13–15", "16–18", "19+"] as const;

export const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;

export const CITY_TIERS = [
  { value: "metro", label: "Metro", hint: "Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Pune…" },
  { value: "tier2", label: "Tier-2", hint: "Jaipur, Lucknow, Indore, Nagpur, Surat, Kochi, Chandigarh…" },
  { value: "tier3", label: "Tier-3", hint: "Smaller towns & rural areas" },
] as const;

export const POCKET_MONEY_RANGES = [
  "₹0 – ₹500",
  "₹500 – ₹1,500",
  "₹1,500 – ₹3,000",
  "₹3,000 – ₹5,000",
  "₹5,000 – ₹10,000",
  "₹10,000+",
] as const;

export const FAMILY_INCOME_BRACKETS = [
  "Under ₹3L / yr",
  "₹3L – ₹7L / yr",
  "₹7L – ₹15L / yr",
  "₹15L – ₹30L / yr",
  "₹30L+ / yr",
  "Prefer not to say",
] as const;

// Soft client-side guard so one phone doesn't spam the collection — not a
// substitute for the Firestore rules validation, just a friendlier UX nudge.
export const SURVEY_RESUBMIT_COOLDOWN_MS = 1000 * 60 * 60 * 12; // 12h
export const SURVEY_LOCAL_STORAGE_KEY = "antara_survey_last_submitted_at";

// Bot check: if a submission completes faster than this, it almost certainly
// wasn't a human reading 20 category screens — reject quietly.
export const SURVEY_MIN_COMPLETION_SECONDS = 12;
