"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { User as FirebaseUser } from "firebase/auth";
import { Wallet as WalletIcon, Pencil, Archive, Plus } from "lucide-react";
import { Wallet } from "@/types";
import { FORMAT_INR } from "@/lib/constants";
import { createWallet, renameWallet, archiveWallet, logIncome } from "@/lib/api";
import { IncomeLogSheet } from "./IncomeLogSheet";

interface WalletsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[]; // active + archived — this sheet is the one place that shows archived ones too
  defaultWalletId?: string;
  isDemoMode: boolean;
  user: FirebaseUser | null;
  onToast: (message: string) => void;
}

// Same bottom-sheet visual pattern as CategoryDetailSheet/InstancesSheet —
// list + inline create/rename, no new UI pattern invented. Real wallets are
// a parallel "real money" layer (see types/index.ts's Wallet doc comment);
// this sheet is the one place a user creates/renames/archives them and adds
// real income, separate from the existing budget/burn-rate UI entirely.
export const WalletsSheet: React.FC<WalletsSheetProps> = ({
  isOpen,
  onClose,
  wallets,
  defaultWalletId,
  isDemoMode,
  user,
  onToast,
}) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canWrite = !isDemoMode && !!user;
  const active = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);
  const total = active.reduce((s, w) => s + w.balance, 0);

  const handleCreate = async () => {
    if (!newName.trim() || !user || busy) return;
    setBusy(true);
    try {
      await createWallet(user.uid, newName.trim());
      setNewName("");
      setCreating(false);
    } catch (err) {
      console.warn("Create wallet failed:", err);
      onToast("Couldn't create that wallet — try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim() || !user || busy) return;
    setBusy(true);
    try {
      await renameWallet(user.uid, id, editName.trim());
      setEditingId(null);
    } catch (err) {
      console.warn("Rename wallet failed:", err);
      onToast("Couldn't rename that wallet — try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await archiveWallet(user.uid, id);
    } catch (err) {
      console.warn("Archive wallet failed:", err);
      onToast("Couldn't archive that wallet — try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleIncomeCommit = async (income: { amount: number; source: string; timestamp: string; wallet_id: string }) => {
    if (!user) return;
    try {
      await logIncome(user.uid, income);
      setIsIncomeOpen(false);
      onToast(`Added ${FORMAT_INR(income.amount)} income.`);
    } catch (err) {
      console.warn("Log income failed:", err);
      onToast("Couldn't save that income — check your connection and try again.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[75]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-lg bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <h5 className="text-lg font-medium text-white m-0">Wallets</h5>
            <p className="text-xs text-gray-500 mt-0.5 mb-1">
              Real balances — separate from your budget plan above.
            </p>
            <div className="text-3xl font-medium tracking-tight text-white mt-2 mb-4">
              {FORMAT_INR(total)}
              <span className="text-xs font-normal text-gray-500 ml-2">across {active.length} wallet{active.length === 1 ? "" : "s"}</span>
            </div>

            {!canWrite && (
              <p className="mb-3 text-xs text-gray-500 bg-white/[0.04] rounded-sm px-3.5 py-2.5">
                {isDemoMode ? "Demo wallets — sign in with a real account to create, rename, or archive your own." : "Sign in to manage real wallets."}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {active.map((w) => (
                <div key={w.id} className="p-3.5 rounded-lg bg-white/[0.05]">
                  {editingId === w.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value.slice(0, 30))}
                        className="flex-1 h-9 px-2.5 rounded-sm bg-white/5 border border-white/10 text-xs text-gray-100 outline-none focus:border-primary-500/60"
                      />
                      <button
                        type="button"
                        onClick={() => handleRename(w.id)}
                        disabled={!editName.trim() || busy}
                        className="shrink-0 h-9 px-3 rounded-sm bg-primary-600 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="shrink-0 h-9 px-2 text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-500/10 border border-primary-500/25 flex items-center justify-center shrink-0">
                        <WalletIcon className="w-4 h-4 text-primary-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-100 truncate">
                          {w.name}
                          {defaultWalletId === w.id && (
                            <span className="ml-1.5 text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-sm font-medium shrink-0 ${w.balance < 0 ? "text-rose-300" : "text-white"}`}>
                        {FORMAT_INR(w.balance)}
                      </span>
                      {canWrite && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(w.id);
                              setEditName(w.name);
                            }}
                            className="w-7 h-7 rounded-sm bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                            aria-label={`Rename ${w.name}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {active.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleArchive(w.id)}
                              className="w-7 h-7 rounded-sm bg-white/5 flex items-center justify-center text-gray-500 hover:text-rose-300 transition-colors"
                              aria-label={`Archive ${w.name}`}
                            >
                              <Archive className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {w.balance < 0 && (
                    <p className="text-xs text-rose-300/80 mt-1.5 mb-0">Negative — this wallet owes more than it has.</p>
                  )}
                </div>
              ))}
            </div>

            {canWrite && (
              <>
                {creating ? (
                  <div className="flex items-center gap-1.5 mt-3">
                    <input
                      type="text"
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value.slice(0, 30))}
                      placeholder="e.g. Cash"
                      className="flex-1 h-10 px-3 rounded-sm bg-white/5 border border-white/10 text-xs text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim() || busy}
                      className="shrink-0 h-10 px-3.5 rounded-sm bg-primary-600 text-white text-xs font-semibold disabled:opacity-40"
                    >
                      Create
                    </button>
                    <button type="button" onClick={() => setCreating(false)} className="shrink-0 h-10 px-2 text-xs text-gray-500">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="w-full h-11 mt-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New wallet
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsIncomeOpen(true)}
                  className="w-full h-12 mt-2 rounded-lg bg-transparent border border-emerald-500/60 text-emerald-300 font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  + Add income
                </button>
              </>
            )}

            {archived.length > 0 && (
              <>
                <div className="text-xs font-medium tracking-[0.14em] text-gray-600 mt-5 mb-2">ARCHIVED</div>
                <div className="flex flex-col gap-1.5">
                  {archived.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 px-1 py-1.5 opacity-60">
                      <span className="text-xs text-gray-400 flex-1 truncate">{w.name}</span>
                      <span className="text-xs text-gray-500">{FORMAT_INR(w.balance)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={onClose}
              className="w-full h-11 mt-5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Close
            </button>
          </motion.div>

          <IncomeLogSheet
            isOpen={isIncomeOpen}
            onClose={() => setIsIncomeOpen(false)}
            wallets={active}
            defaultWalletId={defaultWalletId}
            onCommit={handleIncomeCommit}
          />
        </div>
      )}
    </AnimatePresence>
  );
};
