"use client";

import React from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { SuperadminPanel } from "@/components/SuperadminPanel";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <MobileFrame>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-white">Superadmin Dashboard</h1>
              <p className="text-[11px] text-gray-400">Beta allowlist and system controls</p>
            </div>
          </div>
        </div>

        {/* Superadmin Panel Component */}
        <SuperadminPanel />
      </div>
    </MobileFrame>
  );
}
