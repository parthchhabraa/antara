"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { PageTransition } from "@/components/PageTransition";

interface LegalPageLayoutProps {
  title: string;
  updatedDate: string;
  children: React.ReactNode;
}

// Step 12 — shared shell for /privacy and /terms. Deliberately still inside
// MobileFrame (consistent chrome with the rest of the app) rather than a
// bare unstyled page — someone reading this to decide whether to sign up
// should see the same app, not get bounced to a different-looking page.
export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({ title, updatedDate, children }) => (
  <MobileFrame>
    <PageTransition>
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/"
          className="p-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-white">{title}</h1>
          <p className="text-xs text-gray-500">Last updated {updatedDate}</p>
        </div>
      </div>
      <div className="prose-legal text-sm leading-relaxed text-gray-300 space-y-4 pb-8">{children}</div>
    </PageTransition>
  </MobileFrame>
);
