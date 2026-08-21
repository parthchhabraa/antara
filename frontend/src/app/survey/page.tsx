"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Clock, CheckCircle, Mail } from "lucide-react";

import { SurveyProgress } from "@/components/survey/SurveyProgress";
import { NumericKeypad } from "@/components/survey/NumericKeypad";
import { ChoiceList, ChoiceOption } from "@/components/survey/ChoiceList";
import { StepContainer } from "@/components/survey/StepContainer";
import { StepFooter } from "@/components/survey/StepFooter";

import {
  SURVEY_CATEGORIES,
  AGE_RANGES,
  GENDER_OPTIONS,
  CITY_TIERS,
  POCKET_MONEY_RANGES,
  FAMILY_INCOME_BRACKETS,
  SURVEY_LOCAL_STORAGE_KEY,
  SURVEY_RESUBMIT_COOLDOWN_MS,
} from "@/lib/surveyConstants";
import { SurveyDemographics } from "@/types/survey";
import { submitSurveyResponse } from "@/lib/surveyApi";

interface DemoStepConfig {
  key: keyof SurveyDemographics;
  eyebrow: string;
  title: string;
  subtitle?: string;
  options: ChoiceOption[];
  skippable?: boolean;
}

const DEMO_STEPS: DemoStepConfig[] = [
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

const INTRO_INDEX = 0;
const DEMO_START = 1;
const CATEGORY_START = DEMO_START + DEMO_STEPS.length; // 6
const OPEN_INDEX = CATEGORY_START + SURVEY_CATEGORIES.length; // 26
const SUBMIT_INDEX = OPEN_INDEX + 1; // 27
const TOTAL_STEPS = SUBMIT_INDEX + 1; // 28

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0 }),
};

export default function SurveyPage() {
  const [checkedCooldown, setCheckedCooldown] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);

  const [stepIndex, setStepIndex] = useState(INTRO_INDEX);
  const [direction, setDirection] = useState(1);

  const [demographics, setDemographics] = useState<SurveyDemographics>({
    age_range: null,
    gender: null,
    city_tier: null,
    pocket_money_range: null,
    family_income_bracket: null,
  });
  const [categorySpend, setCategorySpend] = useState<Record<string, string>>({});
  const [otherSpendNote, setOtherSpendNote] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const startedAtRef = useRef<number>(Date.now());

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

  if (!checkedCooldown) {
    return <div className="min-h-[100dvh] bg-[#05100B]" />;
  }

  if (cooldownActive) {
    return (
      <SurveyShell>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-5">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-black text-white">You've already helped us out 🎉</h1>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            Looks like this browser recently submitted a response. Thank you! If this is a
            different person on a shared device, you're welcome to submit again.
          </p>
          <button
            type="button"
            onClick={() => setCooldownActive(false)}
            className="mt-6 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-all"
          >
            Submit another response
          </button>
        </div>
      </SurveyShell>
    );
  }

  // ---- Step content ----
  let content: React.ReactNode;

  if (stepIndex === INTRO_INDEX) {
    content = (
      <React.Fragment key="intro">
        <StepContainer
          icon={<Sparkles className="w-6 h-6" />}
          eyebrow="Antara Research"
          title="Help train Antara's spend-prediction AI"
          subtitle="A quick, anonymous survey on how teens in India actually spend money — across every income level. Your answers directly shape the model."
        >
          <div className="space-y-3 mt-2">
            <InfoRow icon={<Clock className="w-4 h-4" />} text="Takes about 3–4 minutes" />
            <InfoRow icon={<ShieldCheck className="w-4 h-4" />} text="Anonymous & voluntary — no account, no login" />
          </div>
        </StepContainer>
        <StepFooter onPrimary={goNext} primaryLabel="Start survey" />
      </React.Fragment>
    );
  } else if (stepIndex >= DEMO_START && stepIndex < CATEGORY_START) {
    const cfg = DEMO_STEPS[stepIndex - DEMO_START];
    const value = demographics[cfg.key];
    content = (
      <React.Fragment key={`demo-${cfg.key}`}>
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
      </React.Fragment>
    );
  } else if (stepIndex >= CATEGORY_START && stepIndex < OPEN_INDEX) {
    const catIdx = stepIndex - CATEGORY_START;
    const cat = SURVEY_CATEGORIES[catIdx];
    const raw = categorySpend[cat.id] ?? "";
    content = (
      <React.Fragment key={`cat-${cat.id}`}>
        <StepContainer
          icon={<cat.icon className="w-6 h-6" />}
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
      </React.Fragment>
    );
  } else if (stepIndex === OPEN_INDEX) {
    content = (
      <React.Fragment key="open">
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
            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 focus:border-emerald-500 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
          />
          <p className="text-right text-[10px] text-gray-600 mt-1.5">{otherSpendNote.length}/300</p>
        </StepContainer>
        <StepFooter onPrimary={goNext} primaryLabel="Continue" />
      </React.Fragment>
    );
  } else {
    // SUBMIT_INDEX
    content = submitted ? (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8" key="thankyou">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-black text-white">You're in. Thank you! 🎉</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-xs leading-relaxed">
          Your answers just helped train Antara's spend-prediction model for Indian teens.
          Anonymous, appreciated, done.
        </p>
        <Link
          href="/"
          className="mt-7 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Curious what Antara looks like? →
        </Link>
      </div>
    ) : (
      <React.Fragment key="submit">
        <StepContainer
          icon={<Mail className="w-6 h-6" />}
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
            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 focus:border-emerald-500 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {submitError && <p className="text-xs text-rose-400 mt-3">{submitError}</p>}
        </StepContainer>
        <StepFooter
          onPrimary={() => handleSubmit()}
          primaryLabel="Submit survey"
          loading={submitting}
          onSkip={() => handleSubmit("")}
          skipLabel="Skip email & submit"
        />
      </React.Fragment>
    );
  }

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
        />
      )}

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 overflow-y-auto flex flex-col"
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>
    </SurveyShell>
  );
}

const InfoRow: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="flex items-center gap-2.5 text-xs text-gray-400">
    <span className="text-emerald-400">{icon}</span>
    <span>{text}</span>
  </div>
);

const SurveyShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[100dvh] bg-[#05100B] flex justify-center">
    <div className="w-full max-w-md min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* Subtle ambient glow, matches "Whoop-style" restraint — no busy gradients */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
      {children}
    </div>
  </div>
);
