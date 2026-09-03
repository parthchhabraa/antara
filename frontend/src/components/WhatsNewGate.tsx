"use client";

import React, { useEffect, useState } from "react";
import { CHANGELOG, CURRENT_APP_VERSION } from "@/lib/changelog";
import { useAuth } from "@/lib/AuthContext";
import { WhatsNewSheet } from "./WhatsNewSheet";

const LAST_SEEN_VERSION_STORAGE_KEY = "antara_last_seen_version";

// Rendered alongside (not instead of) the real app — see AppBootGate, which
// mounts this once loading/consent/budget-setup are all resolved.
//
// Bug fix: this used to be pure localStorage, unconditionally, for every
// user — which is inherently per-device/per-browser, not per-account. A
// real signed-in user switching devices, clearing browser data, or using
// the installed PWA vs. a browser tab would each have their OWN separate
// "last seen version," so the sheet would fire again on a device that
// hadn't dismissed it yet, or (just as often) stay silently suppressed on
// a device that had — "inconsistent, doesn't show to everyone" is exactly
// that symptom. Real signed-in accounts now persist last_seen_changelog_version
// on their Firestore profile instead (see AuthContext's markChangelogSeen /
// lib/api.ts's saveLastSeenChangelogVersion) — the same profile-field
// pattern category_caps/monthly_budget already use — so it's consistent
// across every device that account ever opens Antara on. Demo/guest mode
// keeps the original localStorage-only behavior: there's no real account to
// attach Firestore state to, matching the project's existing convention
// (category_caps is real Firestore for signed-in users, local-only for demo).
export const WhatsNewGate: React.FC = () => {
  const { user, profile, isDemoMode, markChangelogSeen } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const isRealUser = !!user && !isDemoMode;

  useEffect(() => {
    if (!isRealUser) {
      // Guest/demo mode — no real account to attach state to, so this is
      // the original, unchanged localStorage-only path.
      try {
        const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_STORAGE_KEY);
        if (lastSeen === null) {
          // First-ever open on this device — nothing to have "updated"
          // from yet. Record quietly and stay out of a brand-new user's way.
          localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
          return;
        }
        if (lastSeen !== CURRENT_APP_VERSION) {
          setIsOpen(true);
        }
      } catch (e) {
        // localStorage unavailable (private mode etc.) — same non-fatal
        // fallback QuickLogSheet's last-category memory already uses: just
        // skip the notice rather than blocking anything.
      }
      return;
    }

    // Real signed-in account — AppBootGate only mounts this once `loading`
    // has resolved, and the profile is always populated by then for a real
    // account, but guard anyway rather than assume.
    if (!profile) return;

    const lastSeen = profile.last_seen_changelog_version;
    if (lastSeen === undefined) {
      // No Firestore value yet — either a genuinely brand-new account (no
      // prior version to announce), or an existing beta account from
      // before this field existed, which may already have a real "seen"
      // value recorded the old way on THIS device. One-time migration:
      // adopt whatever localStorage already has on this device rather than
      // treating every pre-existing account as brand new, which would
      // either wrongly re-announce something they've already dismissed, or
      // (on a future device) wrongly suppress something they haven't.
      let migrated: string | null = null;
      try {
        migrated = localStorage.getItem(LAST_SEEN_VERSION_STORAGE_KEY);
      } catch (e) {
        // localStorage unavailable — nothing to migrate, fall through to
        // "brand new" below.
      }
      const seedVersion = migrated ?? CURRENT_APP_VERSION;
      markChangelogSeen(seedVersion).catch((err) => {
        console.warn("Could not migrate last-seen changelog version to Firestore:", err);
      });
      if (migrated !== null && migrated !== CURRENT_APP_VERSION) {
        setIsOpen(true);
      }
      return;
    }

    if (lastSeen !== CURRENT_APP_VERSION) {
      setIsOpen(true);
    }
    // markChangelogSeen is recreated every AuthProvider render — depending on
    // it would re-run this on every render instead of only when the real
    // inputs (which account, which profile) change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealUser, user, profile]);

  const handleDismiss = () => {
    setIsOpen(false);
    // Only persisted on dismiss, not on open — if they close the tab before
    // acknowledging it, it shows again next time rather than silently
    // marking itself "seen" for a version they never actually read.
    if (isRealUser) {
      markChangelogSeen(CURRENT_APP_VERSION).catch((err) => {
        console.warn("Could not save last-seen changelog version:", err);
      });
    } else {
      try {
        localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
      } catch (e) {
        // Non-fatal — worst case it just shows again next open.
      }
    }
  };

  return <WhatsNewSheet isOpen={isOpen} onClose={handleDismiss} entry={CHANGELOG[0]} />;
};
