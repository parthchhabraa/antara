// Step 15 §4 — wires up the previously-unrunnable firestore-rules.test.ts.
// ts-jest + a plain "node" test environment (this test talks to a local
// Firestore emulator over HTTP/gRPC, no DOM involved) is the minimal setup;
// nothing here is Next.js-specific since these are plain rules tests, not
// component tests.
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/tests/**/*.test.ts"],
  // Rules-unit-testing evaluates rules against a real (emulated) backend
  // per test, which is slower than a pure unit test — default 5s jest
  // timeout is too tight against a freshly-started emulator.
  testTimeout: 20000,
};
