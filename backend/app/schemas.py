from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class TransactionItem(BaseModel):
    id: Optional[str] = None
    amount: float = Field(..., gt=0, description="Amount in INR (₹)")
    category: str = Field(..., description="Category ID (e.g. food-delivery, gaming, subscriptions)")
    subcategory: Optional[str] = None
    note: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: Optional[str] = "manual"

class SpendPredictRequest(BaseModel):
    user_id: str
    transactions: List[TransactionItem]
    monthly_budget: Optional[float] = 5000.0
    period_days: Optional[int] = 30

class CategoryForecast(BaseModel):
    category_id: str
    category_name: str
    predicted_spend: float
    confidence: float
    historical_spend: float
    trend_pct: float
    risk_level: str # 'low', 'medium', 'high'
    is_heuristic: bool = True

class SpendPredictResponse(BaseModel):
    user_id: str
    predicted_total_spend: float
    current_burn_rate_daily: float
    predicted_burn_rate_daily: float
    projected_days_until_budget_exhaustion: Optional[float]
    top_risk_categories: List[str]
    category_breakdown: List[CategoryForecast]
    smart_insights: List[str]
    is_cold_start: bool
    model_mode: str # 'HEURISTIC_COLD_START' | 'TRAINED_EMBEDDING_V1'
    data_days_logged: int
    data_points_count: int
    confidence_score: float
    last_retrained_at: Optional[datetime] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class GraphNode(BaseModel):
    id: str
    label: str
    type: str # 'user', 'category', 'peer_cluster', 'transaction_spike'
    size: float
    color: str
    category_id: Optional[str] = None
    amount: Optional[float] = 0.0
    x: Optional[float] = None
    y: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GraphLink(BaseModel):
    source: str
    target: str
    strength: float
    distance: float
    type: str = "gravity" # 'gravity', 'similarity', 'co_occurrence'

class DotGraphResponse(BaseModel):
    user_id: str
    archetype: str
    archetype_description: str
    is_cold_start: bool
    model_mode: str
    data_days_logged: int
    confidence_score: float
    embedding: List[float]
    nodes: List[GraphNode]
    links: List[GraphLink]
    peer_archetypes: List[Dict[str, Any]]
    last_retrained_at: Optional[datetime] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class LearningCurvePoint(BaseModel):
    date: str  # ISO calendar date — one of the user's own real logged days
    confidence: float
    model_mode: str  # 'HEURISTIC_COLD_START' | 'TRAINED_EMBEDDING_V1'
    is_cold_start: bool
    tx_count: int
    active_days: int

class LearningCurveResponse(BaseModel):
    user_id: str
    points: List[LearningCurvePoint]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class HealthResponse(BaseModel):
    status: str
    service: str
    port: int
    version: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# ── Phase 2: local-Ollama-backed features (see app/ml/ollama_client.py /
# app/ml/llm_features.py) ──

class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=300)
    amount: Optional[float] = None

class CategorizeResponse(BaseModel):
    category_id: Optional[str]
    category_name: Optional[str]
    confidence: float
    needs_review: bool

class InsightRequest(BaseModel):
    user_id: str

class InsightResponse(BaseModel):
    user_id: str
    insight: Optional[str]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    user_id: str
    message: str = Field(..., min_length=1, max_length=500)

class ChatResponse(BaseModel):
    user_id: str
    answer: str
    grounded_on_transaction_count: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)
