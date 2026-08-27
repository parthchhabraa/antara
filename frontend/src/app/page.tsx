"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MobileFrame } from "@/components/MobileFrame";
import { BurnGauge } from "@/components/BurnGauge";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { CategoryDetailSheet } from "@/components/CategoryDetailSheet";
import { TransactionEditSheet } from "@/components/TransactionEditSheet";
import { BudgetSheet } from "@/components/BudgetSheet";
import { InstancesSheet } from "@/components/InstancesSheet";
import { WalletsSheet } from "@/components/WalletsSheet";
import { WhyPredictionSheet } from "@/components/WhyPredictionSheet";
import { NewUserOnboardingSheet } from "@/components/NewUserOnboardingSheet";
import { AntaraWordmark } from "@/components/AntaraWordmark";
import { CountUpNumber } from "@/components/CountUpNumber";
import { PageTransition } from "@/components/PageTransition";
import { DEMO_TRANSACTIONS, DEMO_REFERENCE_DATE, DEMO_WALLETS, FORMAT_INR, STARTER_CATEGORIES } from "@/lib/constants";
import {
  calculateBurnMetrics,
  addLiveTransaction,
  deleteLiveTransaction,
  updateLiveTransaction,
  computeStreakUpdate,
  streakToastMessage,
  saveStreakUpdate,
  isColdStart,
  createWallet,
} from "@/lib/api";
import { Transaction, Wallet } from "@/types";
import { useAuth } from "@/lib/AuthContext";

