"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Users } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { PageTransition } from "@/components/PageTransition";
import { ProfileView } from "@/components/ProfileView";
import { FriendsSheet } from "@/components/FriendsSheet";
import { AccountSettingsSection } from "@/components/AccountSettingsSection";
import { useAuth } from "@/lib/AuthContext";

// Social feature — self-view profile route. Wraps the same ProfileView the
// friend-view route (profile/[uid]) uses, per the brief: one component,
// friend-view is a strict subset, not a fork. Self-only numeric props
// (budget, caps) come from the real signed-in profile — never passed on
// the friend route.
export default function ProfilePage() {
  const { user, profile, isDemoMode, isSuperAdmin, signOut } = useAuth();
  const router = useRouter();
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  // Brief 5 (2026-09-05): the account is already gone server-side by the
  // time this fires (DeleteAccountSheet only calls it after the backend
  // delete succeeds) — this just gets the client out of a now-invalid
  // signed-in state and back to the front door, same as any other
  // sign-out. No confirmation dialog here; that already happened in the
  // sheet itself.
  const handleAccountDeleted = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <MobileFrame>
      <PageTransition>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm font-bold text-white">Your profile</h1>
          </div>
          {!isDemoMode && user && (
            <button
              type="button"
              onClick={() => setIsFriendsOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-300 border border-primary-500/25 hover:bg-primary-500/20 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Friends
            </button>
          )}
        </div>

        {user && (
          <ProfileView
            viewUid={user.uid}
            isSelf={true}
            user={user}
            isDemoMode={isDemoMode}
            selfMonthlyBudget={profile?.monthly_budget}
            selfCategoryCaps={profile?.category_caps}
          />
        )}
        {!user && !isDemoMode && (
          <p className="py-16 text-center text-xs text-gray-500">Sign in to view your profile.</p>
        )}
        {isDemoMode && (
          <p className="py-16 text-center text-xs text-gray-500">Profiles need a real signed-in account.</p>
        )}

        {/* Brief 5 (2026-09-05): export/feedback/delete — self-only, real
            signed-in accounts only. Superadmin excluded: the backend
            itself refuses to delete that one operator account (see
            main.py), and offering a button that always fails would just
            be confusing, not a real safeguard. */}
        {user && !isDemoMode && !isSuperAdmin && (
          <AccountSettingsSection user={user} onToast={showToast} onAccountDeleted={handleAccountDeleted} />
        )}

        <FriendsSheet
          isOpen={isFriendsOpen}
          onClose={() => setIsFriendsOpen(false)}
          user={user}
          isDemoMode={isDemoMode}
          onToast={showToast}
        />

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-6 right-6 top-[104px] z-[90] p-3.5 rounded-lg bg-primary-900/95 shadow-2xl text-sm leading-relaxed text-white"
          >
            {toast}
          </motion.div>
        )}
      </PageTransition>
    </MobileFrame>
  );
}
