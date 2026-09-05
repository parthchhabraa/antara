"""
Thin client for a locally-hosted Ollama runtime (http://localhost:11434 by
default) — the ONLY LLM path this backend is allowed to call. There is
deliberately no code anywhere in this module (or its callers in main.py)
that can reach an external LLM API: this service handles real teen
financial data, and Ollama running on the same box as this FastAPI process
(port 8001, on `draftsmanbrain`) is what keeps that data from ever leaving
the machine.

Two models, picked for this box's GTX 1660 Super (6GB VRAM):
  - qwen2.5:1.5b               — transaction-description categorization.
    Small enough to answer near-instantly and to sit alongside the 7b
    model without exhausting VRAM if Ollama happens to have both loaded
    briefly during a handoff.
  - qwen2.5:7b-instruct-q4_K_M — insights/nudges and the chat assistant.
    ~4.7GB quantized, leaves headroom on a 6GB card. Deliberately not an
    8b/9b-class model — too tight on this card once anything else (the
    1.5b model, a stray browser tab’s WebGL context, etc.) is also using
    VRAM.

Neither model is pinned resident: no call here sets a long/`-1` (infinite)
`keep_alive`, so Ollama's own default idle-unload (5 minutes) does the job
of not trying to hold both models in VRAM at once. See OLLAMA_KEEP_ALIVE
below if that default is ever overridden at the Ollama-server level — this
client passes it through rather than hardcoding a duration.
"""
import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger("antara.ollama")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Passed through as each request's `keep_alive` verbatim (Ollama accepts a
# Go duration string, e.g. "5m", or a negative number to pin forever).
# Left unset by default so Ollama's own default idle-unload behavior
# applies — see module docstring. Only set OLLAMA_KEEP_ALIVE in the
# environment if you've deliberately decided to override that.
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE")

CATEGORIZE_MODEL = os.getenv("OLLAMA_CATEGORIZE_MODEL", "qwen2.5:1.5b")
CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b-instruct-q4_K_M")

# Generous but bounded — a hung model load (first call after an idle unload)
# shouldn't hang the FastAPI worker indefinitely, but 1.5b/7b-q4 on a 1660
# Super genuinely can take a few seconds to cold-load from disk into VRAM.
REQUEST_TIMEOUT_SECONDS = 30


class OllamaError(Exception):
    """Raised on any failure to reach Ollama or get a usable response from
    it. Callers are expected to catch this and degrade honestly (staged
    honesty applies to model *availability* too — a failed local call
    should never silently fall back to inventing an answer)."""


class OllamaBusyError(OllamaError):
    """Raised by generate_async/chat_async specifically when the
    concurrency limit below was already held and a new call couldn't get
    in within OLLAMA_ACQUIRE_TIMEOUT_SECONDS. A subclass of OllamaError so
    every existing `except OllamaError` call site already degrades
    gracefully for this case too; callers that want to distinguish "busy
    right now" from "genuinely unreachable" (for logging/telemetry, not
    for what the user sees — both should read as a calm, honest message)
    can catch this first."""


# Brief 4 (2026-09-05): real concurrency against this box's single GTX 1660
# Super is about 1 regardless — generate()/chat() below are synchronous
# `requests` calls, and calling a blocking function directly from an async
# FastAPI route handler blocks the *entire* event loop for the call's full
# duration, not just the LLM work. That means today, a single slow chat
# generation doesn't just serialize other LLM calls — it freezes every
# other route on this service, including /health, for however long the
# model takes. generate_async/chat_async fix this two ways: the semaphore
# acquire is awaited (so a second caller waiting for a slot doesn't block
# the loop while waiting), and the actual blocking call runs in a thread
# via asyncio.to_thread (so the loop stays responsive to other requests
# even while one generation is in flight). Callers that can't acquire a
# slot within OLLAMA_ACQUIRE_TIMEOUT_SECONDS fail fast with OllamaBusyError
# rather than queueing indefinitely — an unbounded queue behind a 6GB card
# is how a slow evening turns into every request timing out at once.
OLLAMA_MAX_CONCURRENT = int(os.getenv("OLLAMA_MAX_CONCURRENT", "1"))
OLLAMA_ACQUIRE_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_ACQUIRE_TIMEOUT_SECONDS", "2"))

