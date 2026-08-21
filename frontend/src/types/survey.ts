export interface SurveyDemographics {
  age_range: string | null;
  gender: string | null; // optional, skippable
  city_tier: "metro" | "tier2" | "tier3" | null;
  pocket_money_range: string | null;
  family_income_bracket: string | null; // optional, skippable
}

// category_id -> monthly spend in INR. Every category in SURVEY_CATEGORIES
// is present with a value of 0 or more by the time this is submitted.
export type SurveyCategorySpend = Record<string, number>;

export interface SurveySubmissionInput {
  demographics: SurveyDemographics;
  category_spend: SurveyCategorySpend;
  other_spend_note: string;
  beta_email: string | null;
  honeypot: string;
  startedAt: number; // Date.now() when the respondent opened the survey
}

export interface StoredSurveyResponse {
  schema_version: number;
  submitted_at: unknown; // Firestore server timestamp
  demographics: SurveyDemographics;
  category_spend: SurveyCategorySpend;
  other_spend_note: string | null;
  beta_email: string | null;
  meta: {
    completion_seconds: number;
    source: string;
  };
}
