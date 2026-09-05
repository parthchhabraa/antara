import { LegalPageLayout } from "@/components/LegalPageLayout";

// Step 12 — plain-language, not a legal template dump. Written to state
// clearly what's actually true about this app's actual current behavior
// (checked against the real code, not boilerplate) rather than generic
// language that might not match what the app really does.
export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updatedDate="21 August 2026">
      <p>
        Antara is a personal spend-tracking app for teens, currently in early beta. This page explains, in plain
        language, what information we collect, why, and what we do (and don't do) with it.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">What we collect</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong className="text-gray-100">From Google Sign-In:</strong> your email address, display name, and
          profile photo. We use this to identify your account and check it against the beta allowlist — we don't
          request or see your Google password, and we don't read your Gmail, Drive, or anything else in your Google
          account.
        </li>
        <li>
          <strong className="text-gray-100">Transactions you log:</strong> the amount, category, an optional note,
          and the timestamp. That's it — we don't connect to your bank, card, or UPI account, and there's no way for
          the app to see real transactions unless you type them in yourself.
        </li>
        <li>
          <strong className="text-gray-100">Basic usage state:</strong> your monthly budget setting, logging streak,
          and whether you're using Demo Mode or a real account.
        </li>
      </ul>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">What we use it for</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Showing you your own burn rate, run-out date, and spending breakdown — the core of the app.</li>
        <li>
          The "Why this pace?" ML prediction feature, which compares your logged spending to category benchmarks
          derived from an anonymous spending survey (separate from your account, no connection kept between the two)
          to give an early-estimate or personalized read on your spending pattern.
        </li>
        <li>Streaks and milestones, which are just a count of days you've logged something.</li>
      </ul>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Where it's stored</h2>
      <p>
        In Firebase/Firestore (Google Cloud infrastructure), under our own project — not a third-party analytics or
        data-broker platform. We don't run any third-party analytics or tracking scripts in this app (no Google
        Analytics, no ad pixels, nothing like that) as of this writing.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">What we don't do</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong className="text-gray-100">We do not sell your data to anyone.</strong> Not to advertisers, not to
          data brokers, not to anyone else. There's no business model here that involves selling user data, and this
          policy will be updated immediately and visibly if that ever changes.
        </li>
        <li>We don't share your individual data with other users. Your transactions are visible only to you and to the app's superadmin (for support/moderation purposes).</li>
        <li>We don't use your data to train any model on other people — the ML feature only ever looks at your own logged transactions plus anonymous, separately-collected survey benchmarks.</li>
      </ul>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Your choices</h2>
      <p>
        You can use Demo Mode without ever creating an account or sharing any real data — it's a fully local,
        made-up dataset. If you have a real account, your profile screen has real "Export my data" and "Delete my
        account" buttons — export gives you a JSON copy of everything the app has on you, and delete permanently
        removes your profile, transactions, wallets, income, budget instances, friend connections, and badges, then
        your sign-in itself, with no grace period. You can also email{" "}
        <a href="mailto:parthchhabra6112@gmail.com" className="text-primary-300 underline">
          parthchhabra6112@gmail.com
        </a>{" "}
        instead, or with any other question. This is a small early-stage beta run by one person, not a company with
        a dedicated privacy team — that email reaches the person who actually operates the app.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Teens &amp; minors</h2>
      <p>
        Antara is built for teenagers, and we know that means some users are minors. We ask at sign-in that you're
        using this with a parent or guardian's awareness (see the consent step during sign-in) — this app is not a
        substitute for a conversation with a parent about money, and we don't independently verify age or guardian
        consent beyond that honest self-attestation.
      </p>

      <h2 className="text-xs font-bold text-white mt-5 mb-1">Changes to this policy</h2>
      <p>This is an early beta and this policy may change as the app develops. Meaningful changes will update the date above.</p>
    </LegalPageLayout>
  );
}
