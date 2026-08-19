import pytest
from datetime import datetime
from app.ml.engine import MLEngine
from app.schemas import TransactionItem

def test_ml_spend_prediction():
    transactions = [
        TransactionItem(amount=350.0, category="food-delivery", note="Swiggy pizza", timestamp=datetime.utcnow()),
        TransactionItem(amount=120.0, category="food-delivery", note="Chai & Samosa", timestamp=datetime.utcnow()),
        TransactionItem(amount=299.0, category="mobile-recharge", note="Jio 1.5GB/day", timestamp=datetime.utcnow()),
        TransactionItem(amount=199.0, category="subscriptions", note="Spotify premium", timestamp=datetime.utcnow()),
        TransactionItem(amount=450.0, category="gaming", note="BGMI UC topup", timestamp=datetime.utcnow()),
        TransactionItem(amount=80.0, category="transport", note="Metro recharge", timestamp=datetime.utcnow()),
    ]

    res = MLEngine.calculate_spend_predictions("test_user_1", transactions, monthly_budget=3000.0)
    assert res.user_id == "test_user_1"
    assert res.predicted_total_spend > 0
    assert len(res.category_breakdown) == 12
    assert len(res.smart_insights) > 0

def test_ml_dot_graph_generation():
    transactions = [
        TransactionItem(amount=500.0, category="gaming", note="Valorant skin", timestamp=datetime.utcnow()),
        TransactionItem(amount=600.0, category="food-delivery", note="Zomato late night", timestamp=datetime.utcnow()),
        TransactionItem(amount=299.0, category="subscriptions", note="Netflix", timestamp=datetime.utcnow())
    ]

    graph = MLEngine.generate_dot_graph("test_user_2", transactions)
    assert graph.user_id == "test_user_2"
    assert len(graph.embedding) == 12
    assert any(node.type == "user" for node in graph.nodes)
    assert any(node.type == "category" for node in graph.nodes)
    assert any(node.type == "peer_cluster" for node in graph.nodes)
    assert len(graph.links) > 0
    assert "Gamer" in graph.archetype or "Foodie" in graph.archetype
