"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { IconDelete, IconSuggest, IconX } from "@/components/icons";
import { User as FirebaseUser } from "firebase/auth";
import { STARTER_CATEGORIES, FORMAT_INR } from "@/lib/constants";
import { Transaction, Wallet } from "@/types";
import { fetchCategorizeSuggestion, CategorizeSuggestion, computeRepeatCandidates, RepeatCandidate } from "@/lib/api";
import { CategoryIcon } from "./CategoryIcon";

interface QuickLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Brief 8 (2026-09-05): now returns the new transaction's id (demo or
  // real) so a caller can offer a real "Undo." The sheet doesn't wait on
  // this promise for anything of its own — it resets and the parent
  // closes it the moment this is called, before the promise even settles.
  onCommit: (tx: Omit<Transaction, "id">) => Promise<string> | void;
  safeDaily?: number;
  // Real Firebase user, for the note -> Ollama categorization suggestion
  // below. Optional/nullable on purpose: demo/guest mode has no Firebase
  // session to get a token from, so that path just never fires the
  // suggestion call rather than erroring.
  user?: FirebaseUser | null;
  // Wallets feature: active wallets only (caller filters out archived ones)
  // — optional, low-friction override of which real wallet this expense
  // debits, defaulting to whichever was used last. Never shown at all with
  // 0-1 wallets, so a user who's never touched Wallets sees this flow
  // completely unchanged.
  wallets?: Wallet[];
  // Brief 8 (2026-09-05): the user's own transactions, already in memory
  // in the caller — used purely client-side to derive the repeat chips
  // below (no new endpoint). Optional/defaults to empty so this component
  // still works anywhere it isn't passed (there is no such caller left,
  // but it costs nothing to make it a safe default).
  transactions?: Transaction[];
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

const LAST_CATEGORY_STORAGE_KEY = "antara_quicklog_last_category";
const LAST_WALLET_STORAGE_KEY = "antara_quicklog_last_wallet";
const MISC_CATEGORY_ID = "miscellaneous";