_semaphore = asyncio.Semaphore(OLLAMA_MAX_CONCURRENT)


async def _run_guarded(fn, *args, **kwargs):
    try:
        await asyncio.wait_for(_semaphore.acquire(), timeout=OLLAMA_ACQUIRE_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.warning(
            "Ollama busy: no slot free within %ss (max_concurrent=%s)",
            OLLAMA_ACQUIRE_TIMEOUT_SECONDS, OLLAMA_MAX_CONCURRENT,
        )
        raise OllamaBusyError(
            f"No Ollama slot free within {OLLAMA_ACQUIRE_TIMEOUT_SECONDS}s "
            f"(max concurrent generations: {OLLAMA_MAX_CONCURRENT})"
        )
    try:
        return await asyncio.to_thread(fn, *args, **kwargs)
    finally:
        _semaphore.release()


def _post(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{OLLAMA_BASE_URL}{path}"
    started = time.monotonic()
    model = payload.get("model", "?")
    try:
        resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        latency_ms = round((time.monotonic() - started) * 1000, 1)
        resp.raise_for_status()
        logger.info("ollama %s model=%s latency_ms=%s status=ok", path, model, latency_ms)
        return resp.json()
    except requests.exceptions.RequestException as e:
        latency_ms = round((time.monotonic() - started) * 1000, 1)
        logger.error("ollama %s model=%s latency_ms=%s status=error err=%s", path, model, latency_ms, e)
        raise OllamaError(f"Ollama request to {path} failed: {e}") from e


def generate(
    model: str,
    prompt: str,
    system: Optional[str] = None,
    format_json: bool = False,
    temperature: float = 0.2,
) -> str:
    """One-shot completion via /api/generate (non-streaming). Returns the
    raw response text — callers that asked for JSON (`format_json=True`)
    still get a string back and are responsible for parsing it themselves,
    since a model can return syntactically-broken JSON and that failure
    needs to be handled per-caller (categorize vs. insights react
    differently to a bad parse)."""
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system:
        payload["system"] = system
    if format_json:
        payload["format"] = "json"
    if OLLAMA_KEEP_ALIVE:
        payload["keep_alive"] = OLLAMA_KEEP_ALIVE

    data = _post("/api/generate", payload)
    return data.get("response", "")


def chat(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.4,
) -> str:
    """Multi-turn completion via /api/chat (non-streaming). `messages` is
    the standard [{role, content}, ...] list — callers build the system
    message themselves so the exact grounding data is visible at the call
    site rather than hidden in this client."""
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if OLLAMA_KEEP_ALIVE:
        payload["keep_alive"] = OLLAMA_KEEP_ALIVE

    data = _post("/api/chat", payload)
    return (data.get("message") or {}).get("content", "")


async def generate_async(*args, **kwargs) -> str:
    """Concurrency-guarded, non-blocking wrapper around generate() — see
    the module-level comment above _run_guarded for why this exists.
    Callers (llm_features.py) should always await this rather than calling
    generate() directly from an async route handler."""
    return await _run_guarded(generate, *args, **kwargs)


async def chat_async(*args, **kwargs) -> str:
    """Concurrency-guarded, non-blocking wrapper around chat() — see
    generate_async above."""
    return await _run_guarded(chat, *args, **kwargs)


def health() -> Tuple[bool, Optional[str]]:
    """Cheap reachability check (`GET /api/tags`) — used by the admin
    status endpoint to report whether Ollama is actually reachable, rather
    than only finding out the first time a real categorize/insights/chat
    call fails."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        return True, None
    except requests.exceptions.RequestException as e:
        return False, str(e)
