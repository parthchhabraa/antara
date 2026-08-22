import pytest
from datetime import datetime, timedelta
from app.ml.engine import MLEngine, CATEGORIES_METADATA
from app.schemas import TransactionItem

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
