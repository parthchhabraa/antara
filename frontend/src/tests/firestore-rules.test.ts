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
});
