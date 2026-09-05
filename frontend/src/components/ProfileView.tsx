"use client";

import React, { useEffect, useMemo, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { Flame, Sparkles, ShieldCheck, Target, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Badge,
  ProfileBadge as ProfileBadgeType,
  ArchetypeBadge as ArchetypeBadgeType,
  StreakBadge as StreakBadgeType,
  CapKeeperBadge,
  ComparisonBucket,
} from "@/types";
import { fetchBadges, fetchCategoryComparison, CategoryComparisonResult } from "@/lib/api";
import { FORMAT_INR, STARTER_CATEGORIES } from "@/lib/constants";
import { CategoryIcon } from "./CategoryIcon";

interface ProfileViewProps {
  viewUid: string;
  isSelf: boolean;
  user: FirebaseUser | null;
  isDemoMode: boolean;
  // Self-view only — the real numeric stuff already elsewhere in the app.
  // Never passed/rendered for a friend view; see the hard rule this
  // whole feature is built around.
  selfMonthlyBudget?: number;
  selfCategoryCaps?: Record<string, number>;
}

const BUCKET_LABEL: Record<ComparisonBucket, string> = {
  much_less: "Spends much less on",
  less: "Spends less on",
  similar: "About the same on",
  more: "Spends more on",
  much_more: "Spends much more on",
};

const BUCKET_COLOR: Record<ComparisonBucket, string> = {
  much_less: "text-gray-500",
  less: "text-gray-400",
  similar: "text-primary-300",
  more: "text-amber-300",
  much_more: "text-amber-400",
};

// One screen, used for BOTH self-view and friend-view — friend-view is a
// strict subset (no budget/caps/wallets/instances/burn-rate, ever; see the
// brief's hard rule and firestore.rules's own comments on why badges are
// the one friend-readable collection). Same bottom-sheet-style cards
// already established (ArchetypeSheet/CategoryDetailSheet), not a new
// visual system.
export const ProfileView: React.FC<ProfileViewProps> = ({
  viewUid,
  isSelf,
  user,
  isDemoMode,
  selfMonthlyBudget,
  selfCategoryCaps,
}) => {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<CategoryComparisonResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBadges(viewUid)
      .then((b) => {
        if (!cancelled) setBadges(b);
      })
      .catch((e) => console.warn("Fetching badges failed:", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewUid]);

  useEffect(() => {
    if (isSelf || !user) return;
    let cancelled = false;
    fetchCategoryComparison(user, viewUid)
      .then((r) => {
        if (!cancelled) setComparison(r);
      })
      .catch((e) => {
        // A 403 here means "not actually friends" (server-verified, not
        // trusted from anything client-side) — shown honestly rather than
        // silently hidden, since it's a real, meaningful state.
        if (!cancelled) setComparisonError(e instanceof Error ? e.message : "Couldn't load comparison.");
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, user, viewUid]);

  const profileBadge = badges.find((b): b is ProfileBadgeType => b.id === "profile");
  const archetypeBadge = badges.find((b): b is ArchetypeBadgeType => b.id === "archetype");
  const streakBadges = badges.filter((b): b is StreakBadgeType => b.type === "streak");
  const capKeeperBadges = badges.filter((b): b is CapKeeperBadge => b.type === "cap-keeper");
  const graduatedBadge = badges.find((b) => b.id === "graduated-cold-start");

  const memberSince = profileBadge?.member_since
    ? new Date(profileBadge.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const achievementCount = streakBadges.length + capKeeperBadges.length + (graduatedBadge ? 1 : 0) + (archetypeBadge ? 1 : 0);

  if (isDemoMode || (!isSelf && !user)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <p className="text-sm text-gray-400 max-w-[260px]">
          {isDemoMode ? "Profiles need a real signed-in account." : "Sign in to view profiles."}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {!isSelf && (
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-gray-400 mb-3 active:opacity-60 transition-opacity"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">Loading…</div>
      ) : (
        <>
          {/* Identity header */}
          <div className="flex items-center gap-3.5">
            {profileBadge?.photoURL ? (
              <img src={profileBadge.photoURL} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center text-2xl font-semibold text-primary-200">
                {(profileBadge?.displayName || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-lg font-medium text-white truncate">{profileBadge?.displayName || "Antara user"}</div>
              {memberSince && <div className="text-xs text-gray-500">Member since {memberSince}</div>}
            </div>
          </div>

          {/* Streak */}
          {(profileBadge?.currentStreak ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 mt-4 text-xs text-orange-300 font-semibold">
              <Flame className="w-4 h-4" fill="currentColor" strokeWidth={0} />
              {profileBadge?.currentStreak}-day streak
              {(profileBadge?.longestStreak ?? 0) > (profileBadge?.currentStreak ?? 0) && (
                <span className="text-xs text-gray-500 font-normal">· best {profileBadge?.longestStreak}</span>
              )}
            </div>
          )}

          {/* Archetype */}
          {archetypeBadge && (
            <div className="mt-4 p-4 rounded-lg bg-primary-900/25 border border-primary-800/40">
              <div className="flex items-center gap-1.5 text-xs font-medium tracking-[0.14em] text-primary-300">
                <Sparkles className="w-3 h-3" />
                ARCHETYPE
              </div>
              <div className="text-sm font-medium text-white mt-1.5">{archetypeBadge.archetype_name}</div>
              <p className="text-xs leading-relaxed text-gray-300 mt-1 mb-0">{archetypeBadge.archetype_description}</p>
              {archetypeBadge.is_cold_start && (
                <p className="text-xs leading-relaxed text-amber-200/80 mt-1.5 mb-0">
                  Still calibrating to their data — this is an early read.
                </p>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="text-xs font-medium tracking-[0.14em] text-gray-600 mt-6 mb-2">
            BADGES · {achievementCount}
          </div>
          {achievementCount === 0 ? (
            <p className="text-xs text-gray-500">No badges earned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {streakBadges.map((b) => (
                <span
                  key={b.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-xs text-orange-300 font-semibold"
                >
                  <Flame className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
                  {b.threshold}-day streak
                </span>
              ))}
              {graduatedBadge && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Graduated cold-start
                </span>
              )}
              {capKeeperBadges.map((b) => {
                const cat = STARTER_CATEGORIES.find((c) => c.id === b.category_id);
                return (
                  <span
                    key={b.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/25 text-xs text-primary-200 font-semibold"
                  >
                    <Target className="w-3.5 h-3.5" />
                    Cap keeper · {cat?.short || b.category_id}
                  </span>
                );
              })}
            </div>
          )}

          {/* Friend-only: privacy-preserving category comparison */}
          {!isSelf && (
            <>
              <div className="text-xs font-medium tracking-[0.14em] text-gray-600 mt-6 mb-2">
                HOW YOUR SPENDING COMPARES
              </div>
              {comparisonError ? (
                <p className="text-xs text-gray-500">{comparisonError}</p>
              ) : !comparison ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : comparison.comparisons.length === 0 ? (
                <p className="text-xs text-gray-500">Not enough logged data yet to compare.</p>
              ) : (
                <>
                  {(comparison.requester_is_cold_start || comparison.friend_is_cold_start) && (
                    <p className="text-xs leading-relaxed text-amber-200/80 mb-2">
                      One or both of you are still calibrating — take this as an early read.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {comparison.comparisons.map((c) => {
                      const cat = STARTER_CATEGORIES.find((sc) => sc.id === c.category_id);
                      return (
                        <div key={c.category_id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                          <CategoryIcon category={cat} size={26} />
                          <span className={`text-xs ${BUCKET_COLOR[c.bucket]}`}>
                            {BUCKET_LABEL[c.bucket]} <span className="text-gray-200">{c.category_name}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Self-only: the real numeric stuff — never rendered for a friend. */}
          {isSelf && (selfMonthlyBudget !== undefined || selfCategoryCaps) && (
            <>
              <div className="text-xs font-medium tracking-[0.14em] text-gray-600 mt-6 mb-2">YOUR NUMBERS</div>
              <div className="flex flex-col gap-1.5">
                {selfMonthlyBudget !== undefined && (
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-xs text-gray-300">Monthly budget</span>
                    <span className="text-xs font-mono text-white font-medium tabular-nums">{FORMAT_INR(selfMonthlyBudget)}</span>
                  </div>
                )}
                {selfCategoryCaps &&
                  Object.entries(selfCategoryCaps).map(([catId, cap]) => {
                    const cat = STARTER_CATEGORIES.find((c) => c.id === catId);
                    return (
                      <div key={catId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-xs text-gray-300">{cat?.name || catId} cap</span>
                        <span className="text-xs font-mono text-white font-medium tabular-nums">{FORMAT_INR(cap)}</span>
                      </div>
                    );
                  })}
              </div>
              <p className="text-xs text-gray-600 mt-2">Only you ever see this — friends only ever see the sections above.</p>
            </>
          )}
        </>
      )}
    </div>
  );
};
