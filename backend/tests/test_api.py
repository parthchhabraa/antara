import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.ml.engine import MLEngine, CATEGORIES_METADATA
from app.schemas import TransactionItem
from app.main import app
from app.firebase_admin import verify_firebase_token

# ────────────────────────────────────────────────────────────────────────
# Brief 2 (2026-09-04): POST /api/v1/auth/sync-claims — resolves beta-
# allowlist membership server-side and stamps it onto the caller's own
# custom claims, so firestore.rules can check a token claim instead of the
# client reading admin/betaAllowlist directly (see REVIEW.md). These tests
# exercise the route itself, not real Firebase Auth/Firestore: the auth
# dependency is overridden (this repo has no fixture for minting real
# Firebase ID tokens in tests) and get_firestore_client/set_beta_claim are
# monkeypatched, so this only proves the route's own logic — the actual
# firestore.rules enforcement of the resulting claim is covered separately
# by frontend/src/tests/firestore-rules.test.ts against the real emulator.
# ────────────────────────────────────────────────────────────────────────

client = TestClient(app)

class _FakeSnapshot:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data

class _FakeDocRef:
    def __init__(self, data):
        self._data = data

    def get(self):
        return _FakeSnapshot(self._data)

class _FakeCollectionRef:
    def __init__(self, data):
        self._data = data

    def document(self, _doc_id):
        return _FakeDocRef(self._data)

class _FakeFirestoreClient:
    """Stands in for firestore.client() — only collection("admin")
    .document("betaAllowlist").get() is exercised by sync_claims."""
    def __init__(self, allowlist_emails):
        self._allowlist_emails = allowlist_emails

    def collection(self, name):
        assert name == "admin"
        return _FakeCollectionRef({"emails": self._allowlist_emails} if self._allowlist_emails is not None else None)

def _override_auth(uid: str, email: str):
    def _fake_verify():
        return {"uid": uid, "email": email}
    return _fake_verify

def test_sync_claims_grants_beta_for_allowlisted_email(monkeypatch):
    monkeypatch.setattr("app.main.get_firestore_client", lambda: _FakeFirestoreClient(["Alice@Example.com"]))
    captured = {}
    monkeypatch.setattr("app.main.set_beta_claim", lambda uid, is_beta: captured.update(uid=uid, is_beta=is_beta))
    app.dependency_overrides[verify_firebase_token] = _override_auth("uid_alice", "alice@example.com")
    try:
        res = client.post("/api/v1/auth/sync-claims")
    finally:
        app.dependency_overrides.pop(verify_firebase_token, None)
    assert res.status_code == 200
    assert res.json() == {"beta": True}
    assert captured == {"uid": "uid_alice", "is_beta": True}

def test_sync_claims_denies_beta_for_non_allowlisted_email(monkeypatch):
    monkeypatch.setattr("app.main.get_firestore_client", lambda: _FakeFirestoreClient(["someone.else@example.com"]))
    captured = {}
    monkeypatch.setattr("app.main.set_beta_claim", lambda uid, is_beta: captured.update(uid=uid, is_beta=is_beta))
    app.dependency_overrides[verify_firebase_token] = _override_auth("uid_alice", "alice@example.com")
    try:
        res = client.post("/api/v1/auth/sync-claims")
    finally:
        app.dependency_overrides.pop(verify_firebase_token, None)
    assert res.status_code == 200
    assert res.json() == {"beta": False}
    assert captured == {"uid": "uid_alice", "is_beta": False}

def test_sync_claims_fails_closed_when_firestore_unavailable(monkeypatch):
    monkeypatch.setattr("app.main.get_firestore_client", lambda: None)
    captured = {}
    monkeypatch.setattr("app.main.set_beta_claim", lambda uid, is_beta: captured.update(uid=uid, is_beta=is_beta))
    app.dependency_overrides[verify_firebase_token] = _override_auth("uid_alice", "alice@example.com")
    try:
        res = client.post("/api/v1/auth/sync-claims")
    finally:
        app.dependency_overrides.pop(verify_firebase_token, None)
    assert res.status_code == 200
    assert res.json() == {"beta": False}
    assert captured == {"uid": "uid_alice", "is_beta": False}

def test_ml_cold_start_heuristic_mode():
    # User with only 2 days of transactions (less than 14 days threshold)
    now = datetime.utcnow()
    transactions = [
        TransactionItem(amount=350.0, category="food-snacks", note="Swiggy pizza", timestamp=now),
        TransactionItem(amount=120.0, category="food-snacks", note="Chai & Samosa", timestamp=now - timedelta(days=1)),
        TransactionItem(amount=299.0, category="mobile-recharge", note="Jio 1.5GB/day", timestamp=now - timedelta(days=2)),
    ]

    res = MLEngine.calculate_spend_predictions("cold_user_1", transactions, monthly_budget=5000.0)
    assert res.user_id == "cold_user_1"
    assert res.is_cold_start is True
    assert res.model_mode == "HEURISTIC_COLD_START"
    assert res.confidence_score <= 0.55
    assert res.last_retrained_at is None
    assert any("Early estimate" in ins for ins in res.smart_insights)
    # Step 15 — was a hardcoded `== 12`, stale since Step 9's 18-category
    # realignment (this broke silently and went unnoticed until Step 13's
    # gap audit actually ran the suite). category_breakdown has one entry
    # per CATEGORIES_METADATA key by construction (engine.py's
    # calculate_spend_predictions iterates that dict directly), so asserting
    # against its real length can't drift out of sync with the taxonomy
    # again the way a hardcoded number just did.
    assert len(res.category_breakdown) == len(CATEGORIES_METADATA)

