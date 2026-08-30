"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { CheckCircle } from "lucide-react";

import { SurveyProgress } from "@/components/survey/SurveyProgress";
import { NumericKeypad } from "@/components/survey/NumericKeypad";
import { ChoiceList, ChoiceOption } from "@/components/survey/ChoiceList";
import { StepContainer } from "@/components/survey/StepContainer";
import { StepFooter } from "@/components/survey/StepFooter";
import { AntaraBootloader } from "@/components/survey/AntaraBootloader";
import { SuccessBurst } from "@/components/survey/SuccessBurst";

import {
  SURVEY_CATEGORIES,
  AGE_RANGES,
  GENDER_OPTIONS,
  CITY_TIERS,
  POCKET_MONEY_RANGES,
  FAMILY_INCOME_BRACKETS,
  PAYMENT_METHODS,
  POCKET_MONEY_DURATION,
  SPEND_TRACKING_OPTIONS,
  SURVEY_LOCAL_STORAGE_KEY,
  SURVEY_RESUBMIT_COOLDOWN_MS,
  SURVEY_AVG_SECONDS_PER_STEP,
} from "@/lib/surveyConstants";
import { SurveyDemographics, SurveyHabits } from "@/types/survey";
import { submitSurveyResponse } from "@/lib/surveyApi";

interface ChoiceStepConfig<K extends string> {
  key: K;
  eyebrow: string;
  title: string;
  subtitle?: string;
  options: ChoiceOption[];
  skippable?: boolean;
}

const DEMO_STEPS: ChoiceStepConfig<keyof SurveyDemographics>[] = [
  {
    key: "age_range",
    eyebrow: "About you",
    title: "How old are you?",
    options: AGE_RANGES.map((v) => ({ value: v, label: v })),
  },
  {
    key: "gender",
    eyebrow: "About you",
    title: "What's your gender?",
    subtitle: "Optional — skip if you'd rather not say.",
    options: GENDER_OPTIONS.map((v) => ({ value: v, label: v })),
    skippable: true,
  },
  {
    key: "city_tier",
    eyebrow: "Where you live",
    title: "What kind of city do you live in?",
    options: CITY_TIERS.map((t) => ({ value: t.value, label: t.label, hint: t.hint })),
  },
  {
    key: "pocket_money_range",
    eyebrow: "Money in",
    title: "How much pocket money / allowance do you get monthly?",
    options: POCKET_MONEY_RANGES.map((v) => ({ value: v, label: v })),
  },
  {
    key: "family_income_bracket",
    eyebrow: "Money in",
    title: "What's your family's annual income bracket?",
    subtitle: "Optional & skippable — helps us compare spending across income levels.",
    options: FAMILY_INCOME_BRACKETS.map((v) => ({ value: v, label: v })),
    skippable: true,
  },
];

// Quick behavioral questions — same one-tap UI as demographics, but these
// feed the prediction model more directly than a profile field would:
// payment channel, and pocket-money runway (a proxy for the overspend risk
// the model is ultimately trying to forecast).
const HABIT_STEPS: ChoiceStepConfig<keyof SurveyHabits>[] = [
  {
    key: "payment_method",
    eyebrow: "Money habits",
    title: "How do you usually pay for things?",
    options: PAYMENT_METHODS.map((v) => ({ value: v, label: v })),
  },
  {
    key: "pocket_money_duration",
    eyebrow: "Money habits",
    title: "Does your pocket money usually last the month?",
    options: POCKET_MONEY_DURATION.map((v) => ({ value: v, label: v })),
  },
  {
    key: "tracks_spending",
    eyebrow: "Money habits",
    title: "Do you track your spending anywhere?",
    options: SPEND_TRACKING_OPTIONS.map((v) => ({ value: v, label: v })),
  },
];

