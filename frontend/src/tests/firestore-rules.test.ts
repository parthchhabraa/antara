import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp } from "firebase/firestore";
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

  // ──────────────────────────────────────────────────────────────────────
  // Brief 3 (2026-09-05): field validation. Before this, ownership + the
  // beta claim/public-signup gate was the only check on a write — a
  // `beta: true` account could otherwise write literally any document
  // shape into its own transactions/wallets/income/instances. Every case
  // below uses a `beta: true` context specifically to prove the rejection
  // comes from isValidTransaction()/etc., not from the allowlist gate.
  // ──────────────────────────────────────────────────────────────────────

  const aliceBetaDb = () =>
    testEnv.authenticatedContext("user_alice", { email: "alice@example.com", beta: true }).firestore();

  test("A valid transaction with every optional field set CAN be written", async () => {
    await assertSucceeds(
      aliceBetaDb().doc("users/user_alice/transactions/tx_valid").set({
        amount: 250,
        category: "food-snacks",
        subcategory: "Swiggy/Zomato",
        note: "Lunch",
        timestamp: new Date().toISOString(),
        source: "upi",
        wallet_id: "wallet_1",
      })
    );
  });

  test("Transaction with a negative amount CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/transactions/tx_bad").set({
        amount: -250,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Transaction with amount over the ₹10,00,000 cap CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/transactions/tx_bad").set({
        amount: 1e8,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Transaction with an unknown category id CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/transactions/tx_bad").set({
        amount: 250,
        category: "not-a-real-category",
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Transaction with a note over 280 characters CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/transactions/tx_bad").set({
        amount: 250,
        category: "food-snacks",
        note: "x".repeat(281),
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Transaction with an undeclared extra field CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/transactions/tx_bad").set({
        amount: 250,
        category: "food-snacks",
        timestamp: new Date().toISOString(),
        is_admin: true, // not a real Transaction field
      })
    );
  });

  test("Transaction with a native Timestamp more than 24h in the future CANNOT be written", async () => {
    const farFuture = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
    await assertFails(
      aliceBetaDb().doc("users/user_alice/transactions/tx_bad").set({
        amount: 250,
        category: "food-snacks",
        timestamp: farFuture,
      })
    );
  });

  test("Transaction with a native Timestamp within 24h of now CAN be written", async () => {
    const soon = Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000);
    await assertSucceeds(
      aliceBetaDb().doc("users/user_alice/transactions/tx_ok_future").set({
        amount: 250,
        category: "food-snacks",
        timestamp: soon,
      })
    );
  });

  test("Deleting a transaction still works (no isValidTransaction() shape check on delete)", async () => {
    const db = aliceBetaDb();
    const ref = db.doc("users/user_alice/transactions/tx_to_delete");
    await assertSucceeds(
      ref.set({ amount: 100, category: "food-snacks", timestamp: new Date().toISOString() })
    );
    await assertSucceeds(ref.delete());
  });

  test("Wallet with a name over 60 characters CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/wallets/w1").set({
        name: "x".repeat(61),
        balance: 0,
        created_at: new Date().toISOString(),
        archived: false,
      })
    );
  });

  test("Wallet balance CAN be negative (unlike a transaction amount)", async () => {
    await assertSucceeds(
      aliceBetaDb().doc("users/user_alice/wallets/w1").set({
        name: "Cash",
        balance: -500,
        created_at: new Date().toISOString(),
        archived: false,
      })
    );
  });

  test("Wallet balance beyond the magnitude cap CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/wallets/w1").set({
        name: "Cash",
        balance: -2_000_000,
        created_at: new Date().toISOString(),
        archived: false,
      })
    );
  });

  test("Income entry missing the required wallet_id CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/income/i1").set({
        amount: 500,
        timestamp: new Date().toISOString(),
      })
    );
  });

  test("Valid income entry CAN be written", async () => {
    await assertSucceeds(
      aliceBetaDb().doc("users/user_alice/income/i1").set({
        amount: 500,
        source: "allowance",
        timestamp: new Date().toISOString(),
        wallet_id: "wallet_1",
      })
    );
  });

  test("Instance with an unknown category id in `pinned` CANNOT be written", async () => {
    await assertFails(
      aliceBetaDb().doc("users/user_alice/instances/inst1").set({
        name: "My split",
        pinned: { "not-a-real-category": 500 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );
  });

  test("Valid instance CAN be written", async () => {
    await assertSucceeds(
      aliceBetaDb().doc("users/user_alice/instances/inst1").set({
        name: "My split",
        pinned: { "food-snacks": 1000, fitness: 500 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // Brief 5 (2026-09-05): in-app feedback — owner-create-only,
  // superadmin-read. Doesn't need a `beta` claim (isAuthenticated() only,
  // matching backend/app/main.py's own routes that don't gate on the
  // allowlist — feedback isn't a Live Mode financial write).
  // ──────────────────────────────────────────────────────────────────────

  test("Authenticated user CAN submit their own feedback", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice", { email: "alice@example.com" }).firestore();
    await assertSucceeds(
      aliceDb.collection("feedback").add({
        uid: "user_alice",
        message: "The Pull screen is confusing on first open.",
        app_version: "1.5.0",
        user_agent: "test-agent",
        submitted_at: new Date().toISOString(),
      })
    );
  });

  test("User CANNOT submit feedback with someone else's uid", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice", { email: "alice@example.com" }).firestore();
    await assertFails(
      aliceDb.collection("feedback").add({
        uid: "user_bob", // spoofed — doesn't match request.auth.uid
        message: "Pretending to be Bob.",
        app_version: "1.5.0",
        user_agent: "test-agent",
        submitted_at: new Date().toISOString(),
      })
    );
  });

  test("Feedback message over 2000 characters CANNOT be submitted", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice", { email: "alice@example.com" }).firestore();
    await assertFails(
      aliceDb.collection("feedback").add({
        uid: "user_alice",
        message: "x".repeat(2001),
        app_version: "1.5.0",
        user_agent: "test-agent",
        submitted_at: new Date().toISOString(),
      })
    );
  });

  test("Regular user CANNOT read feedback (not even their own)", async () => {
    const aliceDb = testEnv.authenticatedContext("user_alice", { email: "alice@example.com" }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("feedback").doc("fb1").set({
        uid: "user_alice",
        message: "hi",
        app_version: "1.5.0",
        user_agent: "test-agent",
        submitted_at: new Date().toISOString(),
      });
    });
    await assertFails(aliceDb.collection("feedback").doc("fb1").get());
  });

  test("Superadmin CAN read feedback", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("feedback").doc("fb1").set({
        uid: "user_alice",
        message: "hi",
        app_version: "1.5.0",
        user_agent: "test-agent",
        submitted_at: new Date().toISOString(),
      });
    });
    const superadminDb = testEnv.authenticatedContext("user_parth", { role: "superadmin" }).firestore();
    await assertSucceeds(superadminDb.collection("feedback").doc("fb1").get());
  });
});
