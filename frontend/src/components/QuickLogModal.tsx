"use client";

import React, { useState } from "react";
import { X, Check, IndianRupee, Sparkles, Smartphone, CreditCard, Banknote } from "lucide-react";
import { STARTER_CATEGORIES } from "@/lib/constants";
import { Transaction } from "@/types";

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Omit<Transaction, "id">) => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("food-delivery");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [source, setSource] = useState<"upi" | "cash" | "card">("upi");

  if (!isOpen) return null;

  const currentCategory = STARTER_CATEGORIES.find((c) => c.id === selectedCategory);

  const handleAddAmount = (delta: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + delta));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    onAddTransaction({
      amount: numAmount,
      category: selectedCategory,
      subcategory: selectedSubcategory || currentCategory?.subcategories[0] || "",
      note: note.trim() || undefined,
      timestamp: new Date().toISOString(),
      source,
    });

    // Reset and close
    setAmount("");
    setNote("");
    setSelectedSubcategory("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-[#0D0F16] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Log Teen Expense</h2>
              <p className="text-xs text-gray-400">Add spending in seconds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-2xl font-bold text-purple-400">₹</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/15 focus:border-purple-500 rounded-2xl text-2xl font-extrabold text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Quick Denomination Chips */}
          <div className="flex items-center gap-2">
            {[50, 100, 200, 500].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleAddAmount(val)}
                className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 text-xs font-semibold text-gray-300 hover:text-purple-300 transition-all active:scale-95"
              >
                +₹{val}
              </button>
            ))}
          </div>

          {/* Category Selector Grid */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Spending Category
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
              {STARTER_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedSubcategory("");
                    }}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "bg-purple-500/20 border-purple-500 text-white shadow-glow-purple"
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full mb-1"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-[10px] font-medium line-clamp-1">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategory Pills */}
          {currentCategory && currentCategory.subcategories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Subcategory / Tag
              </label>
              <div className="flex flex-wrap gap-1.5">
                {currentCategory.subcategories.map((sub) => {
                  const isSubSelected = selectedSubcategory === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubcategory(sub)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        isSubSelected
                          ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Note / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Late night Swiggy with friends"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Payment Method / Source */}
          <div className="flex items-center gap-2">
            {[
              { id: "upi", label: "UPI (GPay/Paytm)", icon: Smartphone },
              { id: "cash", label: "Cash", icon: Banknote },
              { id: "card", label: "Card", icon: CreditCard },
            ].map((method) => {
              const Icon = method.icon;
              const isChosen = source === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSource(method.id as any)}
                  className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs transition-all ${
                    isChosen
                      ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{method.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white font-bold text-sm shadow-glow-purple hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Expense</span>
          </button>
        </form>
      </div>
    </div>
  );
};
