import { User as FirebaseUser } from "firebase/auth";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { Transaction, UserProfile } from "@/types";
import { STARTER_CATEGORIES } from "./constants";
import { db } from "./firebase";

// Backend base URL for calls that go directly to the ML API rather than
// through Next.js's own rewrite (next.config.js: /api/v1/:path* ->
// 127.0.0.1:8001, still used for local dev). Step 9 (2026-08-21): set
// NEXT_PUBLIC_API_BASE_URL="https://api.antara.money" in the production
// .env.local so the deployed build calls the public domain directly
// (needed now that CORS is a real allowlist on the backend — see
// backend/app/main.py). Left unset, this falls back to an empty string,
// which makes every URL below relative (e.g. "/api/v1/predict/spend"),
// going through the Next.js rewrite exactly as before — that's the local/dev
// path, and always available regardless of whether the production domain
// resolves from wherever you're running the dev server.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// ────────────────────────────────────────────────────────────────────────
// Burn-rate / "safe day" pacing metrics for the Today screen.
// ────────────────────────────────────────────────────────────────────────

export interface WeekBar {
  day: string; // narrow weekday label, e.g. "T"
  amount: number;
  heightPct: number; // 0-100, relative to the week's max day
  isToday: boolean;
}

export interface RiskRow {
  categoryId: string;
  name: string;
  short: string;
  color: string;
  icon: string;
  spent: number;
  perDay: number;
  sharePct: number; // 0-100
  isEssential: boolean;
  projectedMore: number; // rupees more expected by month end at the current per-day rate
}

export interface BurnMetrics {
  today: number;
  daysInMonth: number;
  daysLeft: number;
  spent: number;
  left: number;
  weekRate: number;
  safeDaily: number;
  burnPct: number;
  runOutDay: number;
  earlyDays: number;
  weekBars: WeekBar[];
  riskRows: RiskRow[];
  need: number;
  want: number;
  needPct: number;
  wantPct: number;
}

/**
 * Derived "burn rate vs. safe pace" metrics for the Today screen and its
 * detail views.
 *
 * `today` must be injected by the caller rather than computed internally via
 * `new Date()`. Calling `new Date()` inside a function that can run during
 * Next.js's build-time static prerender produces a different value there
 * than it does on the client a moment (or days) later, which is exactly the
 * class of React hydration mismatch (#418/#423/#425) fixed elsewhere in this
 * app (see the comment above DEMO_TRANSACTIONS in constants.ts). Demo mode
 * must pass a fixed reference date; live mode may pass the real current date
 * since live data only ever renders after mount (post-hydration).
 */
