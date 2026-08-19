"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Network, Sparkles, PlusCircle, Shield, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface MobileFrameProps {
  children: React.ReactNode;
  onOpenQuickLog?: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children, onOpenQuickLog }) => {
  const pathname = usePathname();
  const { profile, isSuperAdmin, isDemoMode, toggleDemoMode, signOut } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Dot Graph", href: "/graph", icon: Network, highlight: true },
    { label: "Predict", href: "/predict", icon: Sparkles },
    ...(isSuperAdmin ? [{ label: "Admin", href: "/admin", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#060709] text-gray-100 flex justify-center selection:bg-purple-500 selection:text-white">
      {/* Mobile / Tablet constrained container */}
      <div className="w-full max-w-md md:max-w-lg min-h-screen flex flex-col bg-[#0A0C10] border-x border-white/5 shadow-2xl relative pb-24">
        
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-glow-purple font-black text-sm tracking-wider">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">Antara</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  ML Beta
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium leading-none">
                {profile?.displayName || "Teen FinTech"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Demo Mode Badge / Superadmin Indicator */}
            {isSuperAdmin && (
              <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
                Superadmin
              </span>
            )}

            <button
              onClick={toggleDemoMode}
              title={isDemoMode ? "Currently in Demo Mode" : "Currently in Live Mode"}
              className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-all ${
                isDemoMode
                  ? "bg-purple-950/40 text-purple-300 border-purple-500/30 hover:bg-purple-900/50"
                  : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50"
              }`}
            >
              {isDemoMode ? "Demo Mode" : "Live Firestore"}
            </button>

            <button
              onClick={signOut}
              title="Sign out / Switch user"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-4 overflow-y-auto">{children}</main>

        {/* Quick Log Floating Button in bottom center */}
        {onOpenQuickLog && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
            <button
              onClick={onOpenQuickLog}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white font-semibold text-sm shadow-glow-purple hover:scale-105 active:scale-95 transition-all group"
            >
              <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              <span>Log ₹ Expense</span>
            </button>
          </div>
        )}

        {/* Bottom Floating Navigation Dock */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-lg z-30 bg-[#0A0C10]/90 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
                  isActive ? "text-purple-400 font-semibold" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]" : ""}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 absolute -bottom-0.5 shadow-glow-purple" />
                )}
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
};
