# Antara Engineering Review — Step 4

## Status
ALL COMPLETED — Antara Step 4: Cold-start heuristics, 14-day ML trigger, live Firestore sync, named tunnel config, and rules unit tests, github pushed, server updated

---

## 1. What Shipped
- **Real ML vs Cold-Start Heuristic Engine (`backend/app/ml/engine.py`)**:
  - **Cold-Start Heuristic Mode (< 14 days or < 5 transactions)**: Replaced ungrounded predictions with rule-based Indian teen category medians scaled to budget. Explicitly flags `is_cold_start: true`, `model_mode: "HEURISTIC_COLD_START"`, and lower confidence score (`~0.45`), with clear labels in smart insights preventing fabricated statistics.
  - **Trained Embedding Mode (>= 14 days & >= 5 transactions)**: Transitions to personalized spend behavior embeddings, cosine-similarity peer clustering, and logs `last_retrained_at` per user.
  - Comprehensive pytest test suite (`backend/tests/test_api.py`) verifying both cold-start and mature 14-day modes.
- **End-to-End Live Firestore Data Flow (`frontend/src/app/page.tsx`, `graph/`, `predict/`)**:
  - Real-time Firestore sync via `onSnapshot` from `users/{uid}/transactions`.
  - Logging expenses in Live Mode writes directly to Firestore subcollection, dynamically recomputing the ML spend forecast and Obsidian Dot Graph.
  - Seamless toggle between in-memory Demo dataset and Live Firestore data.
- **Prominent UI Indicators**:
  - Added glowing top-bar badge: `"DEMO DATA (IN-MEMORY)"` vs `"LIVE FIRESTORE"`.
  - Added Data Maturity tracker (`N/14 days logged`) and `Cold-Start Heuristic` badge on the Prediction Card.
- **Firestore Security Rules Unit Tests (`frontend/src/tests/firestore-rules.test.ts`)**:
  - Automated tests asserting unauthenticated isolation, user cross-boundary isolation (Alice cannot read/write Bob's transactions), and strict `role: 'superadmin'` enforcement on `categories/*` and `admin/betaAllowlist`.
- **Named Cloudflare Tunnel Provisioner (`scripts/setup_named_tunnel.sh`)**:
  - Script configuring persistent named tunnel (`antara-ml-tunnel`) routing `ml.antara.app` to port `8001`, preserving ports `5000` and `8000`.
- **Superadmin Script & Server Memory**:
  - Configured `scripts/set_superadmin.py` with `antara-moneycontrol` project initialization.
  - Updated `/root/antara/.env-remember` template with named tunnel specs, 14-day cold-start threshold, and seeded taxonomy.

---

## 2. What Broke / Issues Resolved
- Python ML Engine `Math.round` NameError: Resolved to native `round()`.
- State setter binding in `graph/page.tsx` and `predict/page.tsx`: Fixed async Firestore write handler to gracefully switch between demo and live state arrays.
- Wheel install network timeout: Added extended timeout flag for `firebase-admin` dependency.

---

## 3. Open Questions / Next Steps
- When ready to run on the production Ubuntu server: execute `sudo bash scripts/setup_named_tunnel.sh` with your registered domain, and run `python3 scripts/set_superadmin.py --cred serviceAccountKey.json` to assign superadmin claim.

---

## 4. Files Touched
- `antara/.env-remember.template`
- `antara/scripts/set_superadmin.py`
- `antara/scripts/setup_named_tunnel.sh`
- `antara/backend/app/schemas.py`
- `antara/backend/app/ml/engine.py`
- `antara/backend/tests/test_api.py`
- `antara/frontend/package.json`
- `antara/frontend/src/types/index.ts`
- `antara/frontend/src/lib/api.ts`
- `antara/frontend/src/components/MobileFrame.tsx`
- `antara/frontend/src/components/PredictiveInsightsCard.tsx`
- `antara/frontend/src/app/page.tsx`
- `antara/frontend/src/app/graph/page.tsx`
- `antara/frontend/src/app/predict/page.tsx`
- `antara/frontend/src/tests/firestore-rules.test.ts`
- `antara/REVIEW.md`
