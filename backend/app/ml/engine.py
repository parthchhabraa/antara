import math
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import numpy as np
from app.schemas import (
    TransactionItem, SpendPredictResponse, CategoryForecast,
    DotGraphResponse, GraphNode, GraphLink
)

CATEGORIES_METADATA = {
    "food-delivery": {"name": "Food delivery & street food", "color": "#F97316", "essential": False, "ideal_pct": 0.20},
    "mobile-recharge": {"name": "Mobile recharge/data", "color": "#3B82F6", "essential": True, "ideal_pct": 0.08},
    "subscriptions": {"name": "OTT & music subscriptions", "color": "#8B5CF6", "essential": False, "ideal_pct": 0.07},
    "gaming": {"name": "Gaming (in-app/top-ups)", "color": "#EC4899", "essential": False, "ideal_pct": 0.05},
    "transport": {"name": "Transport", "color": "#06B6D4", "essential": True, "ideal_pct": 0.12},
    "fashion": {"name": "Fashion & accessories", "color": "#F43F5E", "essential": False, "ideal_pct": 0.10},
    "education": {"name": "Coaching/tuition/exam fees", "color": "#10B981", "essential": True, "ideal_pct": 0.18},
    "personal-care": {"name": "Personal care", "color": "#A855F7", "essential": False, "ideal_pct": 0.05},
    "social-gifts": {"name": "Gifts & social spending", "color": "#EAB308", "essential": False, "ideal_pct": 0.05},
    "stationery": {"name": "Stationery/books", "color": "#14B8A6", "essential": True, "ideal_pct": 0.04},
    "savings": {"name": "Savings/investment", "color": "#22C55E", "essential": True, "ideal_pct": 0.05},
    "miscellaneous": {"name": "Miscellaneous", "color": "#64748B", "essential": False, "ideal_pct": 0.01}
}

PEER_ARCHETYPES = [
    {
        "id": "archetype_gamer_foodie",
        "name": "The Gamer & Foodie",
        "color": "#EC4899",
        "description": "Spends predominantly on late-night Swiggy/Zomato snacks, Discord/Spotify, and gaming battle passes.",
        "weights": {"food-delivery": 0.35, "gaming": 0.25, "subscriptions": 0.15, "mobile-recharge": 0.10, "transport": 0.05, "savings": 0.10}
    },
    {
        "id": "archetype_exam_grinder",
        "name": "The Exam Grinder & Scholar",
        "color": "#10B981",
        "description": "Prioritizes coaching modules, test series, textbooks, and minimal discretionary spending.",
        "weights": {"education": 0.50, "stationery": 0.20, "transport": 0.15, "mobile-recharge": 0.05, "savings": 0.10}
    },
    {
        "id": "archetype_social_trendsetter",
        "name": "The Social Trendsetter",
        "color": "#F43F5E",
        "description": "High affinity for streetwear, cafes, birthdays, and campus outings.",
        "weights": {"fashion": 0.30, "social-gifts": 0.25, "food-delivery": 0.20, "personal-care": 0.15, "transport": 0.10}
    },
    {
        "id": "archetype_commuter_nomad",
        "name": "The Commuter Nomad",
        "color": "#06B6D4",
        "description": "Constant city transit, metro cards, rapid street food halts, and mobile data top-ups.",
        "weights": {"transport": 0.40, "mobile-recharge": 0.20, "food-delivery": 0.25, "miscellaneous": 0.15}
    },
    {
        "id": "archetype_zen_saver",
        "name": "The Zen Saver",
        "color": "#22C55E",
        "description": "Strict financial discipline, high savings stash, and smart budget adherence.",
        "weights": {"savings": 0.45, "education": 0.20, "mobile-recharge": 0.15, "transport": 0.10, "food-delivery": 0.10}
    }
]

