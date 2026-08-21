import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import * as fs from "fs";
import * as path from "path";

const { FieldValue } = firebase.firestore;

describe("Firestore Security Rules Tests", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(
      path.resolve(__dirname, "../firestore.rules"),
      "utf8"
    );
    testEnv = await initializeTestEnvironment({
      projectId: "antara-moneycontrol",
      firestore: {
        rules,
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  test("Unauthenticated user CANNOT read or write any transactions", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const txRef = unauthedDb.doc("users/user_alice/transactions/tx_1");
    await assertFails(txRef.get());
    await assertFails(
      txRef.set({
        amount: 500,
        category: "food-delivery",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("User Alice CAN read and write her own transactions", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice").firestore();
    const aliceTx = aliceDb.doc("users/user_alice/transactions/tx_1");
    await assertSucceeds(
      aliceTx.set({
        amount: 250,
        category: "food-delivery",
        note: "Swiggy snack",
        timestamp: new Date().toISOString(),
      })
    );
    await assertSucceeds(aliceTx.get());
  });

  test("User Bob CANNOT read or write Alice's transactions", async () => {
    const bobDb = testEnv.authenticatedContext("user_bob").firestore();
    const aliceTx = bobDb.doc("users/user_alice/transactions/tx_1");
    await assertFails(aliceTx.get());
    await assertFails(
      aliceTx.set({
        amount: 999,
        category: "gaming",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Regular user CANNOT write to categories taxonomy", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice").firestore();
    const catRef = aliceDb.doc("categories/new_category");
    await assertFails(
      catRef.set({
        name: "Hacked Category",
        color: "#000",
      })
    );
  });

  test("Superadmin claim CAN write to categories taxonomy", async () => {
    const superadminDb = testEnv
      .authenticatedContext("user_parth", { role: "superadmin" })
      .firestore();
    const catRef = superadminDb.doc("categories/food-delivery");
    await assertSucceeds(
      catRef.set({
        name: "Food delivery & street food",
        color: "#F97316",
        is_essential: false,
      })
    );
  });

  test("Regular user CANNOT write to admin/betaAllowlist", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice").firestore();
    const allowlistRef = aliceDb.doc("admin/betaAllowlist");
    await assertFails(
      allowlistRef.set({
        emails: ["attacker@evil.com"],
      })
    );
  });

  test("Superadmin claim CAN write to admin/betaAllowlist", async () => {
    const superadminDb = testEnv
      .authenticatedContext("user_parth", { role: "superadmin" })
      .firestore();
    const allowlistRef = superadminDb.doc("admin/betaAllowlist");
    await assertSucceeds(
      allowlistRef.set({
        emails: ["parthchhabra6112@gmail.com", "beta.tester@antara.app"],
      })
    );
  });

  const validSurveyDoc = {
    schema_version: 2,
    submitted_at: FieldValue.serverTimestamp(),
    demographics: { age_range: "16–18", gender: null, city_tier: "metro", pocket_money_range: "₹1,500 – ₹3,000", family_income_bracket: null },
    habits: { payment_method: "Mostly UPI", pocket_money_duration: "Sometimes runs out early", tracks_spending: "No, never" },
    category_spend: { "food-snacks": 800, "gaming-inapp": 500 },
    other_spend_note: null,
    beta_email: null,
    meta: { completion_seconds: 95, source: "web_survey_v1" },
  };

  test("Unauthenticated respondent CAN submit a well-formed survey response", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      unauthedDb.collection("survey_responses").add(validSurveyDoc)
    );
  });

  test("Survey submission with unexpected extra fields is REJECTED", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      unauthedDb.collection("survey_responses").add({
        ...validSurveyDoc,
        admin_override: true,
      })
    );
  });

  test("Unauthenticated respondent CANNOT read back survey responses", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = unauthedDb.collection("survey_responses").doc("resp_1");
    await assertFails(docRef.get());
  });

  test("Superadmin CAN read survey responses", async () => {
    const superadminDb = testEnv
      .authenticatedContext("user_parth", { role: "superadmin" })
      .firestore();
    const docRef = superadminDb.collection("survey_responses").doc("resp_1");
    await assertSucceeds(docRef.set(validSurveyDoc));
    await assertSucceeds(docRef.get());
  });

  test("Regular authenticated user CANNOT read survey responses", async () => {
    const superadminDb = testEnv
      .authenticatedContext("user_parth", { role: "superadmin" })
      .firestore();
    await assertSucceeds(
      superadminDb.collection("survey_responses").doc("resp_1").set(validSurveyDoc)
    );

    const aliceDb = testEnv.authenticatedContext("user_alice").firestore();
    await assertFails(aliceDb.collection("survey_responses").doc("resp_1").get());
  });
});
