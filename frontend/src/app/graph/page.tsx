"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MobileFrame } from "@/components/MobileFrame";
import { DotGraphCanvas } from "@/components/DotGraphCanvas";
import { QuickLogModal } from "@/components/QuickLogModal";
import { DEMO_TRANSACTIONS, FORMAT_INR } from "@/lib/constants";
import { fetchDotGraphData } from "@/lib/api";
import { DotGraphData, Transaction } from "@/types";
import { useAuth } from "@/lib/AuthContext";
import { Network, Sparkles, Compass, Users, ArrowLeft, Database } from "lucide-react";
import Link from "next/link";

export default function DotGraphPage() {
  const { user, profile, isDemoMode } = useAuth();
  const [demoTxs, setDemoTxs] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [liveTxs, setLiveTxs] = useState<Transaction[]>([]);
  const [graphData, setGraphData] = useState<DotGraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const transactions = isDemoMode ? demoTxs : liveTxs;

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
      console.warn("Firestore live query in graph page:", e);
    }
  }, [isDemoMode, user]);

  useEffect(() => {
    async function loadGraph() {
      setLoading(true);
      const res = await fetchDotGraphData(profile?.uid || "demo-user", transactions);
      setGraphData(res);
      setLoading(false);
    }
    loadGraph();
  }, [transactions, profile]);

  const handleAddTransaction = async (newTx: Omit<Transaction, "id">) => {
    if (isDemoMode) {
      const txWithId: Transaction = {
        ...newTx,
        id: "tx-" + Date.now(),
      };
      setDemoTxs([txWithId, ...demoTxs]);
    } else if (user) {
      try {
        const { collection, addDoc } = await import("firebase/firestore");
        const txCol = collection(db, "users", user.uid, "transactions");
        await addDoc(txCol, newTx);
      } catch (err) {
        console.error("Error writing to Firestore:", err);
        const txWithId: Transaction = { ...newTx, id: "tx-" + Date.now() };
        setLiveTxs([txWithId, ...liveTxs]);
      }
    }
  };

  return (
    <MobileFrame onOpenQuickLog={() => setIsQuickLogOpen(true)}>
      <div className="space-y-4">
        
        {/* Title Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Obsidian Spend Graph</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">
                  ML Physics
                </span>
              </h1>
              <p className="text-[11px] text-gray-400">Force-directed spend behavior embedding</p>
            </div>
          </div>
        </div>

        {/* The Obsidian Force Graph Visual Canvas */}
        {loading || !graphData ? (
          <div className="w-full h-[420px] rounded-2xl bg-[#090A0F] border border-white/10 flex flex-col items-center justify-center text-xs text-gray-500 gap-2">
            <Network className="w-8 h-8 text-purple-400 animate-spin" />
            <span>Computing Behavior Physics...</span>
          </div>
        ) : (
          <DotGraphCanvas
            data={graphData}
            onSelectCategory={(catId) => setSelectedCategory(catId)}
          />
        )}

        {/* Archetype Description & Peer Clusters */}
        {graphData && (
          <div className="p-4 rounded-2xl bg-[#0E1019] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-gray-200">Dominant Spend Archetype</span>
              </div>
              <span className="text-[10px] font-bold text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/20">
                {graphData.archetype}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {graphData.archetype_description}
            </p>

            {/* Peer Cluster Archetype Bars */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Teen Peer Cluster Affinities</span>
              </span>
              <div className="space-y-1.5">
                {graphData.peer_archetypes.map((arc) => (
                  <div key={arc.id} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-300 font-medium">{arc.name}</span>
                      <span className="text-gray-400 font-mono">{arc.similarity_pct}% match</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${arc.similarity_pct}%`,
                          backgroundColor: arc.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Log Modal */}
        <QuickLogModal
          isOpen={isQuickLogOpen}
          onClose={() => setIsQuickLogOpen(false)}
          onAddTransaction={handleAddTransaction}
        />

      </div>
    </MobileFrame>
  );
}
