"use client";

import React from "react";
import { Transaction } from "@/types";
import { STARTER_CATEGORIES, FORMAT_INR } from "@/lib/constants";
import { Trash2, Smartphone, Banknote, CreditCard, HelpCircle } from "lucide-react";

interface TransactionListProps {
  transactions: Transaction[];
  onDeleteTransaction?: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDeleteTransaction,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/5 space-y-2">
        <p className="text-sm font-semibold text-gray-300">No expenses logged yet</p>
        <p className="text-xs text-gray-500">Tap below to log your first chai, snack, or game top-up</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Recent Activity ({transactions.length})
        </h3>
        <span className="text-xs text-purple-400 font-medium">
          Total: {FORMAT_INR(transactions.reduce((acc, t) => acc + t.amount, 0))}
        </span>
      </div>

      <div className="space-y-2">
        {transactions.map((tx) => {
          const category = STARTER_CATEGORIES.find((c) => c.id === tx.category);
          const dateStr = new Date(tx.timestamp).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={tx.id}
              className="p-3 rounded-2xl bg-[#0F111A] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm"
                  style={{
                    backgroundColor: `${category?.color || "#64748B"}20`,
                    color: category?.color || "#64748B",
                    border: `1px solid ${category?.color || "#64748B"}40`,
                  }}
                >
                  {category?.name ? category.name.substring(0, 2).toUpperCase() : "EX"}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-100 leading-tight">
                    {category?.name || "Expense"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {tx.subcategory && (
                      <span className="text-[10px] text-gray-400 font-medium">{tx.subcategory}</span>
                    )}
                    <span className="text-[10px] text-gray-500">• {dateStr}</span>
                  </div>
                  {tx.note && <p className="text-[11px] text-gray-400 italic mt-0.5">"{tx.note}"</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">{FORMAT_INR(tx.amount)}</span>
                {onDeleteTransaction && (
                  <button
                    onClick={() => onDeleteTransaction(tx.id)}
                    title="Delete transaction"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
