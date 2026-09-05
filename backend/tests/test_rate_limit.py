"""
Brief 4 (2026-09-05): tests for app/rate_limit.py's two dependencies and
app/ml/ollama_client.py's concurrency guard. Each test resets the relevant
module-level state first (these are in-process counters/semaphores by
design — see rate_limit.py's own module docstring for why — so tests can't
rely on process isolation between them the way a fresh Firestore emulator
instance would give)."""
import asyncio
import time

import pytest
from fastapi import HTTPException

from app import rate_limit
from app.ml import ollama_client


def _reset_rate_limit_state():
    rate_limit._general_buckets.clear()
    rate_limit._llm_buckets.clear()
    rate_limit._llm_cap_cache["value"] = float(rate_limit.LLM_DAILY_CAP_DEFAULT)
    rate_limit._llm_cap_cache["fetched_at"] = 0.0


@pytest.fixture(autouse=True)
def reset_state():
    _reset_rate_limit_state()
    yield
    _reset_rate_limit_state()


# ---- enforce_general_rate_limit ----

def test_general_limit_allows_up_to_the_cap():
    user = {"uid": "user1"}
    for _ in range(rate_limit.GENERAL_LIMIT_PER_MINUTE):
        asyncio.run(rate_limit.enforce_general_rate_limit(user))  # must not raise


def test_general_limit_blocks_the_next_call_over_cap():
    user = {"uid": "user1"}
    for _ in range(rate_limit.GENERAL_LIMIT_PER_MINUTE):
        asyncio.run(rate_limit.enforce_general_rate_limit(user))
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(rate_limit.enforce_general_rate_limit(user))
    assert exc_info.value.status_code == 429
    # A real human sentence, not a bare code — see lib/api.ts's
    # parseErrorDetail, which is what actually renders this in the UI.
    assert "too fast" in exc_info.value.detail


def test_general_limit_is_independent_per_uid():
    for _ in range(rate_limit.GENERAL_LIMIT_PER_MINUTE):
        asyncio.run(rate_limit.enforce_general_rate_limit({"uid": "user1"}))
    # A different uid at the same moment must not be affected by user1's usage.
    asyncio.run(rate_limit.enforce_general_rate_limit({"uid": "user2"}))  # must not raise


def test_general_limit_exempts_superadmin():
    admin = {"uid": "admin1", "role": "superadmin"}
    for _ in range(rate_limit.GENERAL_LIMIT_PER_MINUTE + 10):
        asyncio.run(rate_limit.enforce_general_rate_limit(admin))  # must never raise


# ---- enforce_llm_daily_limit ----

def test_llm_daily_limit_allows_up_to_the_default_cap(monkeypatch):
    # Force the cap lookup to skip Firestore and use the default.
    monkeypatch.setattr(rate_limit, "get_firestore_client", lambda: None)
    user = {"uid": "user1"}
    for _ in range(rate_limit.LLM_DAILY_CAP_DEFAULT):
        asyncio.run(rate_limit.enforce_llm_daily_limit(user))  # must not raise


def test_llm_daily_limit_blocks_the_next_message_over_cap(monkeypatch):
    monkeypatch.setattr(rate_limit, "get_firestore_client", lambda: None)
    user = {"uid": "user1"}
    for _ in range(rate_limit.LLM_DAILY_CAP_DEFAULT):
        asyncio.run(rate_limit.enforce_llm_daily_limit(user))
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(rate_limit.enforce_llm_daily_limit(user))
    assert exc_info.value.status_code == 429
    assert str(rate_limit.LLM_DAILY_CAP_DEFAULT) in exc_info.value.detail
    assert "resets tomorrow" in exc_info.value.detail


def test_llm_daily_limit_exempts_superadmin(monkeypatch):
    monkeypatch.setattr(rate_limit, "get_firestore_client", lambda: None)
    admin = {"uid": "admin1", "role": "superadmin"}
    for _ in range(rate_limit.LLM_DAILY_CAP_DEFAULT + 5):
        asyncio.run(rate_limit.enforce_llm_daily_limit(admin))  # must never raise


def test_llm_daily_cap_is_configurable_via_launch_config(monkeypatch):
    """Brief 4's explicit ask: the cap must be changeable via
    admin/launchConfig without a redeploy."""
    class _FakeSnap:
        exists = True
        def to_dict(self):
            return {"llmDailyMessageCap": 3}

    class _FakeDocRef:
        def get(self):
            return _FakeSnap()

    class _FakeCollection:
        def document(self, _id):
            return _FakeDocRef()

    class _FakeDb:
        def collection(self, _name):
            return _FakeCollection()

    monkeypatch.setattr(rate_limit, "get_firestore_client", lambda: _FakeDb())
    user = {"uid": "user1"}
    for _ in range(3):
        asyncio.run(rate_limit.enforce_llm_daily_limit(user))
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(rate_limit.enforce_llm_daily_limit(user))
    assert "3 messages" in exc_info.value.detail


# ---- ollama_client concurrency guard ----

def test_generate_async_runs_normally_when_not_contended(monkeypatch):
    monkeypatch.setattr(ollama_client, "generate", lambda **kwargs: "ok")
    result = asyncio.run(ollama_client.generate_async(model="m", prompt="p"))
    assert result == "ok"


def test_generate_async_fails_fast_as_busy_when_the_single_slot_is_held(monkeypatch):
    """The core of Brief 4's second layer: a second caller must not queue
    behind the first — it should fail with OllamaBusyError within roughly
    OLLAMA_ACQUIRE_TIMEOUT_SECONDS, not hang until the first call finishes."""
    monkeypatch.setattr(ollama_client, "OLLAMA_MAX_CONCURRENT", 1)
    monkeypatch.setattr(ollama_client, "OLLAMA_ACQUIRE_TIMEOUT_SECONDS", 0.3)
    monkeypatch.setattr(ollama_client, "_semaphore", asyncio.Semaphore(1))

    def _slow_generate(**kwargs):
        time.sleep(1.5)  # much longer than the 0.3s acquire timeout below
        return "slow result"

    monkeypatch.setattr(ollama_client, "generate", _slow_generate)

    async def _run_both():
        first = asyncio.create_task(ollama_client.generate_async(model="m", prompt="p"))
        await asyncio.sleep(0.05)  # let `first` actually acquire the slot

        busy_started = time.monotonic()
        with pytest.raises(ollama_client.OllamaBusyError):
            await ollama_client.generate_async(model="m", prompt="p")
        busy_elapsed = time.monotonic() - busy_started
        # The busy rejection must arrive fast (~0.3s), not after waiting for
        # the 1.5s slow call to finish — the actual "fail fast rather than
        # queue" behavior the brief asks for.
        assert busy_elapsed < 1.0

        # The first call should still complete normally once its own work finishes.
        assert await first == "slow result"

    asyncio.run(_run_both())
