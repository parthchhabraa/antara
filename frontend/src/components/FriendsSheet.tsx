"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { User as FirebaseUser } from "firebase/auth";
import { UserPlus, ChevronRight, UserMinus } from "lucide-react";
import { Friend, Badge, ProfileBadge } from "@/types";
import { fetchFriendsList, fetchBadges, unfriendUser } from "@/lib/api";
import { AddFriendSheet } from "./AddFriendSheet";

interface FriendsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  isDemoMode: boolean;
  onToast: (message: string) => void;
}

interface FriendRow extends Friend {
  displayName: string | null;
}

export const FriendsSheet: React.FC<FriendsSheetProps> = ({ isOpen, onClose, user, isDemoMode, onToast }) => {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const loadFriends = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await fetchFriendsList(user.uid);
      const withNames = await Promise.all(
        list.map(async (f) => {
          try {
            const badges = await fetchBadges(f.uid);
            const profile = badges.find((b): b is ProfileBadge => b.id === "profile");
            return { ...f, displayName: profile?.displayName ?? null };
          } catch (e) {
            return { ...f, displayName: null };
          }
        })
      );
      setFriends(withNames.sort((a, b) => (b.since || "").localeCompare(a.since || "")));
    } catch (e) {
      console.warn("Loading friends list failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const handleUnfriend = async (friendUid: string) => {
    if (!user || busyUid) return;
    setBusyUid(friendUid);
    try {
      await unfriendUser(user, friendUid);
      setFriends((prev) => prev.filter((f) => f.uid !== friendUid));
      onToast("Removed.");
    } catch (e) {
      onToast("Couldn't remove that friend — try again.");
    } finally {
      setBusyUid(null);
    }
  };

  const openFriendProfile = (uid: string) => {
    onClose();
    router.push(`/profile/${uid}`);
  };

  return (
    <>
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
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
            >
              <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

              <h5 className="text-lg font-medium text-white m-0">Friends</h5>
              <p className="text-[13px] text-gray-500 mt-0.5 mb-4">
                Archetype, streaks, and badges only — never a real amount.
              </p>

              {isDemoMode || !user ? (
                <p className="py-10 text-center text-xs text-gray-500">Sign in with a real account to add friends.</p>
              ) : (
                <>
                  {loading ? (
                    <p className="py-8 text-center text-xs text-gray-500">Loading…</p>
                  ) : friends.length === 0 ? (
                    <p className="py-8 text-center text-xs text-gray-500">No friends yet — add one below.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {friends.map((f) => (
                        <div key={f.uid} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.05]">
                          <button
                            type="button"
                            onClick={() => openFriendProfile(f.uid)}
                            className="flex-1 min-w-0 flex items-center gap-3 text-left"
                          >
                            <div className="w-9 h-9 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center shrink-0 text-[13px] font-semibold text-primary-200">
                              {(f.displayName || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[13.5px] text-gray-100 truncate">{f.displayName || "Antara friend"}</span>
                            <ChevronRight className="w-4 h-4 text-gray-600 shrink-0 ml-auto" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnfriend(f.uid)}
                            disabled={busyUid === f.uid}
                            className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-rose-300 transition-colors disabled:opacity-40"
                            aria-label="Remove friend"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsAddOpen(true)}
                    className="w-full h-11 mt-4 rounded-2xl bg-primary-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add a friend
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="w-full h-11 mt-2 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddFriendSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        user={user}
        onAdded={(name) => {
          setIsAddOpen(false);
          onToast(`Added ${name || "a new friend"}.`);
          loadFriends();
        }}
      />
    </>
  );
};