// Brief 8 (2026-09-05): "how much can a repeat expense cost in taps" was
// the actual design question this pass answers. A repeat chip is a real
// one-tap log (amount + category + note all already known from history);
// a brand-new expense is amount -> optional note -> commit, with category
// now genuinely optional rather than always defaulting to "whatever was
// picked last" — see the categorize race in commit() below for what fills
// it in when skipped. Full-screen numeric keypad — tap digits (no free
// typing), pick a category chip *if you want to*, commit.
export const QuickLogSheet: React.FC<QuickLogSheetProps> = ({
  isOpen,
  onClose,
  onCommit,
  safeDaily,
  user,
  wallets = [],
  transactions = [],
}) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [walletId, setWalletId] = useState("");
  const [committing, setCommitting] = useState(false);

  // Recomputed only when the sheet is freshly opened, not on every wallets-
  // array update while it's already open (a balance changing elsewhere
  // shouldn't yank the picker back to the default mid-log). Defaults to
  // whichever wallet was used last, falling back to the first active one.
  // Brief 8: this default behavior is deliberately untouched, per the brief.
  useEffect(() => {
    if (!isOpen) return;
    if (!wallets.length) {
      setWalletId("");
      return;
    }
    try {
      const last = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (last && wallets.some((w) => w.id === last)) {
        setWalletId(last);
        return;
      }
    } catch (e) {
      // localStorage unavailable — fall through to the plain default below.
    }
    setWalletId(wallets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Brief 8 (2026-09-05): category is genuinely optional now — no chip is
  // pre-selected on open, including "whatever was logged last" (that used
  // to be the default; see commit() below for what replaces it when this
  // stays null). `null` means "not explicitly chosen," distinct from any
  // real category id, including "miscellaneous" itself.
  const [pick, setPick] = useState<string | null>(null);

  // Reset per-open, not per-mount — a sheet left mounted-but-closed
  // shouldn't carry a stale pick into the next real open.
  useEffect(() => {
    if (isOpen) setPick(null);
  }, [isOpen]);

  // Phase 2 continuation — the note field feeding the Ollama categorizer.
  // A suggestion only ever appears when the model is actually confident
  // (needs_review: false) AND disagrees with whatever's currently picked —
  // staged honesty means a vague note stays quiet rather than nagging with
  // a low-confidence guess, and this never overrides the chip on its own,
  // only offers a tap-to-switch. Only runs at all once a category HAS been
  // explicitly picked — with none picked, commit()'s own categorize race
  // below is what fills it in, so this live-suggestion pass would just be
  // duplicate work for the common "typed a note, never touched a chip" path.
  const [suggestion, setSuggestion] = useState<CategorizeSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSuggestion(null);
    setSuggestionDismissed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = note.trim();
    if (!user || !pick || trimmed.length < 4) return;
    debounceRef.current = setTimeout(() => {
      fetchCategorizeSuggestion(user, trimmed, amount ? parseInt(amount, 10) : undefined)
        .then((result) => {
          if (!result.needs_review && result.category_id && result.category_id !== pick) {
            setSuggestion(result);
          }
        })
        .catch((err) => {
          // Silent, deliberately — a suggestion is a nicety, not a feature
          // the logging flow depends on; a failed fetch here should never
          // block or interrupt someone mid-log.
          console.warn("Categorize suggestion fetch failed:", err);
        });
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, user, pick]);

  // Brief 8 (2026-09-05): up to three repeat chips, recomputed only when
  // the transaction list actually changes (not on every keystroke while
  // the sheet is open) — see computeRepeatCandidates in lib/api.ts.
  const repeatCandidates = useMemo(() => computeRepeatCandidates(transactions), [transactions]);

  const amountNum = amount ? parseInt(amount, 10) : 0;
  const suggestedCategory = suggestion?.category_id
    ? STARTER_CATEGORIES.find((c) => c.id === suggestion.category_id)
    : undefined;

  const applySuggestion = () => {
    if (!suggestion?.category_id) return;
    setPick(suggestion.category_id);
    setSuggestion(null);
  };

  const press = (k: string) => {
    if (k === "del") {
      setAmount((a) => a.slice(0, -1));
    } else if (k === "00") {
      setAmount((a) => (a.length && a.length < 5 ? a + "00" : a));
    } else {
      setAmount((a) => (a.length < 5 && !(k === "0" && !a) ? a + k : a));
    }
  };

  const resetForm = () => {
    setAmount("");
    setNote("");
    setPick(null);
    setSuggestion(null);
  };

  // Brief 8 (2026-09-05): one tap, fully known already (amount, category,
  // note all come straight from a real past transaction) — no categorize
  // race, no Firestore wait from this component's point of view. Uses the
  // *currently selected* wallet default, same as a typed log would.
  const logRepeat = (candidate: RepeatCandidate) => {
    onCommit({
      amount: candidate.amount,
      category: candidate.category,
      subcategory: candidate.subcategory,
      note: candidate.note,
      timestamp: new Date().toISOString(),
      source: "upi",
      ...(walletId ? { wallet_id: walletId } : {}),
    });
    resetForm();
  };

  // Brief 8 (2026-09-05): category is optional. An explicit chip tap still
  // wins outright (1 tap, unchanged). Left unpicked with a note typed, this
  // races the local categorizer against a hard 1.5s timeout — never longer,
  // whether the model is slow or the whole service is down — and falls
  // back to "miscellaneous" either way rather than ever blocking the log
  // itself on a server being up. Left unpicked with no note either, there's
  // no signal to categorize from, so it's "miscellaneous" immediately, no
  // network call at all. Firestore itself is never awaited here — this
  // resolves the *category*, then hands a fully-formed transaction to
  // onCommit, which the caller closes the sheet on immediately, persisting
  // in the background (see app/page.tsx's handleCommit).
  const commit = async () => {
    if (!amountNum || committing) return;
    const trimmedNote = note.trim();
    let finalCategory = pick;
    if (!finalCategory) {
      if (trimmedNote && user) {
        setCommitting(true);
        finalCategory = await Promise.race<string>([
          fetchCategorizeSuggestion(user, trimmedNote, amountNum)
            .then((r) => (!r.needs_review && r.category_id ? r.category_id : MISC_CATEGORY_ID))
            .catch(() => MISC_CATEGORY_ID),
          new Promise<string>((resolve) => setTimeout(() => resolve(MISC_CATEGORY_ID), 1500)),
        ]);
      } else {
        finalCategory = MISC_CATEGORY_ID;
      }
    }
    const categoryMeta =
      STARTER_CATEGORIES.find((c) => c.id === finalCategory) ||
      STARTER_CATEGORIES.find((c) => c.id === MISC_CATEGORY_ID) ||
      STARTER_CATEGORIES[0];

    onCommit({
      amount: amountNum,
      category: categoryMeta.id,
      subcategory: categoryMeta.subcategories[0] || "",
      note: trimmedNote,
      timestamp: new Date().toISOString(),
      source: "upi",
      ...(walletId ? { wallet_id: walletId } : {}),
    });
    try {
      // Only ever remember an EXPLICIT pick — "miscellaneous" arrived at
      // by skipping the step entirely shouldn't become tomorrow's default.
      if (pick) localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, pick);
      if (walletId) localStorage.setItem(LAST_WALLET_STORAGE_KEY, walletId);
    } catch (e) {
      // Non-fatal — just means next time won't default to this wallet.
    }
    setCommitting(false);
    resetForm();
  };

  const todayLabel = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/76 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 rounded-t-lg bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-3.5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-3.5" />

            <div className="flex items-baseline gap-2.5">
              <h5 className="text-sm font-semibold text-white m-0">What did you spend?</h5>
              <span className="ml-auto text-xs text-gray-500" suppressHydrationWarning>
                {todayLabel}
              </span>
            </div>

            {/* Brief 8 (2026-09-05): the fast path — a real repeat, one
                tap, done. Sits above everything else, including the
                amount display, since it's the whole point of this brief:
                the two-second log for something you've logged before. */}
            {repeatCandidates.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-5 px-5 no-scrollbar">
                {repeatCandidates.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => logRepeat(c)}
                    className="flex-none px-3.5 py-2 rounded-full bg-primary-500/12 border border-primary-500/30 text-xs font-semibold text-primary-200 whitespace-nowrap active:scale-95 transition-transform"
                  >
                    {c.note || STARTER_CATEGORIES.find((cat) => cat.id === c.category)?.short || c.category}
                    {" · "}
                    {FORMAT_INR(c.amount)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-baseline justify-center gap-1 py-3.5">
              <span className="text-3xl font-mono font-medium text-gray-600">₹</span>
              <span
                className="text-5xl font-mono leading-none font-medium tracking-tight tabular-nums"
                style={{ color: amount ? "#e9e9ed" : "#59545c" }}
              >
                {amountNum ? amountNum.toLocaleString("en-IN") : "0"}
              </span>
            </div>
            <div className="text-center text-xs text-gray-500 mb-3">
              {amount && safeDaily
                ? `That is ${(amountNum / safeDaily).toFixed(1)}× a safe day`
                : "Tap the amount — a category's optional"}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3.5 -mx-5 px-5 no-scrollbar">
              {STARTER_CATEGORIES.map((c) => {
                const active = pick === c.id;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => setPick(active ? null : c.id)}
                    whileTap={{ scale: 0.94 }}
                    className={`flex-none flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                      active
                        ? "bg-primary-500/20 border-primary-500 text-primary-200"
                        : "bg-white/5 border-white/10 text-gray-400"
                    }`}
                  >
                    <CategoryIcon category={c} size={22} />
                    <span>{c.short}</span>
                  </motion.button>
                );
              })}
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="What was it? (optional — e.g. 'McDonald's with Aryan')"
              className="w-full h-11 mb-2 px-3.5 rounded-sm bg-white/5 border border-white/10 text-xs text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
            />

            {suggestedCategory && !suggestionDismissed && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={applySuggestion}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-2 mb-2.5 pl-2.5 pr-2 py-2 rounded-sm bg-primary-500/10 border border-primary-500/30 text-left"
              >
                <IconSuggest className="w-3.5 h-3.5 text-primary-300 shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-primary-200">
                  Sounds like <span className="font-semibold">{suggestedCategory.name}</span> — tap to switch
                </span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSuggestionDismissed(true);
                  }}
                  className="shrink-0 p-1 rounded-sm text-primary-400/70 hover:text-primary-200 active:opacity-60"
                >
                  <IconX className="w-3.5 h-3.5" />
                </span>
              </motion.button>
            )}

            {/* Wallets feature: a quick, optional override of which wallet
                this debits — never shown at all with 0-1 wallets, so this
                adds zero friction for anyone who hasn't touched Wallets. */}
            {wallets.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 -mx-5 px-5 no-scrollbar">
                <span className="shrink-0 text-xs text-gray-600">From</span>
                {wallets.map((w) => {
                  const active = walletId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWalletId(w.id)}
                      className={`flex-none px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                        active ? "bg-white/10 border-white/25 text-gray-200" : "bg-transparent border-white/10 text-gray-500"
                      }`}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <motion.button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  whileTap={{ scale: 0.93 }}
                  className="h-[50px] rounded-lg bg-white/5 text-white text-xl font-medium flex items-center justify-center"
                  style={{ transition: "background-color .15s ease" }}
                >
                  {k === "del" ? <IconDelete className="w-5 h-5" /> : k}
                </motion.button>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={commit}
              disabled={!amountNum || committing}
              whileTap={{ scale: 0.98 }}
              className="w-full h-12 mt-3.5 rounded-lg bg-transparent border border-primary-500/60 text-primary-300 font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {committing
                ? "Logging…"
                : amountNum
                ? pick
                  ? `Log ₹${amountNum.toLocaleString("en-IN")} · ${STARTER_CATEGORIES.find((c) => c.id === pick)?.short}`
                  : `Log ₹${amountNum.toLocaleString("en-IN")}`
                : "Enter an amount"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
