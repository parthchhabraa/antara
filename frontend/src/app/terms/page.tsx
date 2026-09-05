import { LegalPageLayout } from "@/components/LegalPageLayout";

// Step 12 — same plain-language approach as /privacy. Not a substitute for
// real legal review before any wide public launch; this is the honest
// minimum baseline the brief asked for before publicSignupEnabled is ever
// flipped on.
export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Use" updatedDate="21 August 2026">
      <p>
        Antara is an early-stage beta app for tracking your own spending. By using it with a real account, you're
        agreeing to the following, written in plain language rather than legal boilerplate.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">What this app is (and isn't)</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Antara is a self-tracking tool. You type in what you spend; the app does math on it.</li>
        <li>
          Antara is <strong className="text-gray-100">not a bank, wallet, or payment app</strong> — it never touches
          real money, never connects to a bank account or card, and can't move funds anywhere.
        </li>
        <li>
          The spend predictions and "safe pace" numbers are estimates based on your own logged history and/or
          survey-derived benchmarks — they're not financial advice, and we don't guarantee their accuracy,
          especially early on when there's little data to base them on (the app tells you when a number is an
          "early estimate" rather than a personalized one).
        </li>
      </ul>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Beta status</h2>
      <p>
        This is a real, working beta — not a finished product. Features may change, break, or be removed. Data loss
        is unlikely but not impossible at this stage; don't treat this as your only record of anything important.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Who can use it</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          You need a Google account to sign in for real (or you can use Demo Mode with no account at all).
        </li>
        <li>
          If you're a minor, we ask that you're using Antara with your parent or guardian's awareness — see the
          consent step at sign-in. We don't independently verify this beyond your own honest answer.
        </li>
        <li>
          Access may currently be limited to a beta allowlist, or open to anyone if public signup has been turned
          on — either way, we can suspend or remove access to any account, at our discretion, particularly for
          misuse.
        </li>
      </ul>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Your data</h2>
      <p>
        See the <a href="/privacy" className="text-primary-300 underline">Privacy Policy</a> for what we collect and
        how it's used. Short version: only what you log, used only to run the app for you, never sold.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">No warranty</h2>
      <p>
        Antara is provided "as is," as an early beta, with no warranty of any kind. We'll try to keep it working and
        fix real problems, but we can't promise uptime, accuracy, or that a given feature will keep working the same
        way as the app develops.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Contact</h2>
      <p>
        Questions, problems, or a request to delete your data:{" "}
        <a href="mailto:parthchhabra6112@gmail.com" className="text-primary-300 underline">
          parthchhabra6112@gmail.com
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
