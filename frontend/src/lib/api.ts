import { User as FirebaseUser } from "firebase/auth";
import { collection, addDoc, doc, setDoc, deleteDoc, deleteField, updateDoc, runTransaction } from "firebase/firestore";
import { Transaction, UserProfile, Wallet, IncomeEntry } from "@/types";
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
  // Phase 2 continuation — a stable per-day key (Date.toDateString(), e.g.
  // "Wed Aug 19 2026") so the day-strip can actually be tapped: this is
  // what a caller matches transactions and the "selected day" against, not
  // a display string that could collide or drift.
  dateKey: string;
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
      dateKey: key,
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

// Mirrors backend/app/ml/engine.py's MLEngine._analyze_data_maturity exactly
// (same COLD_START_DAY_THRESHOLD=14 / MIN_TRANSACTION_COUNT_THRESHOLD=5
// constants, same "unique days or date span, whichever is larger" logic) —
// deliberately not a new/different threshold. WhyPredictionSheet and
// ArchetypeSheet already surface "Still calibrating…" off the real
// `is_cold_start` field an ML response returns; the Today screen's burn
// ring/"money runs out" card are pure client-side math with no ML call to
// piggyback on, so this lets them use the identical condition without
// requiring a network round-trip just to show a calibrating notice.
const COLD_START_DAY_THRESHOLD = 14;
const MIN_TRANSACTION_COUNT_THRESHOLD = 5;

export function isColdStart(transactions: Transaction[]): boolean {
  const txCount = transactions.length;
  if (txCount === 0) return true;
  const timestamps = transactions.map((t) => new Date(t.timestamp).getTime());
  const minDate = Math.min(...timestamps);
  const maxDate = Math.max(...timestamps);
  const uniqueDays = new Set(transactions.map((t) => new Date(t.timestamp).toDateString())).size;
  const daySpan = Math.max(1, Math.round((maxDate - minDate) / 86400000) + 1);
  const effectiveDays = Math.max(uniqueDays, daySpan);
  return effectiveDays < COLD_START_DAY_THRESHOLD || txCount < MIN_TRANSACTION_COUNT_THRESHOLD;
}

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

// Wallets feature: an expense with a real wallet_id atomically decrements
// that wallet's real balance in the same write as the transaction itself
// (via a Firestore transaction, not two separate calls) — so a log can
// never land while its wallet balance silently fails to update, or vice
// versa. A transaction with no wallet_id (the common case for every
// transaction logged before this feature existed, and still allowed going
// forward since the brief says this must never be mandatory) behaves
// exactly as before: a plain addDoc, no wallet touched at all.
export async function addLiveTransaction(uid: string, tx: Omit<Transaction, "id">): Promise<void> {
  if (!tx.wallet_id) {
    const txCol = collection(db, "users", uid, "transactions");
    await addDoc(txCol, tx);
    return;
  }
  const txRef = doc(collection(db, "users", uid, "transactions"));
  const walletRef = doc(db, "users", uid, "wallets", tx.wallet_id);
  await runTransaction(db, async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    // Never lose a real log over a wallet-side edge case (e.g. the wallet
    // was deleted in another tab mid-flight) — the transaction doc always
    // gets written; the balance update is simply skipped if there's no
    // real wallet doc left to apply it to.
    transaction.set(txRef, tx);
    if (walletSnap.exists()) {
      const current = (walletSnap.data().balance as number) ?? 0;
      transaction.update(walletRef, { balance: current - tx.amount });
    }
  });
}

// Step 13 — delete/edit. Deliberately does NOT touch streak fields: the
// streak records "did you log something on that calendar day," which
// already happened and shouldn't be un-happened by later deleting or
// editing the entry that caused it. Retroactively recomputing streak state
// from the full transaction history on every delete would also mean a
// months-old cleanup edit could silently break a *current* streak the user
// has no reason to think is at risk. Burn rate and "Why this pace?" are
// different: those are live aggregates recomputed from the current
// transaction list on every render (calculateBurnMetrics, WhyPredictionSheet),
// so a delete or edit here is reflected there automatically — no separate
// recompute call needed, just don't skip refreshing the underlying list.
//
// Wallets feature: reads the transaction being deleted (inside the same
// Firestore transaction, so it's the real current amount/wallet_id, not
// stale client state) and credits its wallet back by the real amount —
// deleting a logging mistake shouldn't leave a wallet's real balance
// permanently off by whatever that entry was. A no-wallet_id transaction
// (or one whose wallet no longer exists) simply deletes with no balance
// side effect, same "never block on a wallet-side edge case" posture as
// addLiveTransaction above.
export async function deleteLiveTransaction(uid: string, txId: string): Promise<void> {
  const txRef = doc(db, "users", uid, "transactions", txId);
  await runTransaction(db, async (transaction) => {
    // Firestore transactions require every read to happen before any write
    // in the same transaction — bug caught during real-data verification
    // (deleting a wallet-linked entry threw "transactions require all
    // reads to be executed before all writes" because the tx delete was
    // issued before the wallet read below it). Reads first, in full, then
    // writes — never interleaved.
    const txSnap = await transaction.get(txRef);
    if (!txSnap.exists()) return;
    const data = txSnap.data() as Omit<Transaction, "id">;

    let walletRef = null;
    let walletExists = false;
    let walletBalance = 0;
    if (data.wallet_id) {
      walletRef = doc(db, "users", uid, "wallets", data.wallet_id);
      const walletSnap = await transaction.get(walletRef);
      walletExists = walletSnap.exists();
      if (walletExists) walletBalance = (walletSnap.data()!.balance as number) ?? 0;
    }

    transaction.delete(txRef);
    if (walletRef && walletExists) {
      transaction.update(walletRef, { balance: walletBalance + data.amount });
    }
  });
}