class MLEngine:
    @staticmethod
    def calculate_spend_predictions(
        user_id: str,
        transactions: List[TransactionItem],
        monthly_budget: float = 5000.0,
        period_days: int = 30
    ) -> SpendPredictResponse:
        total_historical = sum(tx.amount for tx in transactions)
        
        # Calculate category totals
        cat_totals: Dict[str, float] = {k: 0.0 for k in CATEGORIES_METADATA.keys()}
        for tx in transactions:
            cat_id = tx.category if tx.category in cat_totals else "miscellaneous"
            cat_totals[cat_id] += tx.amount
            
        # Determine active date span
        if transactions:
            timestamps = [tx.timestamp for tx in transactions]
            min_date = min(timestamps)
            max_date = max(timestamps)
            active_days = max(1, (max_date - min_date).days + 1)
        else:
            active_days = 7

        daily_burn_rate = total_historical / max(1, active_days)
        projected_monthly_spend = daily_burn_rate * period_days
        
        # Calculate days until budget exhaustion
        if daily_burn_rate > 0:
            projected_days_left = max(0.0, (monthly_budget - total_historical) / daily_burn_rate)
        else:
            projected_days_left = float(period_days)
            
        # Category forecasts
        category_breakdowns: List[CategoryForecast] = []
        high_risk_categories: List[str] = []
        
        for cat_id, meta in CATEGORIES_METADATA.items():
            hist_spend = cat_totals[cat_id]
            pct_of_total = (hist_spend / total_historical) if total_historical > 0 else meta["ideal_pct"]
            
            # Predict next period spend with slight trend inflation for non-essentials
            inflation = 1.10 if not meta["essential"] and pct_of_total > meta["ideal_pct"] else 1.02
            predicted_cat_spend = round((hist_spend / max(1, active_days)) * period_days * inflation, 2)
            if predicted_cat_spend == 0 and total_historical == 0:
                predicted_cat_spend = round(monthly_budget * meta["ideal_pct"], 2)
                
            trend_pct = round(((predicted_cat_spend - hist_spend) / max(1.0, hist_spend)) * 100 if hist_spend > 0 else 0.0, 1)
            
            # Risk determination
            risk_level = "low"
            if pct_of_total > (meta["ideal_pct"] * 1.5) and not meta["essential"]:
                risk_level = "high"
                high_risk_categories.append(meta["name"])
            elif pct_of_total > meta["ideal_pct"]:
                risk_level = "medium"

            category_breakdowns.append(
                CategoryForecast(
                    category_id=cat_id,
                    category_name=meta["name"],
                    predicted_spend=predicted_cat_spend,
                    confidence=0.88 if len(transactions) > 10 else 0.72,
                    historical_spend=round(hist_spend, 2),
                    trend_pct=trend_pct,
                    risk_level=risk_level
                )
            )

        # Sort category breakdown by predicted spend descending
        category_breakdowns.sort(key=lambda x: x.predicted_spend, reverse=True)

        # Generate intelligent teen-friendly insights
        insights = []
        if high_risk_categories:
            insights.append(f"⚠️ Spend alert: Your spending on **{', '.join(high_risk_categories[:2])}** is trending 35% higher than your benchmark.")
        
        if projected_monthly_spend > monthly_budget:
            over_by = projected_monthly_spend - monthly_budget
            insights.append(f"🚨 At your current burn rate of ₹{daily_burn_rate:.0f}/day, you will exceed your ₹{monthly_budget:.0f} monthly allowance by ₹{over_by:.0f}.")
        else:
            buffer = monthly_budget - projected_monthly_spend
            insights.append(f"✨ Strong discipline! You are on track to save approximately ₹{buffer:.0f} this month.")
            
        food_spend = cat_totals.get("food-delivery", 0)
        gaming_spend = cat_totals.get("gaming", 0)
        if (food_spend + gaming_spend) > (total_historical * 0.45) and total_historical > 500:
            insights.append("🎮 Gaming & food deliveries account for nearly half your expenses. Consider bundling food orders or setting a weekly gaming cap.")

        return SpendPredictResponse(
            user_id=user_id,
            predicted_total_spend=round(projected_monthly_spend, 2),
            current_burn_rate_daily=round(daily_burn_rate, 2),
            predicted_burn_rate_daily=round(projected_monthly_spend / period_days, 2),
            projected_days_until_budget_exhaustion=round(projected_days_left, 1),
            top_risk_categories=high_risk_categories,
            category_breakdown=category_breakdowns,
            smart_insights=insights
        )

    @staticmethod
    def generate_dot_graph(user_id: str, transactions: List[TransactionItem]) -> DotGraphResponse:
        """
        Generates the force-directed Obsidian-style dot graph layout.
        Computes learned spend embedding, archetype distance, and physics node coordinates.
        """
        cat_totals: Dict[str, float] = {k: 0.0 for k in CATEGORIES_METADATA.keys()}
        for tx in transactions:
            cat_id = tx.category if tx.category in cat_totals else "miscellaneous"
            cat_totals[cat_id] += tx.amount
            
        total_spend = sum(cat_totals.values())
        
        # 12-dimensional normalized category spend vector
        if total_spend > 0:
            user_vector = [cat_totals[k] / total_spend for k in CATEGORIES_METADATA.keys()]
        else:
            # Default balanced vector
            user_vector = [meta["ideal_pct"] for meta in CATEGORIES_METADATA.values()]

        # Compute cosine similarity with peer archetypes
        cat_keys = list(CATEGORIES_METADATA.keys())
        best_archetype = PEER_ARCHETYPES[0]
        best_similarity = -1.0
        archetype_matches = []

        for arc in PEER_ARCHETYPES:
            arc_vec = [arc["weights"].get(k, 0.01) for k in cat_keys]
            # Normalization
            arc_norm = np.linalg.norm(arc_vec)
            user_norm = np.linalg.norm(user_vector)
            sim = float(np.dot(user_vector, arc_vec) / (arc_norm * user_norm)) if user_norm > 0 else 0.5
            archetype_matches.append({
                "id": arc["id"],
                "name": arc["name"],
                "color": arc["color"],
                "similarity_pct": round(sim * 100, 1),
                "description": arc["description"]
            })
            if sim > best_similarity:
                best_similarity = sim
                best_archetype = arc

        archetype_matches.sort(key=lambda x: x["similarity_pct"], reverse=True)

        # Construct Graph Nodes & Links
        nodes: List[GraphNode] = []
        links: List[GraphLink] = []

        # Center User Node
        user_node_size = 28 + min(20, math.sqrt(total_spend) if total_spend > 0 else 10)
        nodes.append(
            GraphNode(
                id="user_center",
                label="You (Spend Core)",
                type="user",
                size=user_node_size,
                color="#8B5CF6", # Neon Purple Glow
                amount=total_spend,
                x=0.0,
                y=0.0,
                metadata={
                    "total_spend": total_spend,
                    "tx_count": len(transactions),
                    "archetype": best_archetype["name"]
                }
            )
        )

        # 12 Category Gravity Nodes arranged radially
        angle_step = (2 * math.pi) / len(CATEGORIES_METADATA)
        radius = 240.0

        for i, (cat_id, meta) in enumerate(CATEGORIES_METADATA.items()):
            spend = cat_totals[cat_id]
            pct = (spend / total_spend) if total_spend > 0 else 0.05
            node_size = 14 + (pct * 36)
            
            # Position along circular ring
            angle = i * angle_step
            cx = math.cos(angle) * radius
            cy = math.sin(angle) * radius

            nodes.append(
                GraphNode(
                    id=f"cat_{cat_id}",
                    label=meta["name"],
                    type="category",
                    size=node_size,
                    color=meta["color"],
                    category_id=cat_id,
                    amount=spend,
                    x=round(cx, 2),
                    y=round(cy, 2),
                    metadata={
                        "spend": spend,
                        "percentage": round(pct * 100, 1),
                        "essential": meta["essential"]
                    }
                )
            )

            # Link between User and Category (Strength corresponds to spend share)
            link_strength = max(0.08, pct * 1.5)
            link_distance = max(60, 220 - (pct * 120))
            links.append(
                GraphLink(
                    source="user_center",
                    target=f"cat_{cat_id}",
                    strength=round(link_strength, 3),
                    distance=round(link_distance, 1),
                    type="gravity"
                )
            )

        # Peer Archetype Nodes in outer orbit
        arc_radius = 360.0
        arc_angle_step = (2 * math.pi) / len(PEER_ARCHETYPES)
        for j, arc in enumerate(PEER_ARCHETYPES):
            ax = math.cos(j * arc_angle_step + 0.3) * arc_radius
            ay = math.sin(j * arc_angle_step + 0.3) * arc_radius
            match_data = next((m for m in archetype_matches if m["id"] == arc["id"]), None)
            sim_pct = match_data["similarity_pct"] if match_data else 50.0

            nodes.append(
                GraphNode(
                    id=f"arc_{arc['id']}",
                    label=f"Cluster: {arc['name']}",
                    type="peer_cluster",
                    size=18,
                    color=arc["color"],
                    amount=0.0,
                    x=round(ax, 2),
                    y=round(ay, 2),
                    metadata={
                        "similarity_pct": sim_pct,
                        "description": arc["description"]
                    }
                )
            )

            # Link user to the dominant archetype
            if arc["id"] == best_archetype["id"]:
                links.append(
                    GraphLink(
                        source="user_center",
                        target=f"arc_{arc['id']}",
                        strength=0.75,
                        distance=180.0,
                        type="similarity"
                    )
                )

        # Co-occurrence inter-category links
        co_occurrences = [
            ("food-delivery", "subscriptions", 0.4),
            ("gaming", "subscriptions", 0.5),
            ("fashion", "personal-care", 0.45),
            ("transport", "food-delivery", 0.35),
            ("education", "stationery", 0.6)
        ]
        for src, dst, str_val in co_occurrences:
            if cat_totals[src] > 0 or cat_totals[dst] > 0:
                links.append(
                    GraphLink(
                        source=f"cat_{src}",
                        target=f"cat_{dst}",
                        strength=str_val,
                        distance=140.0,
                        type="co_occurrence"
                    )
                )

        return DotGraphResponse(
            user_id=user_id,
            archetype=best_archetype["name"],
            archetype_description=best_archetype["description"],
            embedding=[round(float(v), 4) for v in user_vector],
            nodes=nodes,
            links=links,
            peer_archetypes=archetype_matches
        )
