"use client";

import React, { useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { Download, MessageSquareText, Trash2 } from "lucide-react";
import { exportMyData } from "@/lib/api";
import { FeedbackSheet } from "./FeedbackSheet";
import { DeleteAccountSheet } from "./DeleteAccountSheet";

interface AccountSettingsSectionProps {
  user: FirebaseUser;
  onToast: (message: string) => void;
  onAccountDeleted: () => void;
}

// Brief 5 (2026-09-05): self-only profile-screen section for the three
// gaps grouped in that brief — export, feedback, and real account
// deletion. Rendered only for a real signed-in account viewing their own
// profile (see app/profile/page.tsx — never on the friend-view route).
export const AccountSettingsSection: React.FC<AccountSettingsSectionProps> = ({
  user,
  onToast,
  onAccountDeleted,
}) => {
  const [exporting, setExporting] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportMyData(user);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `antara-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Couldn't export your data — try again in a moment.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="text-[10px] font-medium tracking-[0.14em] text-gray-600 mt-6 mb-2">ACCOUNT</div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-white/[0.04] text-[13px] text-gray-200 disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-gray-400" />
          {exporting ? "Preparing your export…" : "Export my data"}
        </button>

        <button
          type="button"
          onClick={() => setIsFeedbackOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-white/[0.04] text-[13px] text-gray-200"
        >
          <MessageSquareText className="w-4 h-4 text-gray-400" />
          Send feedback
        </button>

        <button
          type="button"
          onClick={() => setIsDeleteOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/15 text-[13px] text-rose-300"
        >
          <Trash2 className="w-4 h-4" />
          Delete my account
        </button>
      </div>

      <FeedbackSheet
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        user={user}
        onSent={() => onToast("Thanks — that went straight through.")}
      />
      <DeleteAccountSheet
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        user={user}
        onDeleted={onAccountDeleted}
      />
    </>
  );
};
