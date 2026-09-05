"""
Tests for the Phase 2 Ollama-backed features (app/ml/llm_features.py,
app/ml/ollama_client.py) and the ownership boundary main.py puts around
the insights/chat endpoints.

No live Ollama runtime is available in this environment (no network path
to any host running it), so every test here mocks the HTTP layer
(requests.post/get) rather than hitting a real model — these verify the
request/response shaping, the staged-honesty fallbacks, and that every
number in a generated sentence's context comes from real computed data,
NOT that a real qwen2.5 model produces good prose. That part still needs
verification against the real Ollama runtime on draftsmanbrain.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest
import requests

from app.ml import llm_features, ollama_client
from app.main import _require_self_or_superadmin
from fastapi import HTTPException


def _mock_post_response(json_body, status_ok=True):
    resp = MagicMock()
    resp.json.return_value = json_body
    if status_ok:
        resp.raise_for_status.return_value = None
    else:
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError("boom")
    return resp


# ---- categorize_transaction ----

def test_categorize_confident_result_is_applied():
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        mock_post.return_value = _mock_post_response(
            {"response": '{"category_id": "food-snacks", "confidence": 0.92}'}
        )
        result = asyncio.run(llm_features.categorize_transaction("Swiggy order, 2 burgers"))

    assert result["category_id"] == "food-snacks"
    assert result["category_name"] == "Food, drinks & snacks"
    assert result["needs_review"] is False
    assert result["confidence"] == pytest.approx(0.92)


def test_categorize_low_confidence_flags_needs_review():
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        mock_post.return_value = _mock_post_response(
            {"response": '{"category_id": "miscellaneous", "confidence": 0.2}'}
        )
        result = asyncio.run(llm_features.categorize_transaction("paid someone 50"))

    assert result["category_id"] is None
    assert result["needs_review"] is True


def test_categorize_unparseable_output_flags_needs_review_not_a_guess():
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        mock_post.return_value = _mock_post_response({"response": "not json at all"})
        result = asyncio.run(llm_features.categorize_transaction("something vague"))

    assert result["category_id"] is None
    assert result["needs_review"] is True


def test_categorize_rejects_a_category_id_outside_the_real_taxonomy():
    # A model hallucinating a category id that isn't in CATEGORIES_METADATA
    # must never be trusted verbatim.
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        mock_post.return_value = _mock_post_response(
            {"response": '{"category_id": "made-up-category", "confidence": 0.99}'}
        )
        result = asyncio.run(llm_features.categorize_transaction("something"))

    assert result["category_id"] is None
    assert result["needs_review"] is True


def test_categorize_when_ollama_unreachable_flags_needs_review_not_crash():
    with patch("app.ml.ollama_client.requests.post", side_effect=requests.exceptions.ConnectionError("down")):
        result = asyncio.run(llm_features.categorize_transaction("Swiggy order"))

    assert result["category_id"] is None
    assert result["needs_review"] is True
    assert result.get("error") == "model_unavailable"


def test_categorize_empty_description_never_calls_model():
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        result = asyncio.run(llm_features.categorize_transaction("   "))
    mock_post.assert_not_called()
    assert result["needs_review"] is True


# ---- build_insight / answer_chat: fake Firestore ----

class _FakeDoc:
    def __init__(self, data):
        self._data = data

    def to_dict(self):
        return self._data


class _FakeTxCollection:
    def __init__(self, docs):
        self._docs = docs

    def stream(self):
        return iter(self._docs)


class _FakeUserDoc:
    def __init__(self, docs):
        self._docs = docs

    def collection(self, name):
        assert name == "transactions"
        return _FakeTxCollection(self._docs)


class _FakeUsersCollection:
    def __init__(self, docs_by_uid):
        self._docs_by_uid = docs_by_uid

    def document(self, uid):
        return _FakeUserDoc(self._docs_by_uid.get(uid, []))


class _FakeDb:
    def __init__(self, docs_by_uid):
        self._docs_by_uid = docs_by_uid

    def collection(self, name):
        assert name == "users"
        return _FakeUsersCollection(self._docs_by_uid)


def _iso(dt):
    return dt.isoformat()


def test_build_insight_computes_real_numbers_and_flags_meaningful_mover():
    now = datetime.now(timezone.utc)
    docs = []
    # This week: 3 x ₹500 = ₹1500 on food-snacks.
    for d in range(3):
        docs.append(_FakeDoc({"amount": 500, "category": "food-snacks", "timestamp": _iso(now - timedelta(days=d))}))
    # Prior 3 weeks: ₹300/week average on food-snacks (900 total over days 8-28).
    for d in range(8, 29, 4):
        docs.append(_FakeDoc({"amount": 180, "category": "food-snacks", "timestamp": _iso(now - timedelta(days=d))}))

    db = _FakeDb({"user1": docs})

    with patch("app.ml.ollama_client.requests.post") as mock_post:
        mock_post.return_value = _mock_post_response({"response": "You spent more on food this week."})
        result = asyncio.run(llm_features.build_insight(db, "user1"))

    assert result["insight"] is not None
    assert result["computed"]["category_id"] == "food-snacks"
    assert result["computed"]["this_week_inr"] == 1500


def test_build_insight_stays_quiet_with_no_transactions():
    db = _FakeDb({"user1": []})
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        result = asyncio.run(llm_features.build_insight(db, "user1"))
    mock_post.assert_not_called()
    assert result["insight"] is None


def test_build_insight_falls_back_to_templated_sentence_when_ollama_down():
    now = datetime.now(timezone.utc)
    docs = [_FakeDoc({"amount": 1000, "category": "food-snacks", "timestamp": _iso(now)})]
    for d in range(8, 29, 4):
        docs.append(_FakeDoc({"amount": 50, "category": "food-snacks", "timestamp": _iso(now - timedelta(days=d))}))
    db = _FakeDb({"user1": docs})

    with patch("app.ml.ollama_client.requests.post", side_effect=requests.exceptions.ConnectionError("down")):
        result = asyncio.run(llm_features.build_insight(db, "user1"))

    # Still a real, numbers-grounded sentence — not silently empty just
    # because the model itself was unreachable.
    assert result["insight"] is not None
    assert str(result["computed"]["this_week_inr"]) in result["insight"]


def test_answer_chat_grounds_on_real_totals_and_reports_count():
    now = datetime.now(timezone.utc)
    docs = [
        _FakeDoc({"amount": 200, "category": "food-snacks", "timestamp": _iso(now)}),
        _FakeDoc({"amount": 300, "category": "gaming-inapp", "timestamp": _iso(now - timedelta(days=1))}),
    ]
    db = _FakeDb({"user1": docs})

    with patch("app.ml.ollama_client.requests.post") as mock_post:
        mock_post.return_value = _mock_post_response({"message": {"content": "You've spent ₹500 total."}})
        result = asyncio.run(llm_features.answer_chat(db, "user1", "how much have I spent?"))

    assert result["grounded_on_transaction_count"] == 2
    # Confirm the context actually sent to the model carries the real total,
    # not a value the model could have invented.
    sent_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args[1].get("json")
    system_content = sent_payload["messages"][0]["content"]
    assert "₹500" in system_content


def test_answer_chat_with_no_history_never_calls_model():
    db = _FakeDb({"user1": []})
    with patch("app.ml.ollama_client.requests.post") as mock_post:
        result = asyncio.run(llm_features.answer_chat(db, "user1", "how much have I spent?"))
    mock_post.assert_not_called()
    assert result["grounded_on_transaction_count"] == 0


# ---- ownership boundary (main.py) ----

def test_ownership_check_allows_self():
    _require_self_or_superadmin({"uid": "user1"}, "user1")  # must not raise


def test_ownership_check_allows_superadmin_for_any_uid():
    _require_self_or_superadmin({"uid": "admin_uid", "role": "superadmin"}, "someone_else")  # must not raise


def test_ownership_check_rejects_reading_someone_elses_data():
    with pytest.raises(HTTPException) as exc_info:
        _require_self_or_superadmin({"uid": "user1"}, "user2")
    assert exc_info.value.status_code == 403