export function calculateBurnMetrics(
  transactions: Transaction[],
  monthlyBudget: number,
  today: Date
): BurnMetrics {
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth);

  const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const left = Math.max(0, monthlyBudget - spent);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(today);
  const sevenDaysAgoStart = todayStart - 6 * 86400000;

  const weekSpend = transactions
    .filter((t) => new Date(t.timestamp).getTime() >= sevenDaysAgoStart)
    .reduce((sum, t) => sum + t.amount, 0);
  const weekRate = weekSpend / 7;

  const safeDaily = left / daysLeft;
  const burnPct = safeDaily > 0 ? (weekRate / safeDaily) * 100 : weekRate > 0 ? 200 : 0;

  const crossDay = weekRate > 0 ? Math.min(daysInMonth, dayOfMonth + left / weekRate) : daysInMonth;
  const runOutDay = Math.floor(crossDay);
  const earlyDays = daysInMonth - runOutDay;

  // Trailing 7 calendar days, oldest to newest, for the week-bar strip.
  const dayTotals: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = new Date(t.timestamp).toDateString();
    dayTotals[key] = (dayTotals[key] || 0) + t.amount;
  });
  const weekBars: WeekBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart - i * 86400000);
    const key = d.toDateString();
    weekBars.push({
      day: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      amount: dayTotals[key] || 0,
      heightPct: 0,
      isToday: i === 0,
    });
  }
  const maxDay = Math.max(400, ...weekBars.map((b) => b.amount));
  weekBars.forEach((b) => {
    b.heightPct = Math.round((b.amount / maxDay) * 100);
  });

  // Per-category spend, largest first, for the "what's pushing the date" rows.
  const byCategory: Record<string, number> = {};
  STARTER_CATEGORIES.forEach((c) => {
    byCategory[c.id] = 0;
  });
  transactions.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const riskRows: RiskRow[] = STARTER_CATEGORIES.filter((c) => byCategory[c.id] > 0)
    .sort((a, b) => byCategory[b.id] - byCategory[a.id])
    .slice(0, 5)
    .map((c) => {
      const catSpent = byCategory[c.id];
      const perDay = catSpent / dayOfMonth;
      return {
        categoryId: c.id,
        name: c.name,
        short: c.short,
        color: c.color,
        icon: c.icon,
        spent: catSpent,
        perDay,
        sharePct: spent ? (catSpent / spent) * 100 : 0,
        isEssential: c.is_essential,
        projectedMore: Math.round(perDay * daysLeft),
      };
    });

  const need = STARTER_CATEGORIES.filter((c) => c.is_essential).reduce((s, c) => s + byCategory[c.id], 0);
  const want = spent - need;

  return {
    today: dayOfMonth,
    daysInMonth,
    daysLeft,
    spent,
    left,
    weekRate,
    safeDaily,
    burnPct,
    runOutDay,
    earlyDays,
    weekBars,
    riskRows,
    need,
    want,
    needPct: spent ? Math.round((need / spent) * 100) : 0,
    wantPct: spent ? Math.round((want / spent) * 100) : 0,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Week-over-week category trend — purely local, works in demo mode and
// before the backend prediction resolves (or if it fails). Used by
// WhyPredictionSheet for the "X% more than your last 2 weeks" style
// comparison from the Step 8 brief. `hasComparison` is false whenever there
// isn't genuinely 2 prior weeks of data to compare against yet (true for
// almost every real account right now, with only a couple weeks of beta
// history total) — callers must show an honest "not enough history yet"
// state rather than inventing a percentage.
// ────────────────────────────────────────────────────────────────────────

export interface CategoryTrend {
  categoryId: string;
  last7Spend: number;
  hasComparison: boolean;
  pctChangeVsPriorTwoWeeks: number | null;
  priorTwoWeekAvg: number | null;
}

export function computeCategoryTrend(transactions: Transaction[], categoryId: string, today: Date): CategoryTrend {
  const dayMs = 86400000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(today);
  const last7Start = todayStart - 6 * dayMs;
  const prior14Start = todayStart - 20 * dayMs;

  const catTx = transactions.filter((t) => t.category === categoryId);
  const last7Spend = catTx
    .filter((t) => new Date(t.timestamp).getTime() >= last7Start)
    .reduce((s, t) => s + t.amount, 0);
  const prior14Spend = catTx
    .filter((t) => {
      const ts = new Date(t.timestamp).getTime();
      return ts >= prior14Start && ts < last7Start;
    })
    .reduce((s, t) => s + t.amount, 0);

  if (prior14Spend > 0) {
    const priorTwoWeekAvg = Math.round(prior14Spend / 2);
    const pctChangeVsPriorTwoWeeks = Math.round(((last7Spend - priorTwoWeekAvg) / priorTwoWeekAvg) * 100);
    return { categoryId, last7Spend, hasComparison: true, pctChangeVsPriorTwoWeeks, priorTwoWeekAvg };
  }
  return { categoryId, last7Spend, hasComparison: false, pctChangeVsPriorTwoWeeks: null, priorTwoWeekAvg: null };
}

// ────────────────────────────────────────────────────────────────────────
// Live transaction writes — shared between Today and Pull so streak logic
// (below) only lives in one place instead of being duplicated per page.
// ────────────────────────────────────────────────────────────────────────

export async function addLiveTransaction(uid: string, tx: Omit<Transaction, "id">): Promise<void> {
  const txCol = collection(db, "users", uid, "transactions");
  await addDoc(txCol, tx);
}

// ────────────────────────────────────────────────────────────────────────
// ML "Why" prediction — revived in Step 8. Calls the backend's
// /api/v1/predict/spend (see backend/app/main.py, backend/app/ml/engine.py)
// through Next.js's own rewrite (next.config.js: /api/v1/:path* ->
// 127.0.0.1:8001), so a plain same-origin fetch works whether the app is
// reached via Tailscale, LAN, or the public tunnel — no separate backend
// base URL needs hardcoding on the client.
// ────────────────────────────────────────────────────────────────────────

export interface CategoryForecast {
  category_id: string;
  category_name: string;
  predicted_spend: number;
  confidence: number;
  historical_spend: number;
  trend_pct: number;
  risk_level: "low" | "medium" | "high";
  is_heuristic: boolean;
}

export interface SpendPrediction {
  predicted_total_spend: number;
  current_burn_rate_daily: number;
  predicted_burn_rate_daily: number;
  projected_days_until_budget_exhaustion: number | null;
  top_risk_categories: string[];
  category_breakdown: CategoryForecast[];
  smart_insights: string[];
  is_cold_start: boolean;
  model_mode: "HEURISTIC_COLD_START" | "TRAINED_EMBEDDING_V1";
  data_days_logged: number;
  data_points_count: number;
  confidence_score: number;
}

/**
 * Fetches a real ML spend prediction for a signed-in Live user. Requires a
 * Firebase ID token (the backend's verify_firebase_token rejects requests
 * without one outside local dev) — there is deliberately no fallback path
 * that calls this for demo/guest users, since they have no Firebase auth
 * session to get a token from. Callers should catch and fall back to
 * client-only insights (see WhyPredictionSheet) rather than surface a raw
 * fetch failure — a beta tester on a flaky connection shouldn't see an error
 * screen where a "here's what we can tell you locally" screen would do.
 */
export async function fetchSpendPrediction(
  user: FirebaseUser,
  transactions: Transaction[],
  monthlyBudget: number
): Promise<SpendPrediction> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/predict/spend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: user.uid,
      transactions: transactions.map((t) => ({
        amount: t.amount,
        category: t.category,
        subcategory: t.subcategory,
        note: t.note,
        timestamp: t.timestamp,
        source: t.source,
      })),
      monthly_budget: monthlyBudget,
      period_days: 30,
    }),
  });
  if (!res.ok) {
    throw new Error(`Prediction request failed: ${res.status}`);
  }
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────
// Streak / retention mechanic (Step 8) — Firestore fields on the user doc:
// currentStreak, longestStreak, lastLoggedDate, streakFreezesAvailable.
// Pure function so its day-boundary/freeze logic can be unit-tested without
// touching Firestore; callers persist the result themselves (see page.tsx /
// graph/page.tsx handleCommit) and refetch the profile to update the UI.
// Real accounts only — never called for demo/guest logging.
// ────────────────────────────────────────────────────────────────────────