def test_ml_trained_embedding_mode():
    # User with 18 days of transactions spanning multiple categories
    now = datetime.utcnow()
    transactions = []
    for i in range(18):
        transactions.append(
            TransactionItem(
                amount=100.0 + (i * 20),
                category="gaming-inapp" if i % 2 == 0 else "food-snacks",
                note=f"Day {i} activity",
                timestamp=now - timedelta(days=18 - i)
            )
        )

    res = MLEngine.calculate_spend_predictions("mature_user_1", transactions, monthly_budget=5000.0)
    assert res.user_id == "mature_user_1"
    assert res.is_cold_start is False
    assert res.model_mode == "TRAINED_EMBEDDING_V1"
    assert res.confidence_score >= 0.75
    assert res.last_retrained_at is not None
    assert any("Personalized ML Active" in ins for ins in res.smart_insights)

def test_ml_dot_graph_cold_start_vs_trained():
    now = datetime.utcnow()
    # Cold start graph
    cold_txs = [
        TransactionItem(amount=450.0, category="gaming-inapp", timestamp=now),
        TransactionItem(amount=300.0, category="food-snacks", timestamp=now - timedelta(days=1))
    ]
    cold_graph = MLEngine.generate_dot_graph("cold_user_2", cold_txs)
    assert cold_graph.is_cold_start is True
    assert cold_graph.model_mode == "HEURISTIC_COLD_START"
    assert "Early" in cold_graph.archetype or "Baseline" in cold_graph.archetype

    # Trained graph (>14 days)
    mature_txs = [
        TransactionItem(amount=150.0, category="gaming-inapp", timestamp=now - timedelta(days=d))
        for d in range(16)
    ]
    mature_graph = MLEngine.generate_dot_graph("mature_user_2", mature_txs)
    assert mature_graph.is_cold_start is False
    assert mature_graph.model_mode == "TRAINED_EMBEDDING_V1"
    assert mature_graph.last_retrained_at is not None


# ── Month-boundary handling (ML engine rewrite) ────────────────────────────
#
# Before this rewrite there was no "current calendar month" concept anywhere
# in calculate_spend_predictions/allocate_budget — every transaction a user
# ever logged fed straight into burn rate/predictions/category splits, so a
# prior month's spending never stopped counting. These pin `now` (all three
# methods below accept it precisely so tests don't depend on the real
# clock) to a fixed date and assert the two behaviors the rewrite is
# actually about: BILLING-PERIOD math resets every month, CUMULATIVE math
# (confidence/cold-start) never does.

def test_ml_burn_rate_excludes_prior_month_transactions():
    now = datetime(2026, 9, 10)  # 10 days into September
    transactions = [
        # A big August transaction — must NOT leak into September's burn rate.
        TransactionItem(amount=5000.0, category="food-snacks", timestamp=datetime(2026, 8, 15)),
        TransactionItem(amount=200.0, category="food-snacks", timestamp=datetime(2026, 9, 5)),
    ]
    res = MLEngine.calculate_spend_predictions(
        "boundary_user", transactions, monthly_budget=5000.0, now=now
    )
    # current_burn_rate_daily = this month's spend (₹200) / days elapsed this
    # month (10) — not (₹5000 + ₹200) / 10, which is what leaking the prior
    # month's transaction in would produce.
    assert res.current_burn_rate_daily == round(200.0 / 10, 2)
    food_breakdown = next(c for c in res.category_breakdown if c.category_id == "food-snacks")
    assert food_breakdown.historical_spend == 200.0


def test_ml_confidence_unaffected_by_month_boundary():
    # 18 real logged days straddling the August/September boundary — only
    # the last 3 (Sep 1-3) fall in "this month," but confidence/cold-start
    # must reflect the full 18-day, account-lifetime history regardless.
    now = datetime(2026, 9, 3)
    transactions = [
        TransactionItem(amount=100.0, category="food-snacks", timestamp=now - timedelta(days=17 - i))
        for i in range(18)
    ]
    res = MLEngine.calculate_spend_predictions(
        "straddle_user", transactions, monthly_budget=5000.0, now=now
    )
    assert res.is_cold_start is False
    assert res.model_mode == "TRAINED_EMBEDDING_V1"
    # Cumulative, not "how many of those days were in September" (~3).
    assert res.data_days_logged == 18
    assert res.data_points_count == 18
    assert res.confidence_score >= 0.75


def test_allocate_budget_excludes_prior_month_historical_spend():
    now = datetime(2026, 9, 10)
    transactions = [
        # Big August spend in gaming-inapp — must not still dominate
        # September's unpinned split just because it happened last month.
        TransactionItem(amount=3000.0, category="gaming-inapp", timestamp=datetime(2026, 8, 20)),
        TransactionItem(amount=100.0, category="food-snacks", timestamp=datetime(2026, 9, 5)),
    ]
    result = MLEngine.allocate_budget(transactions, monthly_budget=5000.0, pinned={}, now=now)
    allocations = {a["category_id"]: a for a in result["allocations"]}
    assert allocations["gaming-inapp"]["amount"] == 0.0
    assert allocations["food-snacks"]["amount"] > 0.0
