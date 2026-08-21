import {
  Utensils,
  Cpu,
  Film,
  Sparkles,
  ShoppingBag,
  Gift,
  Users,
  TrendingUp,
  Dumbbell,
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
// v2: merged 3 low-signal categories into related ones (20 -> 17), added the
// `habits` section (payment method / pocket-money runway / tracking), and
// added per-category color for the icon badges.
export const SURVEY_SCHEMA_VERSION = 2;

export interface SurveyCategoryDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// Kept as its own taxonomy (distinct from STARTER_CATEGORIES, which drives the
// live app's transaction logging) because this survey is intentionally
// broader — it's built to surface signal for the ML spend-prediction model,
// not to mirror the in-app quick-log categories one-to-one.
//
// Trimmed from an initial 20 down to 17 by folding three low-yield,
// overlapping categories into adjacent ones (fewer screens = a faster
// survey, see SURVEY_MERGE_NOTES below), each with a color for its icon
// badge — mirrors the colored category chips in the live quick-log modal.
export const SURVEY_CATEGORIES: SurveyCategoryDef[] = [
  { id: "food-snacks", label: "Food, drinks & snacks", icon: Utensils, color: "#F97316" },
  { id: "tech-gadgets", label: "Technology & gadgets", icon: Cpu, color: "#3B82F6" },
  { id: "subscriptions", label: "Subscriptions (OTT / music / gaming)", icon: Film, color: "#8B5CF6" },
  { id: "grooming", label: "Skin, hair & grooming products", icon: Sparkles, color: "#A855F7" },
  { id: "clothes-shoes", label: "Clothes & shoes", icon: ShoppingBag, color: "#F43F5E" },
  { id: "gifting-friends", label: "Gifting to friends", icon: Gift, color: "#EAB308" },
  { id: "dates-outings", label: "Dates & outings", icon: Users, color: "#EC4899" },
  { id: "transportation", label: "Transportation & fuel", icon: Bus, color: "#06B6D4" },
  { id: "investments", label: "Investments", icon: TrendingUp, color: "#22C55E" },
  { id: "fitness", label: "Fitness, gym & supplements", icon: Dumbbell, color: "#F59E0B" },
  { id: "mobile-recharge", label: "Mobile recharge / data", icon: Wifi, color: "#0EA5E9" },
  { id: "books", label: "Books & stationery", icon: BookOpen, color: "#14B8A6" },
  { id: "gaming-inapp", label: "Gaming / in-app purchases", icon: Gamepad2, color: "#D946EF" },
  { id: "tuition-coaching", label: "Tuition / coaching", icon: GraduationCap, color: "#10B981" },
  { id: "movies-entertainment", label: "Movies & entertainment", icon: Clapperboard, color: "#6366F1" },
  { id: "fantasy-betting", label: "Fantasy sports / betting apps", icon: Dice5, color: "#EF4444" },
  { id: "charity-donations", label: "Charity / donations", icon: HandCoins, color: "#FACC15" },
];

// Documents *why* a category disappeared, so a re-read of this file explains
// itself instead of just looking like data loss: "Fuel" folded into
// Transportation (most respondents don't spend on it separately), "Stationery"
// into Books, "Supplements" into Fitness — each was a thin, overlapping slice
// next to a category already in the list.
export const SURVEY_MERGE_NOTES =
  "v1 had 20 categories; Fuel -> Transportation, Stationery -> Books, Supplements -> Fitness were merged in v2 to cut ~3 screens without losing the underlying spend signal.";

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

// --- New in v2: quick behavioral questions -------------------------------
// Each is a single tap, same UI as a demographic question, but the signal is
// high-value for a spend-prediction model specifically: payment channel,
// runway (a proxy for burn-rate/overspend risk — the thing the model is
// ultimately trying to predict), and whether they already self-track.
export const PAYMENT_METHODS = ["Mostly UPI", "Mostly cash", "Mostly card", "A mix of all"] as const;

export const POCKET_MONEY_DURATION = [
  "Always lasts the full month",
  "Sometimes runs out early",
  "Almost always runs out early",
] as const;

export const SPEND_TRACKING_OPTIONS = [
  "Yes, with an app",
  "Sort of — I keep rough track",
  "No, never",
] as const;

// Soft client-side guard so one phone doesn't spam the collection — not a
// substitute for the Firestore rules validation, just a friendlier UX nudge.
export const SURVEY_RESUBMIT_COOLDOWN_MS = 1000 * 60 * 60 * 12; // 12h
export const SURVEY_LOCAL_STORAGE_KEY = "antara_survey_last_submitted_at";

// Bot check: if a submission completes faster than this, it almost certainly
// wasn't a human reading through the full question set — reject quietly.
export const SURVEY_MIN_COMPLETION_SECONDS = 10;

// Rough average seconds per screen, used only to show a friendly "~X sec
// left" estimate — deliberately optimistic (most screens are a single tap)
// rather than a strict prediction.
export const SURVEY_AVG_SECONDS_PER_STEP = 3.5;
