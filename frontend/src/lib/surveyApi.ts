import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { SURVEY_SCHEMA_VERSION, SURVEY_MIN_COMPLETION_SECONDS } from "./surveyConstants";
import { SurveySubmissionInput, StoredSurveyResponse } from "@/types/survey";

export type SubmitSurveyResult =
  | { ok: true; id: string }
  | { ok: true; skipped: true } // looked like a bot — pretend success, don't tip it off
  | { ok: false; error: string };

export async function submitSurveyResponse(
  input: SurveySubmissionInput
): Promise<SubmitSurveyResult> {
  const completionSeconds = Math.round((Date.now() - input.startedAt) / 1000);

  // Bot check #1: honeypot field. Real respondents never see or fill it.
  // Bot check #2: a 20-category survey answered in a few seconds is scripted.
  if (input.honeypot.trim().length > 0 || completionSeconds < SURVEY_MIN_COMPLETION_SECONDS) {
    return { ok: true, skipped: true };
  }

  const payload: Omit<StoredSurveyResponse, "submitted_at"> & { submitted_at: ReturnType<typeof serverTimestamp> } = {
    schema_version: SURVEY_SCHEMA_VERSION,
    submitted_at: serverTimestamp(),
    demographics: input.demographics,
    category_spend: input.category_spend,
    other_spend_note: input.other_spend_note.trim() || null,
    beta_email: input.beta_email?.trim() || null,
    meta: {
      completion_seconds: completionSeconds,
      source: "web_survey_v1",
    },
  };

  try {
    const ref = collection(db, "survey_responses");
    const docRef = await addDoc(ref, payload);
    return { ok: true, id: docRef.id };
  } catch (err) {
    console.error("Error submitting survey response to Firestore:", err);
    return { ok: false, error: "We couldn't save your response — check your connection and try again." };
  }
}
