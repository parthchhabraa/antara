import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";

describe("Firestore Security Rules Tests", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Step 15 — was `"../firestore.rules"`, which resolves to
    // frontend/src/firestore.rules: never existed. The real file is at the
    // repo root (../../../ from src/tests/), two directories further up
    // than this pointed at — this file could never have actually run
    // before now, jest or no jest, emulator or no emulator.
    const rules = fs.readFileSync(
      path.resolve(__dirname, "../../../firestore.rules"),
      "utf8"
    );
    testEnv = await initializeTestEnvironment({
      projectId: "antara-moneycontrol",
      firestore: {
        rules,
        host: "127.0.0.1",
        // Step 15 — was 8080, which is already bound by an unrelated
        // service on this box (a docker-proxy, per `ss -ltnp`); this test's
        // own port choice shouldn't have to know or care what else is
        // running here, so it's pinned to the less commonly-claimed 8085
        // instead, matching firebase.json's emulator config.
        port: 8085,
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

  // Seeds admin/betaAllowlist bypassing rules, mirroring how the superadmin
  // panel actually writes it (both the flat `emails` array rules check against,
  // and the richer `entries` array the UI displays).
  async function seedAllowlist(emails: string[]) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc("admin/betaAllowlist")
        .set({
          emails,
          entries: emails.map((email) => ({
            email,
            added_at: new Date().toISOString(),
            added_by: "test-setup",
          })),
        });
    });
  }

  test("Unauthenticated user CANNOT read or write any transactions", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const txRef = unauthedDb.doc("users/user_alice/transactions/tx_1");
    await assertFails(txRef.get());
    await assertFails(
      txRef.set({
        amount: 500,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Allowlisted user Alice CAN read and write her own transactions", async () => {
    await seedAllowlist(["alice@example.com"]);
    const aliceDb = testEnv
      .authenticatedContext("user_alice", { email: "alice@example.com" })
      .firestore();
    const aliceTx = aliceDb.doc("users/user_alice/transactions/tx_1");
    await assertSucceeds(
      aliceTx.set({
        amount: 250,
        category: "food-snacks",
        note: "Swiggy snack",
        timestamp: new Date().toISOString(),
      })
    );
    await assertSucceeds(aliceTx.get());
  });

  test("Authenticated but NON-allowlisted user CANNOT write her own transactions", async () => {
    await seedAllowlist(["someone.else@example.com"]);
    const aliceDb = testEnv
      .authenticatedContext("user_alice", { email: "alice@example.com" })
      .firestore();
    const aliceTx = aliceDb.doc("users/user_alice/transactions/tx_1");
    await assertFails(
      aliceTx.set({
        amount: 250,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Authenticated user with no betaAllowlist doc at all CANNOT write transactions", async () => {
    // No seedAllowlist() call - admin/betaAllowlist doesn't exist yet.
    const aliceDb = testEnv
      .authenticatedContext("user_alice", { email: "alice@example.com" })
      .firestore();
    const aliceTx = aliceDb.doc("users/user_alice/transactions/tx_1");
    await assertFails(
      aliceTx.set({
        amount: 250,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Superadmin CAN write to any user's transactions even when not on the allowlist", async () => {
    await seedAllowlist(["someone.else@example.com"]);
    const superadminDb = testEnv
      .authenticatedContext("user_parth", { email: "parthchhabra6112@gmail.com", role: "superadmin" })
      .firestore();
    const aliceTx = superadminDb.doc("users/user_alice/transactions/tx_1");
    await assertSucceeds(
      aliceTx.set({
        amount: 250,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("User Bob CANNOT read or write Alice's transactions", async () => {
    await seedAllowlist(["bob@example.com", "alice@example.com"]);
    const bobDb = testEnv
      .authenticatedContext("user_bob", { email: "bob@example.com" })
      .firestore();
    const aliceTx = bobDb.doc("users/user_alice/transactions/tx_1");
    await assertFails(aliceTx.get());
    await assertFails(
      aliceTx.set({
        amount: 999,
        category: "gaming-inapp",
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
    const catRef = superadminDb.doc("categories/food-snacks");
    await assertSucceeds(
      catRef.set({
        name: "Food, drinks & snacks",
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
});
