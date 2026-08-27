export interface Transaction {
  id: string;
  amount: number;
  category: string;
  subcategory?: string;
  note?: string;
  timestamp: string; // ISO date string
  source?: 'upi' | 'cash' | 'card' | 'manual';
  // Real wallet this expense was paid from (see Wallet below), for real
  // running-balance tracking — separate concern from the existing budget/
  // burn-rate system, which still reads only amount/category/timestamp and
  // is untouched by this field's presence. Optional: transactions logged
  // before wallets existed have no wallet_id and simply never touched any
  // wallet's balance — treat missing as "not attributable to a wallet"
  // wherever this is read, never assume/backfill a wallet for them.
  wallet_id?: string;
}

// A real wallet with a real running balance in INR (Cash, UPI, Piggy bank,
// etc.) — a parallel "real money" layer, distinct from the existing
// monthly_budget/burn-rate system, which is a *plan* against total spend,
// not a real balance. Stored at users/{uid}/wallets/{id}.
export interface Wallet {
  id: string;
  name: string;
  balance: number; // real running balance in INR — can go negative (see IncomeEntry doc)
  created_at: string;
  // Soft-delete: archived wallets stop being selectable for new
  // transactions/income but stay resolvable for old entries already
  // logged against them (name still shown in history).
  archived: boolean;
}

// A real income event — deliberately its own collection (users/{uid}/income),
// not a negative-amount Transaction: income and expense are different kinds
// of event (different optional fields, different effect on a wallet's
// balance direction), not the same schema with a sign flipped.
export interface IncomeEntry {
  id: string;
  amount: number;
  source?: string; // free-text, e.g. "allowance", "birthday gift", "freelance"
  timestamp: string; // ISO date string
  wallet_id: string; // which wallet this income landed in — always required, unlike Transaction.wallet_id
}

export interface Category {
  id: string;
  name: string;
  short: string; // compact chip/label form, e.g. "Food" for "Food delivery & street food"
  icon: string;
  color: string;
  subcategories: string[];
  is_essential: boolean;
  description: string;
  // Soft per-category monthly spend cap in INR, used by the burn/detail views. Optional:
  // the 6 categories merged in from the teen survey (Step 8) have no real cap number yet —
  // that's blocked on the survey's actual data, not something to guess. Callers must treat
  // `undefined` as "no cap set" (show neutral copy), never default it to a made-up figure.
  monthly_cap?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'superadmin' | 'user' | 'beta_tester';
  is_demo_mode: boolean;
  // Step 13: user-editable (BudgetSheet, via AuthContext's setMonthlyBudget).
  // 0 is a real sentinel for a real account that hasn't set one yet — see
  // needsBudgetSetup in AuthContext.tsx — never treat 0 as "the budget is
  // zero," only demo/guest/superadmin profiles and profiles past onboarding
  // should ever be read as a real spending number.
  monthly_budget: number;
  created_at: string;
  // Daily logging streak (Step 8). Only tracked for real signed-in accounts, never demo/guest
  // — demo transactions are preview data, not something that should count toward a streak.
  // Profiles created before Step 8 won't have these in Firestore yet; treat missing as
  // 0/0/null/0 (see computeStreakUpdate in lib/api.ts) rather than assuming they exist.
  currentStreak?: number;
  longestStreak?: number;
  lastLoggedDate?: string | null; // Date.toDateString() of the last calendar day a real transaction was logged
  streakFreezesAvailable?: number;
  // Real, user-set monthly spend caps, keyed by category id. Distinct from
  // Category.monthly_cap (constants.ts) — that's just a survey-derived
  // suggested baseline shown before a user ever sets their own number.
  // Only real signed-in accounts persist this to Firestore; demo/guest
  // profiles hold it in local state only (see AuthContext.setCategoryCap).
  category_caps?: Record<string, number>;
  // Which saved "Instance" (see BudgetInstance, lib/api.ts) most recently
  // wrote its allocation into category_caps above, if any — purely for the
  // Instances UI to show which one is "Active"; category_caps itself
  // remains the single source of truth the rest of the app reads from.
  active_instance_id?: string;
}

export interface BetaAllowlistEntry {
  email: string;
  added_at: string;
  added_by: string;
  notes?: string;
}