// Wallets feature: if `updates` touches `amount` and/or `wallet_id`, the old
// effect is reversed on its old wallet and the new effect applied to its
// (possibly different) new wallet, atomically alongside the doc update —
// same-wallet amount edits collapse into one combined delta rather than two
// separate reads/writes of the same doc (Firestore transactions can't read
// back their own writes, so two naive sequential updates to the same wallet
// would silently only keep the second one). Anything else (category, note,
// subcategory, …) skips the transaction machinery entirely — a plain
// updateDoc, exactly as before this feature existed.
export async function updateLiveTransaction(
  uid: string,
  txId: string,
  updates: Partial<Omit<Transaction, "id">>
): Promise<void> {
  const touchesWalletMath = "amount" in updates || "wallet_id" in updates;
  if (!touchesWalletMath) {
    await updateDoc(doc(db, "users", uid, "transactions", txId), updates);
    return;
  }
  const txRef = doc(db, "users", uid, "transactions", txId);
  await runTransaction(db, async (transaction) => {
    // Same "all reads before any writes" ordering fix as deleteLiveTransaction
    // above — this used to interleave a read for the "new wallet" case after
    // an update() on the "old wallet" ref, which Firestore rejects outright.
    const txSnap = await transaction.get(txRef);
    const before = (txSnap.data() || {}) as Partial<Transaction>;
    const oldAmount = before.amount ?? 0;
    const oldWalletId = before.wallet_id;
    const newAmount = updates.amount ?? oldAmount;
    const newWalletId = "wallet_id" in updates ? updates.wallet_id : oldWalletId;
    const sameWallet = !!oldWalletId && oldWalletId === newWalletId;

    let oldWalletRef = null;
    let oldWalletExists = false;
    let oldWalletBalance = 0;
    let newWalletRef = null;
    let newWalletExists = false;
    let newWalletBalance = 0;

    if (sameWallet) {
      oldWalletRef = doc(db, "users", uid, "wallets", oldWalletId as string);
      const snap = await transaction.get(oldWalletRef);
      oldWalletExists = snap.exists();
      if (oldWalletExists) oldWalletBalance = (snap.data()!.balance as number) ?? 0;
    } else {
      if (oldWalletId) {
        oldWalletRef = doc(db, "users", uid, "wallets", oldWalletId);
        const snap = await transaction.get(oldWalletRef);
        oldWalletExists = snap.exists();
        if (oldWalletExists) oldWalletBalance = (snap.data()!.balance as number) ?? 0;
      }
      if (newWalletId) {
        newWalletRef = doc(db, "users", uid, "wallets", newWalletId);
        const snap = await transaction.get(newWalletRef);
        newWalletExists = snap.exists();
        if (newWalletExists) newWalletBalance = (snap.data()!.balance as number) ?? 0;
      }
    }

    // ── Writes, only after every read above has completed ──
    if (sameWallet) {
      if (oldWalletRef && oldWalletExists) {
        transaction.update(oldWalletRef, { balance: oldWalletBalance + oldAmount - newAmount });
      }
    } else {
      if (oldWalletRef && oldWalletExists) {
        transaction.update(oldWalletRef, { balance: oldWalletBalance + oldAmount });
      }
      if (newWalletRef && newWalletExists) {
        transaction.update(newWalletRef, { balance: newWalletBalance - newAmount });
      }
    }
    transaction.update(txRef, updates);
  });
}

// ────────────────────────────────────────────────────────────────────────
// Wallets — real, named, per-user running balances (Cash, UPI, Piggy bank,
// …). A parallel "real money" layer: the existing monthly_budget/burn-rate/
// ML prediction system reads only amount/category/timestamp off the
// transaction list and is completely untouched by any of this.
// ────────────────────────────────────────────────────────────────────────

