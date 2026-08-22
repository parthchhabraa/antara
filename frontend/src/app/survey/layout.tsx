import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Antara Spending Survey — Help Train Our Teen Finance AI",
  description:
    "A 3-minute anonymous survey on how Indian teens spend money across income levels. Your answers help train Antara's ML spend-prediction model.",
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
