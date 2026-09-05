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
  // and the richer `entries` array the UI displays). Brief 2 (2026-09-04):
  // the rules no longer read this document to gate transaction writes (see
  // isBetaAllowlisted() in firestore.rules — it's a `request.auth.token.beta`
  // check now, resolved server-side by POST /api/v1/auth/sync-claims), so
  // this helper is only still relevant for the admin/betaAllowlist
  // read/write-permission tests further down, not the gating tests.
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

  // Brief 2 (2026-09-04): isBetaAllowlisted() is now a `request.auth.token.beta`
  // check, not a Firestore read — so these gating tests set the `beta` custom
  // claim directly on the test context instead of seeding admin/betaAllowlist
  // (that document's own read/write permissions are tested separately below).

  test("User with a `beta: true` custom claim CAN read and write her own transactions", async () => {
    const aliceDb = testEnv
      .authenticatedContext("user_alice", { email: "alice@example.com", beta: true })
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

  test("Authenticated user with `beta: false` CANNOT write her own transactions", async () => {
    const aliceDb = testEnv
      .authenticatedContext("user_alice", { email: "alice@example.com", beta: false })
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

  test("Authenticated user with no `beta` claim at all CANNOT write transactions", async () => {
    // No beta claim in the context at all — the pre-sync-claims state for a
    // brand-new account, or an account whose claim sync has never run.
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

  test("Superadmin CAN write to any user's transactions even without a `beta` claim", async () => {
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

  test("User Bob CANNOT read or write Alice's transactions, even with `beta: true`", async () => {
    const bobDb = testEnv
      .authenticatedContext("user_bob", { email: "bob@example.com", beta: true })
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

  // Brief 2 (2026-09-04) — the actual leak this brief closes: this document
  // holds a flat array of every beta tester's email address, and used to be
  // `allow read: if isAuthenticated()`. Any signed-in account, allowlisted
  // or not (including a brand-new public signup), could read the whole
  // list straight out of the browser console. Now superadmin-only.
  test("Regular authenticated user (even with a `beta: true` claim) CANNOT read admin/betaAllowlist", async () => {
    await seedAllowlist(["alice@example.com", "some.other.teen@example.com"]);
    const aliceDb = testEnv
      .authenticatedContext("user_alice", { email: "alice@example.com", beta: true })
      .firestore();
    await assertFails(aliceDb.doc("admin/betaAllowlist").get());
  });

  test("Superadmin CAN read admin/betaAllowlist", async () => {
    await seedAllowlist(["alice@example.com"]);
    const superadminDb = testEnv
      .authenticatedContext("user_parth", { email: "parthchhabra6112@gmail.com", role: "superadmin" })
      .firestore();
    await assertSucceeds(superadminDb.doc("admin/betaAllowlist").get());
  });
});
