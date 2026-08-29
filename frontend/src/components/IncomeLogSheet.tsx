"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Delete } from "lucide-react";
import { Wallet } from "@/types";
import { FORMAT_INR } from "@/lib/constants";

interface IncomeLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[]; // active (non-archived) wallets only — caller filters
  defaultWalletId?: string;
  onCommit: (income: { amount: number; source: string; timestamp: string; wallet_id: string }) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

// Parallel to QuickLogSheet (same keypad pattern, same bottom-sheet shell)
// but for income, not expense: amount, an optional free-text source, a
// date, and which wallet it lands in. Deliberately its own sheet, not a
// mode toggle bolted onto QuickLogSheet — income and expense are different
// enough events (different fields, opposite effect on a wallet's balance)
// that forcing them through one form would mean more conditional UI than
// two focused ones.
export const IncomeLogSheet: React.FC<IncomeLogSheetProps> = ({ isOpen, onClose, wallets, defaultWalletId, onCommit }) => {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [walletId, setWalletId] = useState(defaultWalletId || wallets[0]?.id || "");

  // Keep the selected wallet valid if the sheet opens with a different
  // default than last time (e.g. the most-recently-used wallet changed).
  React.useEffect(() => {
    if (isOpen) setWalletId(defaultWalletId || wallets[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultWalletId]);

  const amountNum = amount ? parseInt(amount, 10) : 0;
  const selectedWallet = wallets.find((w) => w.id === walletId);

  const press = (k: string) => {
    if (k === "del") {
      setAmount((a) => a.slice(0, -1));
    } else if (k === "00") {
      setAmount((a) => (a.length && a.length < 6 ? a + "00" : a));
    } else {
      setAmount((a) => (a.length < 6 && !(k === "0" && !a) ? a + k : a));
    }
  };

  const commit = () => {
    if (!amountNum || !walletId) return;
    // Date-only input (no time picked) — anchor to noon local time so this
    // never rounds to the wrong calendar day across timezones, same fix
    // pattern used for other date-only values elsewhere in this app.
    const timestamp = new Date(`${date}T12:00:00`).toISOString();
    onCommit({ amount: amountNum, source: source.trim(), timestamp, wallet_id: walletId });
    setAmount("");
    setSource("");
    setDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[85]">
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
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-3.5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-3.5" />

            <h5 className="text-sm font-semibold text-white m-0">Add income</h5>

            <div className="flex items-baseline justify-center gap-1 py-3.5">
              <span className="text-3xl font-medium text-emerald-600">₹</span>
              <span
                className="text-[54px] leading-none font-medium tracking-tight"
                style={{ color: amount ? "#e9e9ed" : "#59545c" }}
              >
                {amountNum ? amountNum.toLocaleString("en-IN") : "0"}
              </span>
            </div>

            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value.slice(0, 80))}
              placeholder="Where's this from? (optional — e.g. 'allowance')"
              className="w-full h-11 mb-2 px-3.5 rounded-xl bg-white/5 border border-white/10 text-[13px] text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
            />

            <div className="flex gap-2 mb-2.5">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="flex-1 h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-[13px] text-gray-100 outline-none focus:border-primary-500/60"
              />
            </div>

            {wallets.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mb-2.5 -mx-5 px-5 no-scrollbar">
                {wallets.map((w) => {
                  const active = walletId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWalletId(w.id)}
                      className={`flex-none px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap border transition-colors ${
                        active
                          ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-200"
                          : "bg-white/5 border-white/10 text-gray-400"
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
                  className="h-[50px] rounded-2xl bg-white/5 text-white text-xl font-medium flex items-center justify-center"
                >
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </motion.button>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={commit}
              disabled={!amountNum || !walletId}
              whileTap={{ scale: 0.98 }}
              className="w-full h-12 mt-3.5 rounded-2xl bg-transparent border border-emerald-500/60 text-emerald-300 font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {amountNum && selectedWallet
                ? `Add ${FORMAT_INR(amountNum)} to ${selectedWallet.name}`
                : amountNum
                ? "Pick a wallet"
                : "Enter an amount"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