export default function TodayPage() {
  const {
    user,
    profile,
    isDemoMode,
    signInWithGoogle,
    refreshClaims,
    isNewUser,
    dismissNewUserBanner,
    setMonthlyBudget,
    setCategoryCap,
    applyInstance,
  } = useAuth();
  const [demoTxs, setDemoTxs] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [liveTxs, setLiveTxs] = useState<Transaction[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isBudgetEditOpen, setIsBudgetEditOpen] = useState(false);
  const [isInstancesOpen, setIsInstancesOpen] = useState(false);
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [isWalletsOpen, setIsWalletsOpen] = useState(false);
  const [demoWallets, setDemoWallets] = useState<Wallet[]>(DEMO_WALLETS);
  const [liveWallets, setLiveWallets] = useState<Wallet[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  // `user` is null AND isDemoMode is true for every fresh/unauthenticated
  // visit (AuthContext only ever sets isDemoMode=false once a real signed-in,
  // allowlisted user resolves) — so the hero can't gate on isDemoMode itself,
  // or it would show forever. This local flag lets a visitor dismiss the
  // hero into demo browsing without an account, same as the app always
  // allowed; it resets on reload rather than persisting, which is fine for
  // a "first thing you see" screen.
  const [heroDismissed, setHeroDismissed] = useState(false);

  // What's New's action buttons (see WhatsNewSheet.tsx) can deep-link
  // straight into a feature's setup flow, e.g. "Open Wallets" ->
  // "/?open=wallets" — plain window.location read in an effect rather than
  // useSearchParams() so this page doesn't need a Suspense boundary just
  // for a one-off query param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const open = new URLSearchParams(window.location.search).get("open");
    if (open === "wallets") setIsWalletsOpen(true);
  }, []);

  const transactions = isDemoMode ? demoTxs : liveTxs;
  const monthlyBudget = profile?.monthly_budget || 5000;
  // Demo mode uses a fixed reference date; live mode is only ever rendered
  // client-side (post-auth, post-hydration), so real "now" is safe there.
  // See the hydration note above DEMO_TRANSACTIONS in constants.ts.
  const today = isDemoMode ? DEMO_REFERENCE_DATE : new Date();

  useEffect(() => {
    if (isDemoMode || !user) return;
    try {
      const txCol = collection(db, "users", user.uid, "transactions");
      const q = query(txCol, orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: Transaction[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Transaction, "id">),
        }));
        setLiveTxs(fetched);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore live query on Today screen:", e);
    }
  }, [isDemoMode, user]);

  // Wallets feature — live subscription, same pattern as transactions
  // above. A `didAutoCreate` ref guards the auto-create-a-default-wallet
  // effect below so it only ever fires once per mount even though this
  // callback re-runs on every snapshot (e.g. right after that same create
  // resolves) — without it, a slow first write could race a second
  // "Main" wallet into existence before the snapshot catches up.
  const didAutoCreateWallet = React.useRef(false);
  useEffect(() => {
    if (isDemoMode || !user) return;
    try {
      const walletCol = collection(db, "users", user.uid, "wallets");
      const q = query(walletCol, orderBy("created_at", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: Wallet[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Wallet, "id">),
        }));
        setLiveWallets(fetched);
        // Brief: "the app is never in a state with no wallet to fall back
        // to" — auto-create one real default wallet the first time a real
        // account with zero wallets loads this screen, not gated behind
        // ever opening the Wallets sheet.
        if (fetched.length === 0 && !didAutoCreateWallet.current) {
          didAutoCreateWallet.current = true;
          createWallet(user.uid, "Main").catch((err) => {
            console.warn("Auto-create default wallet failed:", err);
            didAutoCreateWallet.current = false; // allow a retry on the next snapshot
          });
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore wallets query on Today screen:", e);
    }
  }, [isDemoMode, user]);

  const wallets = isDemoMode ? demoWallets : liveWallets;
  const activeWallets = useMemo(() => wallets.filter((w) => !w.archived), [wallets]);
  const walletsTotal = useMemo(() => activeWallets.reduce((s, w) => s + w.balance, 0), [activeWallets]);
  // Same "most-recently-used, else first" default QuickLogSheet computes for
  // its own picker, mirrored here just for the WalletsSheet/IncomeLogSheet's
  // own default — read fresh each render rather than lifted into state, so
  // it always reflects whatever QuickLogSheet last actually used.
  const defaultWalletId = useMemo(() => {
    if (!activeWallets.length) return undefined;
    try {
      const last = localStorage.getItem("antara_quicklog_last_wallet");
      if (last && activeWallets.some((w) => w.id === last)) return last;
    } catch (e) {
      // localStorage unavailable — fall through to the plain default below.
    }
    return activeWallets[0].id;
  }, [activeWallets]);

  const metrics = useMemo(
    () => calculateBurnMetrics(transactions, monthlyBudget, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, monthlyBudget, isDemoMode]
  );

  // Bug fix: "Still calibrating…" previously only ever showed in
  // WhyPredictionSheet/ArchetypeSheet — the burn ring and "money runs out"
  // card here are the same cold-start-sensitive predictions (pace, run-out
  // date) but never disclosed it. Same established condition (see
  // isColdStart's own comment), just evaluated client-side since this
  // screen's numbers are already pure client-side math.
  const coldStart = useMemo(() => isColdStart(transactions), [transactions]);

  // Phase 2 continuation — the week-bar strip is now a real date selector,
  // not decoration. `null` means "no day picked, show today's live view"
  // (the default); tapping a bar sets it to that bar's dateKey, and
  // tapping the same bar again (or today's own bar) clears it back to
  // null. Deliberately a separate concept from "today" itself — `today`
  // stays the actual calendar day the rest of the app's month-pacing math
  // (metrics, streak, budget) is computed against; this only decides what
  // the Today screen's own top section currently *displays*.
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const todayDateKey = today.toDateString();
  const isDaySelected = selectedDateKey !== null && selectedDateKey !== todayDateKey;

  const dayTransactions = useMemo(() => {
    if (!isDaySelected) return [];
    return transactions
      .filter((t) => new Date(t.timestamp).toDateString() === selectedDateKey)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, selectedDateKey, isDaySelected]);

  const daySpent = dayTransactions.reduce((s, t) => s + t.amount, 0);
  const dayByCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    dayTransactions.forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return STARTER_CATEGORIES.filter((c) => totals[c.id] > 0)
      .map((c) => ({ category: c, amount: totals[c.id] }))
      .sort((a, b) => b.amount - a.amount);
  }, [dayTransactions]);

  const selectedBarLabel = useMemo(() => {
    if (!isDaySelected || !selectedDateKey) return "";
    const bar = metrics.weekBars.find((b) => b.dateKey === selectedDateKey);
    return bar ? new Date(selectedDateKey).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" }) : "";
  }, [isDaySelected, selectedDateKey, metrics.weekBars]);

  const handleCommit = async (newTx: Omit<Transaction, "id">) => {
    let milestoneLine: string | null = null;
    if (isDemoMode) {
      setDemoTxs([{ ...newTx, id: "tx-" + Date.now() }, ...demoTxs]);
      // Demo wallets are fully locally-interactive, same as demoTxs above —
      // a demo user picking a wallet chip and logging should see the real
      // effect immediately, not a picker that silently does nothing.
      if (newTx.wallet_id) {
        setDemoWallets((prev) => prev.map((w) => (w.id === newTx.wallet_id ? { ...w, balance: w.balance - newTx.amount } : w)));
      }
    } else if (user) {
      // Every real log needs to actually land in Firestore — it's the training
      // data for the ML personalization, not just something to show on screen.
      // No local-only fallback here on purpose: faking a successful "Logged ₹X"
      // toast while the write silently failed would mean that transaction is
      // gone from Firebase forever, invisible to the model, with the user none
      // the wiser. If it fails, say so and stop — don't close the sheet, don't
      // touch the streak, don't show a false success toast.
      try {
        await addLiveTransaction(user.uid, newTx);
      } catch (err) {
        console.error("Error writing transaction to Firestore:", err);
        setToast("Couldn't save that — check your connection and try again. Nothing was logged.");
        window.setTimeout(() => setToast(null), 3400);
        return;
      }
      // Transaction is confirmed saved at this point. The streak update is a
      // secondary effect on top of it — if this part fails, the log itself is
      // still safely in Firebase; just don't let a streak-write hiccup make it
      // look like the log itself didn't happen.
      try {
        const streakResult = computeStreakUpdate(
          {
            currentStreak: profile?.currentStreak,
            longestStreak: profile?.longestStreak,
            lastLoggedDate: profile?.lastLoggedDate,
            streakFreezesAvailable: profile?.streakFreezesAvailable,
          },
          new Date()
        );
        await saveStreakUpdate(user.uid, streakResult);
        await refreshClaims(); // re-fetch profile so the header's streak badge updates
        milestoneLine = streakToastMessage(streakResult);
      } catch (err) {
        console.warn("Streak update failed (the transaction itself was saved fine):", err);
      }
    }
    setIsLogOpen(false);
    const line =
      newTx.amount > 300
        ? `Logged ${FORMAT_INR(newTx.amount)}. That nudges the date — check the ring.`
        : `Logged ${FORMAT_INR(newTx.amount)}. Small one, barely moves the date. Nice.`;
    setToast(milestoneLine ? `${line} ${milestoneLine}` : line);
    window.setTimeout(() => setToast(null), 3400);
  };

  // Step 13 §2 — deliberately do not touch streak fields here (see the
  // comment on deleteLiveTransaction in lib/api.ts): the streak reflects
  // "logged something that day," already true regardless of what happens to
  // this specific entry later. Burn rate / "Why this pace?" need no special
  // handling either — both are recomputed from `transactions` on every
  // render, and removing/editing this row updates that array directly (demo:
  // local state; live: onSnapshot fires after the Firestore write resolves).
  const handleDeleteTx = async (txId: string) => {
    if (isDemoMode) {
      setDemoTxs((prev) => prev.filter((t) => t.id !== txId));
    } else if (user) {
      await deleteLiveTransaction(user.uid, txId);
    }
    setToast("Entry deleted.");
    window.setTimeout(() => setToast(null), 2400);
  };

  const handleEditTx = async (txId: string, updates: Partial<Omit<Transaction, "id">>) => {
    if (isDemoMode) {
      setDemoTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, ...updates } : t)));
    } else if (user) {
      await updateLiveTransaction(user.uid, txId, updates);
    }
    setToast("Entry updated.");
    window.setTimeout(() => setToast(null), 2400);
  };

  const detailCategory = STARTER_CATEGORIES.find((c) => c.id === detailCategoryId) || null;
  const detailEntries = detailCategoryId ? transactions.filter((t) => t.category === detailCategoryId) : [];

  // Both derived from `today` (fixed in demo mode, real in live mode — see the
  // hydration note on `today` above) rather than hardcoded "Aug": that was a
  // leftover from when demo data was the only thing ever rendered here, and
  // silently wrong for any real user in any month but August.
  const monthShort = today.toLocaleDateString("en-US", { month: "short" });
  const monthLong = today.toLocaleDateString("en-US", { month: "long" });
  const runOutDate = `${metrics.runOutDay} ${monthShort}`;
  const earlyLabel = metrics.earlyDays > 0 ? `${metrics.earlyDays} days early` : "right on the line";
  const coachLine =
    metrics.weekRate > metrics.safeDaily
      ? `Ease off ${FORMAT_INR(metrics.weekRate - metrics.safeDaily)} a day — about two fewer delivery nights — and ${monthLong} lands clean.`
      : `You're ${FORMAT_INR(metrics.safeDaily - metrics.weekRate)} a day under. Keep it up and you finish with money spare.`;

  // ── Signed-out hero ──────────────────────────────────────────────
  if (!user && !heroDismissed) {
    return (
      <MobileFrame immersive>
        <div className="min-h-screen flex flex-col justify-between -mx-4 -my-4 px-7 pt-8 pb-10 bg-[radial-gradient(90%_60%_at_50%_18%,#262a60_0%,#171a2c_55%,#101220_100%)]">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <AntaraWordmark />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <h2 className="text-[34px] leading-[1.1] tracking-tight text-white m-0 mb-2.5">
              Know where your
              <br />
              month is heading.
            </h2>
            <p className="text-sm leading-relaxed text-gray-400 mb-6">
              Log what you spend in two taps. Antara does the maths and tells you the one date that matters.
            </p>
            <button
              onClick={signInWithGoogle}
              className="w-full h-[50px] rounded-2xl bg-transparent border border-primary-500/60 text-primary-300 font-bold text-[15px] active:scale-[0.97] transition-transform"
            >
              Continue with Google
            </button>
            <button
              onClick={() => setHeroDismissed(true)}
              className="w-full h-11 mt-1 text-[13px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Continue in Demo Mode
            </button>
            <p className="text-center text-[11px] text-gray-600 mt-3">
              By continuing you agree to our{" "}
              <a href="/terms" className="text-gray-400 underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-gray-400 underline">
                Privacy Policy
              </a>
              .
            </p>
          </motion.div>
        </div>
      </MobileFrame>
    );
  }

  // ── Today screen ─────────────────────────────────────────────────
  return (
    <MobileFrame onOpenQuickLog={() => setIsLogOpen(true)}>
      <PageTransition className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white" suppressHydrationWarning>
            {isDemoMode
              ? "Wednesday, 19 Aug"
              : today.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
          </span>
          <span className="ml-auto text-[11px] text-gray-600">
            DAY {metrics.today} / {metrics.daysInMonth}
          </span>
        </div>

        {/* Wallets — real cash-on-hand, deliberately its own small card with
            its own (emerald, not primary-violet) accent so it never reads as
            part of the budget/burn-rate numbers below: that's a *plan*
            against total spend, this is a real running balance. Tapping
            opens the full Wallets sheet (create/rename/archive/add income). */}
        <button
          type="button"
          onClick={() => setIsWalletsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 active:opacity-70 transition-opacity mb-1"
        >
          <span className="text-[11px] font-medium tracking-wide text-emerald-400/90">WALLETS</span>
          <span className={`ml-auto text-[15px] font-medium ${walletsTotal < 0 ? "text-rose-300" : "text-emerald-100"}`}>
            {FORMAT_INR(walletsTotal)}
          </span>
          <span className="text-[11px] text-gray-500">
            {activeWallets.length} wallet{activeWallets.length === 1 ? "" : "s"}
          </span>
        </button>

        {/* Week bars — Phase 2 continuation: a real date selector now, not
            decoration. The "selected" highlight (ring + primary label)
            follows whatever's actually picked, defaulting to today; a
            small dot marks the real "today" bar too whenever some other
            day is the one selected, so it never gets ambiguous which is
            which. Tapping the already-selected bar (or today's own bar)
            clears the selection back to the live Today view. */}
        <div className="flex gap-1.5 pt-3.5 pb-1.5">
          {metrics.weekBars.map((b, i) => {
            const isSelected = (selectedDateKey ?? todayDateKey) === b.dateKey;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDateKey(b.dateKey === todayDateKey ? null : b.dateKey === selectedDateKey ? null : b.dateKey)}
                className="flex-1 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
              >
                <div
                  className={`w-full h-11 rounded flex items-end bg-white/[0.08] overflow-hidden transition-shadow ${
                    isSelected ? "ring-2 ring-primary-400" : ""
                  }`}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${b.heightPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-full rounded ${b.heightPct > 60 ? "bg-primary-400" : "bg-gray-500/45"}`}
                  />
                </div>
                <span className={`text-[9px] flex items-center gap-1 ${isSelected ? "text-primary-300" : "text-gray-600"}`}>
                  {b.day}
                  {b.isToday && !isSelected && <span className="w-1 h-1 rounded-full bg-gray-500" />}
                </span>
              </button>
            );
          })}
        </div>

        {isDaySelected ? (
          /* Phase 2 continuation — day view. Deliberately NOT the same
             month-pacing gauge/cards (a "burn rate" or "run-out date"
             doesn't mean anything for a single past day) — real numbers
             for that one day instead: what was spent, on what, in what
             order. */
          <>
            <div className="flex items-center justify-between mt-3">
              <div>
                <div className="text-[10px] font-medium tracking-[0.14em] text-primary-300 mb-1">{selectedBarLabel.toUpperCase()}</div>
                <div className="text-3xl font-medium tracking-tight text-white">{FORMAT_INR(daySpent)}</div>
              </div>
              <button
                onClick={() => setSelectedDateKey(null)}
                className="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-[12.5px] font-medium text-gray-300 active:opacity-70 transition-opacity"
              >
                Back to today
              </button>
            </div>

            {dayByCategory.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 pt-4 -mx-5 px-5 no-scrollbar">
                {dayByCategory.map(({ category: c, amount }) => (
                  <div
                    key={c.id}
                    className="flex-none px-3 py-1.5 rounded-full bg-white/[0.06] text-[11.5px] text-gray-300 whitespace-nowrap"
                  >
                    {c.short} · {FORMAT_INR(amount)}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col">
              {dayTransactions.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">Nothing logged on {selectedBarLabel}.</p>
              ) : (
                dayTransactions.map((t) => {
                  const cat = STARTER_CATEGORIES.find((c) => c.id === t.category);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditingTx(t)}
                      className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Bug fix: same headline/subtitle swap as CategoryDetailSheet —
                            the user's own note is the headline when they gave one,
                            falling back to the generic category/subcategory tag only
                            when they didn't type anything. */}
                        <div className="text-[13px] text-gray-100 truncate">{t.note || cat?.name || t.category}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {new Date(t.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {t.note && (t.subcategory || cat?.name) ? ` · ${t.subcategory || cat?.name}` : ""}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-white shrink-0">{FORMAT_INR(t.amount)}</span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* Burn gauge */}
            <div className="flex flex-col items-center py-3.5">
              <BurnGauge burnPct={metrics.burnPct} />
            </div>
            <div className="text-center text-[13px] text-gray-400 leading-relaxed -mt-1 mb-2">
              You're running {FORMAT_INR(metrics.weekRate)} a day.
              <br />
              Safe is {FORMAT_INR(metrics.safeDaily)}.
            </div>
            {coldStart && (
              <p className="text-center text-[11.5px] leading-relaxed text-amber-200/80 -mt-1 mb-2">
                Still calibrating to your data — the more you log, the sharper this gets.
              </p>
            )}
            {/* Step 13 §1 — the edit affordance the brief asked for: budget isn't
                locked in at onboarding, it's always one tap away from here. */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={() => setIsBudgetEditOpen(true)}
                className="text-[11.5px] text-gray-500 underline decoration-dotted decoration-gray-600 underline-offset-4 active:opacity-60 transition-opacity"
              >
                Budget {FORMAT_INR(monthlyBudget)}/mo · Edit
              </button>
              <span className="text-gray-700 text-[11px]">·</span>
              <button
                onClick={() => setIsInstancesOpen(true)}
                className="text-[11.5px] text-gray-500 underline decoration-dotted decoration-gray-600 underline-offset-4 active:opacity-60 transition-opacity"
              >
                Instances
              </button>
            </div>

            {/* Money runs out */}
            <div className="rounded-2xl border border-primary-800/60 bg-gradient-to-br from-primary-950/50 to-[#171a2c]/60 p-4">
              <div className="text-[10px] font-medium tracking-[0.14em] text-primary-300 mb-2">MONEY RUNS OUT</div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl font-medium tracking-tight text-white">{runOutDate}</span>
                <span className="text-xs text-gray-400">{earlyLabel}</span>
              </div>
              <button
                onClick={() => setIsWhyOpen(true)}
                className="block w-full text-left text-[13.5px] leading-relaxed text-gray-200 mt-3 underline decoration-dotted decoration-gray-500 underline-offset-4 active:opacity-70 transition-opacity"
              >
                {coachLine}
              </button>
              {metrics.riskRows[0] && (
                <button
                  onClick={() => setDetailCategoryId(metrics.riskRows[0].categoryId)}
                  className="mt-3.5 h-10 px-4 rounded-xl bg-transparent border border-primary-500/60 text-primary-300 text-[13px] font-bold active:scale-[0.97] transition-transform"
                >
                  Show me the plan
                </button>
              )}
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-2 mt-3.5">
              <div className="p-3 rounded-2xl bg-white/[0.06]">
                <div className="text-[10px] text-gray-600 tracking-wide">LEFT</div>
                <div className="text-[19px] font-medium text-white mt-1">
                  <CountUpNumber value={metrics.left} format={FORMAT_INR} />
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.06]">
                <div className="text-[10px] text-gray-600 tracking-wide">PER DAY</div>
                <div className="text-[19px] font-medium text-white mt-1">{FORMAT_INR(metrics.safeDaily)}</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.06]">
                <div className="text-[10px] text-gray-600 tracking-wide">DAYS</div>
                <div className="text-[19px] font-medium text-white mt-1">
                  <CountUpNumber value={metrics.daysLeft} />
                </div>
              </div>
            </div>

            {/* What's pushing the date */}
            <div className="flex items-baseline mt-6 mb-2.5">
              <h5 className="text-sm font-semibold text-white m-0">What's pushing the date</h5>
              <span className="ml-auto text-[11px] text-gray-600">tap a row</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {metrics.riskRows.length === 0 && (
                <p className="py-6 text-center text-xs text-gray-500">Log an expense to see what's driving your pace.</p>
              )}
              {metrics.riskRows.map((r) => (
                <button
                  key={r.categoryId}
                  onClick={() => setDetailCategoryId(r.categoryId)}
                  className="text-left bg-transparent border-0 py-2.5 flex flex-col gap-1.5 border-b border-white/5 last:border-0 active:opacity-60 transition-opacity"
                >
                  <span className="flex items-baseline gap-2 w-full">
                    <span className="text-[13.5px] text-gray-100">{r.name}</span>
                    <span className="ml-auto text-xs text-gray-500">{FORMAT_INR(r.perDay)}/day</span>
                  </span>
                  <span className="block w-full h-[3px] rounded-full bg-white/10 relative overflow-hidden">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.min(100, r.sharePct * 2.3)}%`, backgroundColor: r.isEssential ? "#75798c" : "#8B5CF6" }}
                    />
                  </span>
                  <span className="text-[11px] text-gray-600">
                    {r.isEssential
                      ? `Mostly fixed · ${FORMAT_INR(r.projectedMore)} more expected`
                      : `Yours to control · ${FORMAT_INR(r.projectedMore)} more if nothing changes`}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="h-8" />

        <QuickLogSheet
          isOpen={isLogOpen}
          onClose={() => setIsLogOpen(false)}
          onCommit={handleCommit}
          safeDaily={metrics.safeDaily}
          user={user}
          wallets={activeWallets}
        />
        <WalletsSheet
          isOpen={isWalletsOpen}
          onClose={() => setIsWalletsOpen(false)}
          wallets={wallets}
          defaultWalletId={defaultWalletId}
          isDemoMode={isDemoMode}
          user={user}
          onToast={(message) => {
            setToast(message);
            window.setTimeout(() => setToast(null), 3000);
          }}
        />
        <CategoryDetailSheet
          category={detailCategory}
          entries={detailEntries}
          onClose={() => setDetailCategoryId(null)}
          onSelectEntry={setEditingTx}
          userCap={detailCategoryId ? profile?.category_caps?.[detailCategoryId] : undefined}
          onSaveCap={detailCategoryId ? (amount) => setCategoryCap(detailCategoryId, amount) : undefined}
          onClearCap={detailCategoryId ? () => setCategoryCap(detailCategoryId, null) : undefined}
        />
        <TransactionEditSheet
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={handleEditTx}
          onDelete={handleDeleteTx}
        />
        <BudgetSheet
          isOpen={isBudgetEditOpen}
          mode="edit"
          currentAmount={monthlyBudget}
          onClose={() => setIsBudgetEditOpen(false)}
          onSave={async (amount) => {
            await setMonthlyBudget(amount);
            setIsBudgetEditOpen(false);
          }}
        />
        <InstancesSheet
          isOpen={isInstancesOpen}
          onClose={() => setIsInstancesOpen(false)}
          transactions={transactions}
          monthlyBudget={monthlyBudget}
          isDemoMode={isDemoMode}
          user={user}
          activeInstanceId={profile?.active_instance_id}
          onApply={applyInstance}
        />
        <WhyPredictionSheet
          isOpen={isWhyOpen}
          onClose={() => setIsWhyOpen(false)}
          riskRows={metrics.riskRows}
          transactions={transactions}
          monthlyBudget={monthlyBudget}
          today={today}
          isDemoMode={isDemoMode}
          user={user}
        />
        <NewUserOnboardingSheet isOpen={isNewUser} onClose={dismissNewUserBanner} />

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-6 right-6 top-[104px] z-[90] p-3.5 rounded-2xl bg-primary-900/95 shadow-2xl text-[13.5px] leading-relaxed text-white"
          >
            {toast}
          </motion.div>
        )}
      </PageTransition>
    </MobileFrame>
  );
}