export interface StreakFields {
  currentStreak: number;
  longestStreak: number;
  lastLoggedDate: string | null;
  streakFreezesAvailable: number;
}

export interface StreakUpdateResult extends StreakFields {
  milestoneHit: 7 | 30 | 100 | null;
  freezeConsumed: boolean;
  alreadyLoggedToday: boolean;
}

const STREAK_MAX_BANKED_FREEZES = 2;
const STREAK_MILESTONES = [7, 30, 100] as const;

export function computeStreakUpdate(prev: Partial<StreakFields>, now: Date): StreakUpdateResult {
  const currentStreak = prev.currentStreak ?? 0;
  const longestStreak = prev.longestStreak ?? 0;
  const lastLoggedDate = prev.lastLoggedDate ?? null;
  let streakFreezesAvailable = prev.streakFreezesAvailable ?? 0;

  const todayKey = now.toDateString();
  const yesterdayKey = new Date(now.getTime() - 86400000).toDateString();
  const twoDaysAgoKey = new Date(now.getTime() - 2 * 86400000).toDateString();

  if (lastLoggedDate === todayKey) {
    // Already logged a real transaction today — the streak already reflects
    // today; a second (or third...) log today must not double-increment it.
    return {
      currentStreak,
      longestStreak,
      lastLoggedDate,
      streakFreezesAvailable,
      milestoneHit: null,
      freezeConsumed: false,
      alreadyLoggedToday: true,
    };
  }

  let newStreak: number;
  let freezeConsumed = false;

  if (lastLoggedDate === null) {
    // First real log ever.
    newStreak = 1;
  } else if (lastLoggedDate === yesterdayKey) {
    // Logged yesterday, logging again today — streak continues.
    newStreak = currentStreak + 1;
  } else if (lastLoggedDate === twoDaysAgoKey && streakFreezesAvailable > 0) {
    // Exactly one calendar day was missed, and a banked freeze covers it.
    newStreak = currentStreak + 1;
    streakFreezesAvailable -= 1;
    freezeConsumed = true;
  } else {
    // Either a gap of 2+ days with no freeze available, or a gap longer than
    // one day, which a single freeze can't cover regardless of balance.
    // Today's log starts a fresh streak of 1, not a streak of 0.
    newStreak = 1;
  }

  const newLongest = Math.max(longestStreak, newStreak);

  // Earn a freeze every 7-day streak milestone, capped at 2 banked.
  if (newStreak > 0 && newStreak % 7 === 0) {
    streakFreezesAvailable = Math.min(STREAK_MAX_BANKED_FREEZES, streakFreezesAvailable + 1);
  }

  const milestoneHit = (STREAK_MILESTONES as readonly number[]).includes(newStreak)
    ? (newStreak as 7 | 30 | 100)
    : null;

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastLoggedDate: todayKey,
    streakFreezesAvailable,
    milestoneHit,
    freezeConsumed,
    alreadyLoggedToday: false,
  };
}