export async function createWallet(uid: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, "users", uid, "wallets"), {
    name: name.trim(),
    balance: 0,
    created_at: new Date().toISOString(),
    archived: false,
  } as Omit<Wallet, "id">);
  return ref.id;
}

export async function renameWallet(uid: string, walletId: string, name: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "wallets", walletId), { name: name.trim() });
}

// Soft-delete, per the brief: archived wallets stop being selectable for
// new transactions/income (see QuickLogSheet/IncomeLogSheet, both filter on
// `!archived`) but stay resolvable for old entries already logged against
// them — nothing reads this field as "gone," just "not offered anymore."
export async function archiveWallet(uid: string, walletId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "wallets", walletId), { archived: true });
}

// ────────────────────────────────────────────────────────────────────────
// Income — a real event, deliberately its own collection (see IncomeEntry
// in types/index.ts), atomically credited to its wallet the same way
// addLiveTransaction atomically debits one.
// ────────────────────────────────────────────────────────────────────────

export async function logIncome(uid: string, income: Omit<IncomeEntry, "id">): Promise<void> {
  const incomeRef = doc(collection(db, "users", uid, "income"));
  const walletRef = doc(db, "users", uid, "wallets", income.wallet_id);
  await runTransaction(db, async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    transaction.set(incomeRef, income);
    if (walletSnap.exists()) {
      const current = (walletSnap.data().balance as number) ?? 0;
      transaction.update(walletRef, { balance: current + income.amount });
    }
  });
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

export interface PeerArchetypeMatch {
  id: string;
  name: string;
  color: string;
  similarity_pct: number;
  description: string;
}

export interface DotGraphResult {
  archetype: string;
  archetype_description: string;
  is_cold_start: boolean;
  peer_archetypes: PeerArchetypeMatch[];
}

/**
 * Fetches the per-user archetype match — POST /api/v1/ml/dot-graph, built
 * in Step 8, functional since then but with no UI consumer until this (see
 * that endpoint's own docstring in main.py). Same auth/error-handling shape
 * as fetchSpendPrediction above: requires a real Firebase ID token, throws
 * on failure rather than silently returning something — callers (see
 * ArchetypeSheet) are expected to catch and show an honest "couldn't load"
 * state instead.
 */
export async function fetchDotGraph(user: FirebaseUser, transactions: Transaction[]): Promise<DotGraphResult> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/ml/dot-graph`, {
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
    }),
  });
  if (!res.ok) {
    throw new Error(`Dot-graph request failed: ${res.status}`);
  }
  return res.json();
}

export interface LearningCurvePoint {
  date: string;
  confidence: number;
  model_mode: "HEURISTIC_COLD_START" | "TRAINED_EMBEDDING_V1";
  is_cold_start: boolean;
  tx_count: number;
  active_days: number;
}

export interface LearningCurveResult {
  points: LearningCurvePoint[];
}

/**
 * Real, per-user confidence-over-time curve — POST /api/v1/ml/learning-curve.
 * Not a generic illustrative chart: the backend replays the exact same
 * confidence formula predict_spending uses today against the caller's own
 * real logged days, so this is genuinely their own path to whatever
 * confidence tier they're currently at. Same auth/request shape as
 * fetchDotGraph — requires a real Firebase ID token, throws on failure.
 */
export async function fetchLearningCurve(user: FirebaseUser, transactions: Transaction[]): Promise<LearningCurveResult> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/ml/learning-curve`, {
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
    }),
  });
  if (!res.ok) {
    throw new Error(`Learning-curve request failed: ${res.status}`);
  }
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────
// "Ask Antara" — POST /api/v1/ml/chat (Phase 2's route, extended this pass
// to also ground answers in the same real prediction/confidence numbers
// the burn-rate UI is built from, not just raw category totals — see
// backend/app/ml/llm_features.answer_chat). Stateless per call: the
// backend doesn't keep conversation history, so the chat screen keeps its
// own local transcript and just sends the latest message each time.
// ────────────────────────────────────────────────────────────────────────

export interface ChatAnswer {
  answer: string;
  grounded_on_transaction_count: number;
}

export async function fetchChatAnswer(user: FirebaseUser, message: string): Promise<ChatAnswer> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/ml/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: user.uid, message }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }
  return res.json();
}

export interface CategorizeSuggestion {
  category_id: string | null;
  category_name: string | null;
  confidence: number;
  needs_review: boolean;
}

/**
 * Free-text description -> a suggested category, via the local Ollama
 * model (POST /api/v1/ml/categorize, Phase 2). Requires a real Firebase ID
 * token (the route needs *a* verified user, not ownership of anything —
 * it never touches stored data, just the description string handed in) —
 * so this is never called in demo/guest mode; callers should check for a
 * real `user` first. Returns `needs_review: true` / `category_id: null`
 * for a vague description rather than a forced guess — callers should
 * treat that as "say nothing," not as an error to surface.
 */