const INTRO_INDEX = 0;
const DEMO_START = 1;
const HABITS_START = DEMO_START + DEMO_STEPS.length; // 6
const CATEGORY_START = HABITS_START + HABIT_STEPS.length; // 9
const OPEN_INDEX = CATEGORY_START + SURVEY_CATEGORIES.length; // 26
const SUBMIT_INDEX = OPEN_INDEX + 1; // 27
const TOTAL_STEPS = SUBMIT_INDEX + 1; // 28

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0 }),
};

function formatTimeLeft(stepsLeft: number): string {
  const seconds = Math.max(1, Math.round(stepsLeft * SURVEY_AVG_SECONDS_PER_STEP));
  if (seconds < 60) return `~${seconds}s left`;
  const minutes = Math.round(seconds / 60);
  return `~${minutes}min left`;
}

export default function SurveyPage() {
  const [checkedCooldown, setCheckedCooldown] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);

  // Phase 2: this anonymous flow didn't previously ask for any explicit
  // consent before the /privacy /terms links, unlike the signed-in app's
  // ConsentGate — worth stating plainly rather than assuming one already
  // existed. Added here because the brief for this pass is explicit that
  // consent must not be weakened or skipped for an audience that includes
  // minors, even on a no-login flow like this one.
  const [reviewConsented, setReviewConsented] = useState(false);

  const [stepIndex, setStepIndex] = useState(INTRO_INDEX);
  const [direction, setDirection] = useState(1);

  const [demographics, setDemographics] = useState<SurveyDemographics>({
    age_range: null,
    gender: null,
    city_tier: null,
    pocket_money_range: null,
    family_income_bracket: null,
  });
  const [habits, setHabits] = useState<SurveyHabits>({
    payment_method: null,
    pocket_money_duration: null,
    tracks_spending: null,
  });
  const [categorySpend, setCategorySpend] = useState<Record<string, string>>({});
  const [otherSpendNote, setOtherSpendNote] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const startedAtRef = useRef<number>(Date.now());

  // Bootloader stays up for a fixed minimum stretch regardless of how fast
  // the cooldown check resolves (it's sync-fast off localStorage) — so the
  // mark's assemble-in animation always gets to play instead of flashing by.
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem(SURVEY_LOCAL_STORAGE_KEY);
      if (last && Date.now() - parseInt(last, 10) < SURVEY_RESUBMIT_COOLDOWN_MS) {
        setCooldownActive(true);
      }
    } catch (e) {
      // localStorage unavailable (private mode etc.) — just proceed normally.
    }
    setCheckedCooldown(true);

    const timer = setTimeout(() => setMinSplashElapsed(true), 1300);
    return () => clearTimeout(timer);
  }, []);

  const goNext = () => {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS - 1));
  };
  const goBack = () => {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async (emailOverride?: string) => {
    setSubmitting(true);
    setSubmitError(null);

    const category_spend: Record<string, number> = {};
    SURVEY_CATEGORIES.forEach((c) => {
      category_spend[c.id] = parseInt(categorySpend[c.id] || "0", 10) || 0;
    });

    const result = await submitSurveyResponse({
      demographics,
      habits,
      category_spend,
      other_spend_note: otherSpendNote,
      beta_email: (emailOverride ?? betaEmail) || null,
      honeypot,
      startedAt: startedAtRef.current,
    });

    setSubmitting(false);

    if (result.ok) {
      try {
        localStorage.setItem(SURVEY_LOCAL_STORAGE_KEY, String(Date.now()));
      } catch (e) {
        // Non-fatal — just means the soft cooldown nudge won't show next visit.
      }
      setSubmitted(true);
    } else {
      setSubmitError(result.error);
    }
  };

  if (!checkedCooldown || !minSplashElapsed) {
    return <AntaraBootloader />;
  }

  if (cooldownActive) {
    return (
      <SurveyShell>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-center px-8">
          <div className="w-14 h-14 rounded-full bg-purple-500/15 border border-purple-500/40 flex items-center justify-center mb-5">
            <CheckCircle className="w-7 h-7 text-purple-400" />
          </div>
          <h1 className="text-xl font-black text-white">You've already helped us out</h1>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            Looks like this browser recently submitted a response. Thank you! If this is a
            different person on a shared device, you're welcome to submit again.
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setCooldownActive(false)}
            className="mt-6 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors"
          >
            Submit another response
          </motion.button>
        </div>
      </SurveyShell>
    );
  }

  // ---- Step content ----
  let content: React.ReactNode;

  if (stepIndex === INTRO_INDEX) {
    content = (
      <div key="intro" className="min-h-full flex flex-col">
        <StepContainer
          eyebrow="Antara Research"
          title="Help train Antara's spend-prediction model"
          subtitle="A quick survey on how teens in India actually spend money, across every income level."
        >
          <div className="space-y-2 mt-1 text-xs text-gray-400">
            <InfoRow text="About 2–3 minutes" />
            <InfoRow text="Anonymous & voluntary — no account, no login" />
          </div>

          <label className="flex items-start gap-3 p-4 mt-5 rounded-2xl bg-white/[0.05] border border-white/10 cursor-pointer">
            <input
              type="checkbox"
              checked={reviewConsented}
              onChange={(e) => setReviewConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary-500 shrink-0"
            />
            <span className="text-[12.5px] leading-relaxed text-gray-300">
              I'm okay with sharing anonymous answers about my own spending, and I've read the{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-300 underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-300 underline">
                Terms of Use
              </a>
              .
            </span>
          </label>
        </StepContainer>
        <StepFooter onPrimary={goNext} primaryLabel="Start survey" primaryDisabled={!reviewConsented} />
      </div>
    );
  } else if (stepIndex >= DEMO_START && stepIndex < HABITS_START) {
    const cfg = DEMO_STEPS[stepIndex - DEMO_START];
    const value = demographics[cfg.key];
    content = (
      <div key={`demo-${cfg.key}`} className="min-h-full flex flex-col">
        <StepContainer eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle}>
          <ChoiceList
            options={cfg.options}
            selected={value}
            onSelect={(v) => setDemographics((prev) => ({ ...prev, [cfg.key]: v }))}
          />
        </StepContainer>
        <StepFooter
          onPrimary={goNext}
          primaryDisabled={!value}
          onSkip={
            cfg.skippable
              ? () => {
                  setDemographics((prev) => ({ ...prev, [cfg.key]: null }));
                  goNext();
                }
              : undefined
          }
          skipLabel="Prefer not to say"
        />
      </div>
    );
  } else if (stepIndex >= HABITS_START && stepIndex < CATEGORY_START) {
    const cfg = HABIT_STEPS[stepIndex - HABITS_START];
    const value = habits[cfg.key];
    content = (
      <div key={`habit-${cfg.key}`} className="min-h-full flex flex-col">
        <StepContainer eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle}>
          <ChoiceList
            options={cfg.options}
            selected={value}
            onSelect={(v) => setHabits((prev) => ({ ...prev, [cfg.key]: v }))}
          />
        </StepContainer>
        <StepFooter onPrimary={goNext} primaryDisabled={!value} />
      </div>
    );
  } else if (stepIndex >= CATEGORY_START && stepIndex < OPEN_INDEX) {
    const catIdx = stepIndex - CATEGORY_START;
    const cat = SURVEY_CATEGORIES[catIdx];
    const raw = categorySpend[cat.id] ?? "";
    content = (
      <div key={`cat-${cat.id}`} className="min-h-full flex flex-col">
        <StepContainer
          icon={
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `${cat.color}1F`,
                border: `1px solid ${cat.color}4D`,
                color: cat.color,
              }}
            >
              <cat.icon className="w-5 h-5" />
            </div>
          }
          eyebrow={`Spending · ${catIdx + 1} of ${SURVEY_CATEGORIES.length}`}
          title={`How much do you spend monthly on ${cat.label.toLowerCase()}?`}
          subtitle="Rough monthly average in ₹. Tap ₹0 / N/A if this doesn't apply to you."
        >
          <NumericKeypad
            value={raw}
            onChange={(v) => setCategorySpend((prev) => ({ ...prev, [cat.id]: v }))}
          />
        </StepContainer>
        <StepFooter onPrimary={goNext} primaryDisabled={raw === ""} />
      </div>
    );
  } else if (stepIndex === OPEN_INDEX) {
    content = (
      <div key="open" className="min-h-full flex flex-col">
        <StepContainer
          eyebrow="Almost there"
          title="Spend on anything we didn't list?"
          subtitle="Optional — one thing you regularly spend money on that isn't covered above."
        >
          <textarea
            value={otherSpendNote}
            onChange={(e) => setOtherSpendNote(e.target.value.slice(0, 300))}
            rows={5}
            placeholder="e.g. Thrifted sneakers, cricket betting pools, birthday gifts for friends…"
            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
          />
          <p className="text-right text-[10px] text-gray-600 mt-1.5">{otherSpendNote.length}/300</p>
        </StepContainer>
        <StepFooter onPrimary={goNext} primaryLabel="Continue" />
      </div>
    );
  } else {
    // SUBMIT_INDEX
    content = submitted ? (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.default}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-center px-8"
        key="thankyou"
      >
        <div className="relative w-16 h-16 mb-5">
          <SuccessBurst />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springs.default, delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-purple-500/15 border border-purple-500/40 flex items-center justify-center"
          >
            <CheckCircle className="w-8 h-8 text-purple-400" />
          </motion.div>
        </div>
        <h1 className="text-2xl font-black text-white">Thank you.</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-xs leading-relaxed">
          Your answers just helped train Antara's spend-prediction model for Indian teens.
        </p>
      </motion.div>
    ) : (
      <div key="submit" className="min-h-full flex flex-col">
        <StepContainer
          eyebrow="Last step"
          title="Want early access to Antara?"
          subtitle="Optional — leave your email for a beta invite when we launch. Used for that only."
        >
          <input
            type="email"
            value={betaEmail}
            onChange={(e) => setBetaEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          {submitError && <p className="text-xs text-rose-400 mt-3">{submitError}</p>}
        </StepContainer>
        <StepFooter
          onPrimary={() => handleSubmit()}
          primaryLabel="Submit survey"
          loading={submitting}
          loadingLabel="Saving your answers…"
          onSkip={() => handleSubmit("")}
          skipLabel="Skip email & submit"
        />
      </div>
    );
  }

  const stepsLeft = TOTAL_STEPS - (stepIndex + 1);

  return (
    <SurveyShell>
      {/* Honeypot — invisible to humans, tempting to bots. Never rendered as a real field. */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px overflow-hidden"
      />

      {!(stepIndex === SUBMIT_INDEX && submitted) && (
        <SurveyProgress
          step={stepIndex + 1}
          totalSteps={TOTAL_STEPS}
          onBack={stepIndex > 0 ? goBack : undefined}
          timeLeftLabel={stepsLeft > 0 ? formatTimeLeft(stepsLeft) : undefined}
        />
      )}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={springs.default}
            className="absolute inset-0 overflow-y-auto flex flex-col"
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>
    </SurveyShell>
  );
}

const InfoRow: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2">
    <span className="w-1 h-1 rounded-full bg-purple-400" />
    <span>{text}</span>
  </div>
);

const SurveyShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-[100dvh] bg-background flex justify-center overflow-hidden">
    <div className="w-full max-w-md h-full flex flex-col relative overflow-hidden">
      {/* Subtle ambient glow, echoes the app's own radial indigo backdrop */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-72 h-72 bg-purple-600/15 rounded-full blur-3xl" />
      {children}
    </div>
  </div>
);
