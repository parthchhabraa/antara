import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Antara Beta Survey — Help Train Our Teen Finance AI",
  description:
    "A 3-minute anonymous survey on how Indian teens spend money across income levels. Your answers help train Antara's ML spend-prediction model.",
};

// Moved from /survey to /review — same anonymous flow, same
// `survey_responses` Firestore collection/schema, no functional change from
// the route rename itself. See scripts/export-survey-static.sh, which was
// updated alongside this move (it looks for review.html now, not survey.html).
export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