export async function fetchCategorizeSuggestion(
  user: FirebaseUser,
  description: string,
  amount?: number
): Promise<CategorizeSuggestion> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/ml/categorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description, amount }),
  });
  if (!res.ok) {
    throw new Error(`Categorize request failed: ${res.status}`);
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
// Step 13 — editable monthly budget. Shared by the once-at-onboarding
// BudgetSheet (AppBootGate's pendingBudgetSetup gate) and the always-
// available "Edit" affordance on the Today screen — same write, same
// validation, just triggered from two different UI moments.
// ────────────────────────────────────────────────────────────────────────

export async function saveMonthlyBudget(uid: string, amount: number): Promise<void> {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { monthly_budget: amount } as Partial<UserProfile>, { merge: true });
}

// ────────────────────────────────────────────────────────────────────────
// Real per-user, per-category spending caps (bug fix: caps used to be
// nothing but `Category.monthly_cap` — a fixed survey-derived baseline in
// constants.ts, identical for every user and not settable at all). Stored
// as a map field on the user's own doc, keyed by category id, so any
// category can be capped, not just whichever one a screen happens to
// spotlight. Dot-notation updateDoc touches only the one key being
// changed, leaving every other category's cap in the map untouched.
// ────────────────────────────────────────────────────────────────────────

export async function saveCategoryCap(uid: string, categoryId: string, amount: number): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { [`category_caps.${categoryId}`]: amount });
}

export async function clearCategoryCap(uid: string, categoryId: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { [`category_caps.${categoryId}`]: deleteField() });
}

// ────────────────────────────────────────────────────────────────────────
// "Instances" — named, savable budget-allocation profiles. A user pins
// exact amounts to whichever categories they choose; POST
// /api/v1/ml/allocate-budget (backend/app/ml/engine.py's allocate_budget)
// computes a real suggested split of whatever's left across the rest,
// proportional to that category's own historical spend. Stored per-user in
// a `instances` subcollection (same shape as `transactions`), separate
// from `category_caps` — applying an instance is what writes its full
// resulting allocation (pins + suggestions) into category_caps, plugging
// into the cap UI/language that already exists rather than a parallel
// system. See AuthContext.applyInstance for the apply step.
// ────────────────────────────────────────────────────────────────────────

export interface BudgetInstance {
  id: string;
  name: string;
  pinned: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export async function saveInstance(
  uid: string,
  instance: { name: string; pinned: Record<string, number> },
  existingId?: string
): Promise<string> {
  const now = new Date().toISOString();
  if (existingId) {
    await setDoc(
      doc(db, "users", uid, "instances", existingId),
      { name: instance.name, pinned: instance.pinned, updated_at: now },
      { merge: true }
    );
    return existingId;
  }
  const ref = await addDoc(collection(db, "users", uid, "instances"), {
    name: instance.name,
    pinned: instance.pinned,
    created_at: now,
    updated_at: now,
  });
  return ref.id;
}

export async function deleteInstance(uid: string, instanceId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "instances", instanceId));
}

export interface CategoryAllocation {
  category_id: string;
  category_name: string;
  is_pinned: boolean;
  amount: number;
  is_early_estimate: boolean;
}

export interface AllocateBudgetResult {
  allocations: CategoryAllocation[];
  pinned_total: number;
  remaining_after_pinned: number;
  over_allocated: boolean;
}

/**
 * Real per-user allocation preview — POST /api/v1/ml/allocate-budget. Same
 * auth/request shape as fetchDotGraph/fetchLearningCurve: requires a real
 * Firebase ID token, throws on failure.
 */
export async function fetchBudgetAllocation(
  user: FirebaseUser,
  transactions: Transaction[],
  monthlyBudget: number,
  pinned: Record<string, number>
): Promise<AllocateBudgetResult> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/ml/allocate-budget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: user.uid,
      monthly_budget: monthlyBudget,
      pinned,
      transactions: transactions.map((t) => ({
        amount: t.amount,
        category: t.category,
        subcategory: t.subcategory,
        note: t.note,
        timestamp: t.timestamp,
        source: t.source,
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Allocate-budget request failed: ${res.status}`);
  }
  return res.json();
}

// Full-replace write — applying an instance is authoritative over the whole
// category_caps map (an instance defines a complete allocation across every
// category), unlike saveCategoryCap's single-key dot-notation update.
export async function applyInstanceAllocation(
  uid: string,
  allocation: Record<string, number>,
  instanceId: string
): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { category_caps: allocation, active_instance_id: instanceId });
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
