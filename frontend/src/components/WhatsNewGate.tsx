"use client";

import React, { useEffect, useState } from "react";
import { CHANGELOG, CURRENT_APP_VERSION } from "@/lib/changelog";
import { WhatsNewSheet } from "./WhatsNewSheet";

const LAST_SEEN_VERSION_STORAGE_KEY = "antara_last_seen_version";

// Rendered alongside (not instead of) the real app — see AppBootGate, which
// mounts this once loading/consent/budget-setup are all resolved. Local
// storage, not Firestore: this isn't sensitive data and isn't tied to a
// specific account, so it works the same for a signed-in user, a guest, and
// demo mode, matching the brief's own "local storage is fine here" call.
export const WhatsNewGate: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_STORAGE_KEY);
      if (lastSeen === null) {
        // First-ever open on this device — there's no prior version to have
        // "updated" from, so there's nothing new to announce yet. Record the
        // current version quietly and stay out of a brand-new user's way;
        // the sheet starts being useful from the *next* real version bump.
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
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    // Only persisted on dismiss, not on open — if they close the tab before
    // acknowledging it, it shows again next time rather than silently
    // marking itself "seen" for a version they never actually read.
    try {
      localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
    } catch (e) {
      // Non-fatal — worst case it just shows again next open.
    }
  };

  return <WhatsNewSheet isOpen={isOpen} onClose={handleDismiss} entry={CHANGELOG[0]} />;
};
