"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Delete, Sparkles, X } from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { STARTER_CATEGORIES } from "@/lib/constants";
import { Transaction, Wallet } from "@/types";
import { fetchCategorizeSuggestion, CategorizeSuggestion } from "@/lib/api";
import { CategoryIcon } from "./CategoryIcon";

interface QuickLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (tx: Omit<Transaction, "id">) => void;
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
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

const LAST_CATEGORY_STORAGE_KEY = "antara_quicklog_last_category";
const LAST_WALLET_STORAGE_KEY = "antara_quicklog_last_wallet";

// Full-screen numeric keypad quick-log sheet — tap digits (no free typing),
// pick a category chip, commit. Replaces the old amount-field + chips modal.
//
// Phase 2: defaults the category picker to whatever was logged last, not
// always the first category in the list — most real usage logs a few
// things in the same category back to back (a few snacks in a row, a run
// of transit taps), so remembering it saves a tap on the common case
// instead of always making you re-pick "Food" from scratch.
export const QuickLogSheet: React.FC<QuickLogSheetProps> = ({ isOpen, onClose, onCommit, safeDaily, user, wallets = [] }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [walletId, setWalletId] = useState("");

  // Recomputed only when the sheet is freshly opened, not on every wallets-
  // array update while it's already open (a balance changing elsewhere
  // shouldn't yank the picker back to the default mid-log). Defaults to
  // whichever wallet was used last, falling back to the first active one.
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
  const [pick, setPick] = useState(() => {
    try {
      const last = localStorage.getItem(LAST_CATEGORY_STORAGE_KEY);
      if (last && STARTER_CATEGORIES.some((c) => c.id === last)) return last;
    } catch (e) {
      // localStorage unavailable (private mode etc.) — just use the default below.
    }
    return STARTER_CATEGORIES[0].id;
  });
  // Phase 2 continuation — the note field feeding the Ollama categorizer.
  // A suggestion only ever appears when the model is actually confident
  // (needs_review: false) AND disagrees with whatever's currently picked —
  // staged honesty means a vague note stays quiet rather than nagging with
  // a low-confidence guess, and this never overrides the chip on its own,
  // only offers a tap-to-switch.
  const [suggestion, setSuggestion] = useState<CategorizeSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSuggestion(null);
    setSuggestionDismissed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = note.trim();
    // Demo/guest has no Firebase session to call the backend with, and a
    // very short note ("a", "ok") isn't worth a network round-trip — the
    // model would just come back needs_review anyway (see the confidence
    // calibration this pass was built and verified against).
    if (!user || trimmed.length < 4) return;
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
  }, [note, user]);

  const category = STARTER_CATEGORIES.find((c) => c.id === pick) || STARTER_CATEGORIES[0];
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

  const commit = () => {
    if (!amountNum) return;
    onCommit({
      amount: amountNum,
      category: pick,
      subcategory: category.subcategories[0] || "",
      note: note.trim(),
      timestamp: new Date().toISOString(),
      source: "upi",
      ...(walletId ? { wallet_id: walletId } : {}),
    });
    try {
      localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, pick);
      if (walletId) localStorage.setItem(LAST_WALLET_STORAGE_KEY, walletId);
    } catch (e) {
      // Non-fatal — just means next time won't default to this category/wallet.
    }
    setAmount("");
    setNote("");
    setSuggestion(null);
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
                : "Tap the amount, pick where it went"}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3.5 -mx-5 px-5 no-scrollbar">
              {STARTER_CATEGORIES.map((c) => {
                const active = pick === c.id;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => setPick(c.id)}
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
                <Sparkles className="w-3.5 h-3.5 text-primary-300 shrink-0" />
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
                  <X className="w-3.5 h-3.5" />
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
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </motion.button>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={commit}
              disabled={!amountNum}
              whileTap={{ scale: 0.98 }}
              className="w-full h-12 mt-3.5 rounded-lg bg-transparent border border-primary-500/60 text-primary-300 font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {amountNum ? `Log ₹${amountNum.toLocaleString("en-IN")} · ${category.short}` : "Enter an amount"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