/** Plain-language toast copy for a streak update — null if nothing streak-worthy happened. */
export function streakToastMessage(result: StreakUpdateResult): string | null {
  if (result.alreadyLoggedToday) return null;
  if (result.milestoneHit === 100) return `🔥 100-day streak! That's real discipline.`;
  if (result.milestoneHit === 30) return `🔥 30-day streak! A month of logging every day.`;
  if (result.milestoneHit === 7) return `🔥 7-day streak! You've earned a streak freeze.`;
  if (result.freezeConsumed) return `🧊 Streak freeze used — ${result.currentStreak}-day streak stays alive.`;
  return null;
}

/** Persists the updated streak fields onto the user's profile doc (merge, safe for legacy docs missing these fields). */
export async function saveStreakUpdate(uid: string, result: StreakUpdateResult): Promise<void> {
  const userRef = doc(db, "users", uid);
  await setDoc(
    userRef,
    {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      lastLoggedDate: result.lastLoggedDate,
      streakFreezesAvailable: result.streakFreezesAvailable,
    } as Partial<UserProfile>,
    { merge: true }
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 10 — superadmin Stage-1 training-data admin API. All of these hit
// backend/app/main.py's admin endpoints (superadmin-only, verified via the
// same Firebase ID token pattern as fetchSpendPrediction above). Shapes here
// mirror backend/app/ml/survey_etl.py's output field-for-field rather than
// re-deriving anything client-side — the backend is the one source of truth
// for these stats, this is just typing what it returns.
// ────────────────────────────────────────────────────────────────────────

export interface DataConfig {
  incomeBandCutoffs: number[];
  incomeBandLabels: string[];
  categoryWeights: Record<string, number>;
  outlierHandling: { enabled: boolean; thresholdIQR: number };
  minSampleSizeConfident: number;
}

export interface CategoryStat {
  insufficientData: boolean;
  sampleSizeRaw: number;
  sampleSizeUsed: number;
  outliersRemoved?: number;
  median?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  insufficientForIQR?: boolean;
  min?: number;
  max?: number;
  rawBenchmarkPct: number;
  categoryWeight: number;
  adjustedBenchmarkPct: number;
  confidenceTier: "confident" | "early_estimate";
}

export interface IncomeBandStats {
  respondentCount: number;
  categories: Record<string, CategoryStat>;
}

export interface Stage1Stats {
  computedAt: string;
  sampleSize: number;
  grandTotalReported: number;
  configUsed: DataConfig;
  overall: Record<string, CategoryStat>;
  byIncomeBand: Record<string, IncomeBandStats>;
  unmappedCategories: Record<string, number>;
}

export interface PopulationDotGraphNode {
  id: string;
  label: string;
  type: "archetype_center" | "survey_respondent";
  size: number;
  color: string;
  x: number;
  y: number;
  metadata: Record<string, any>;
}

export interface PopulationDotGraphLink {
  source: string;
  target: string;
  strength: number;
  distance: number;
  type: string;
}

export interface PopulationDotGraph {
  sampleSize: number;
  respondentsPlotted: number;
  nodes: PopulationDotGraphNode[];
  links: PopulationDotGraphLink[];
  note: string;
}

export interface TrainingInsights {
  stats: Stage1Stats;
  history: { computedAt: string; sampleSize: number }[];
  populationDotGraph: PopulationDotGraph;
}

async function adminFetch<T>(path: string, user: FirebaseUser, options: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Admin request to ${path} failed: ${res.status}`);
  }
  return res.json();
}

export const fetchDataConfig = (user: FirebaseUser) => adminFetch<DataConfig>("/api/v1/admin/data-config", user);

export const updateDataConfig = (user: FirebaseUser, config: Partial<DataConfig>) =>
  adminFetch<{ config: DataConfig; recomputedStats: Stage1Stats }>("/api/v1/admin/data-config", user, {
    method: "PUT",
    body: JSON.stringify(config),
  });

export const recomputeBenchmarks = (user: FirebaseUser) =>
  adminFetch<Stage1Stats>("/api/v1/admin/recompute-benchmarks", user, { method: "POST" });

export const fetchTrainingInsights = (user: FirebaseUser) =>
  adminFetch<TrainingInsights>("/api/v1/admin/training-insights", user);
