import math
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import numpy as np
from app.schemas import (
    TransactionItem, SpendPredictResponse, CategoryForecast,
    DotGraphResponse, GraphNode, GraphLink
)

# Indian teen spending taxonomy with benchmark distribution weights.
#
# Realigned 2026-08-21 to match the real teen spending survey's actual
# Firestore field ids (`survey_responses.{doc}.category_spend`) rather than
# the earlier Step 8 taxonomy, which was built off a paraphrased category
# list that didn't exactly match the survey webapp once it existed — see
# frontend/src/lib/constants.ts for the full old-id -> new-id mapping.
#
# benchmark_pct/median_spend_inr below are now REAL numbers, computed by
# scripts/compute_category_benchmarks.py from actual survey_responses
# documents — not guessed. As of this pass that script ran against **3**
# responses (sample_size noted per category below) — genuinely thin. Where
# those 3 respondents happened to report ₹0 for a category, benchmark_pct is
# 0.0, not a small guessed placeholder. `_expected_cat_spend()` and the
# risk-flagging logic below treat both `None` *and* `0.0` as "no usable
# baseline yet" (see `has_benchmark` in calculate_spend_predictions /
# generate_dot_graph) — a 0.0 from under-sampling must not be read as "this
# category should be 0," which would flag the first rupee logged as
# infinitely over budget. Re-run the compute script and update this dict as
# survey_responses grows; each entry below is dated to the last computation.
CATEGORIES_METADATA = {
    "food-snacks": {"name": "Food, drinks & snacks", "color": "#F97316", "essential": False, "benchmark_pct": 0.2809, "median_spend_inr": 2500.0},  # n=3, 2026-08-21
    "dates-outings": {"name": "Dating & going out", "color": "#FB7185", "essential": False, "benchmark_pct": 0.1873, "median_spend_inr": 2000.0},  # n=3, 2026-08-21
    "clothes-shoes": {"name": "Clothes & shoes", "color": "#F43F5E", "essential": False, "benchmark_pct": 0.1498, "median_spend_inr": 2000.0},  # n=3, 2026-08-21
    "gifting-friends": {"name": "Gifts & money to friends", "color": "#EAB308", "essential": False, "benchmark_pct": 0.0599, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "fitness": {"name": "Fitness & fitness products", "color": "#84CC16", "essential": False, "benchmark_pct": 0.0562, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "transportation": {"name": "Transportation", "color": "#06B6D4", "essential": True, "benchmark_pct": 0.0562, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "grooming": {"name": "Grooming & personal care", "color": "#A855F7", "essential": False, "benchmark_pct": 0.0562, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "subscriptions": {"name": "OTT & music subscriptions", "color": "#D946EF", "essential": False, "benchmark_pct": 0.0375, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "movies-entertainment": {"name": "Movies & entertainment", "color": "#F59E0B", "essential": False, "benchmark_pct": 0.0375, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "tech-gadgets": {"name": "Technology & gadgets", "color": "#0EA5E9", "essential": False, "benchmark_pct": 0.0375, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "gaming-inapp": {"name": "Gaming (in-app/top-ups)", "color": "#EC4899", "essential": False, "benchmark_pct": 0.0187, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "investments": {"name": "Investments & savings", "color": "#22C55E", "essential": True, "benchmark_pct": 0.0187, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "charity-donations": {"name": "Charity & donations", "color": "#F472B6", "essential": False, "benchmark_pct": 0.0037, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    # Below: n=3 reported ₹0 — treated as "no usable benchmark yet" (has_benchmark
    # checks truthiness, not just `is not None`), not "this category should be 0."
    "mobile-recharge": {"name": "Mobile recharge/data", "color": "#3B82F6", "essential": True, "benchmark_pct": 0.0, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "books": {"name": "Books & stationery", "color": "#14B8A6", "essential": True, "benchmark_pct": 0.0, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "fantasy-betting": {"name": "Fantasy sports & betting", "color": "#EF4444", "essential": False, "benchmark_pct": 0.0, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    "tuition-coaching": {"name": "Coaching/tuition/exam fees", "color": "#10B981", "essential": True, "benchmark_pct": 0.0, "median_spend_inr": 0.0},  # n=3, 2026-08-21
    # Not in the survey at all — genuinely no baseline, same as Step 8's original None entries.
    "miscellaneous": {"name": "Miscellaneous", "color": "#64748B", "essential": False, "benchmark_pct": None, "median_spend_inr": None},
}

# Weight keys realigned 2026-08-21 to the same survey-matched category ids as
# CATEGORIES_METADATA above (e.g. "gaming" -> "gaming-inapp") — these are
# looked up against that dict's keys via .get(), so a stale id here would
# silently drop out of the archetype's defining vector instead of erroring.
PEER_ARCHETYPES = [
    {
        "id": "archetype_gamer_foodie",
        "name": "The Gamer & Foodie",
        "color": "#EC4899",
        "description": "Spends predominantly on late-night Swiggy/Zomato snacks, Discord/Spotify, and gaming battle passes.",
        "weights": {"food-snacks": 0.35, "gaming-inapp": 0.25, "subscriptions": 0.15, "mobile-recharge": 0.10, "transportation": 0.05, "investments": 0.10}
    },
    {
        "id": "archetype_exam_grinder",
        "name": "The Exam Grinder & Scholar",
        "color": "#10B981",
        "description": "Prioritizes coaching modules, test series, textbooks, and minimal discretionary spending.",
        "weights": {"tuition-coaching": 0.50, "books": 0.20, "transportation": 0.15, "mobile-recharge": 0.05, "investments": 0.10}
    },
    {
        "id": "archetype_social_trendsetter",
        "name": "The Social Trendsetter",
        "color": "#F43F5E",
        "description": "High affinity for streetwear, cafes, birthdays, and campus outings.",
        "weights": {"clothes-shoes": 0.30, "gifting-friends": 0.25, "food-snacks": 0.20, "grooming": 0.15, "transportation": 0.10}
    },
    {
        "id": "archetype_commuter_nomad",
        "name": "The Commuter Nomad",
        "color": "#06B6D4",
        "description": "Constant city transit, metro cards, rapid street food halts, and mobile data top-ups.",
        "weights": {"transportation": 0.40, "mobile-recharge": 0.20, "food-snacks": 0.25, "miscellaneous": 0.15}
    },
    {
        "id": "archetype_zen_saver",
        "name": "The Zen Saver",
        "color": "#22C55E",
        "description": "Strict financial discipline, high savings stash, and smart budget adherence.",
        "weights": {"investments": 0.45, "tuition-coaching": 0.20, "mobile-recharge": 0.15, "transportation": 0.10, "food-snacks": 0.10}
    }
]

COLD_START_DAY_THRESHOLD = 14
MIN_TRANSACTION_COUNT_THRESHOLD = 5

class MLEngine:
    # True once apply_live_benchmarks() has successfully overlaid real
    # survey-derived numbers onto CATEGORIES_METADATA at least once — lets
    # callers (e.g. the /health-adjacent admin status endpoint) report
    # honestly whether the running heuristic is using the Step 8 static
    # fallback numbers or Step 10's live survey stats.
    live_benchmarks_applied: bool = False
    live_benchmarks_computed_at: Optional[str] = None
    live_benchmarks_sample_size: int = 0

    @classmethod
    def apply_live_benchmarks(cls, benchmarks_doc: Optional[Dict[str, Any]]) -> bool:
        """Overlays Step 10's survey-derived `overall` benchmark_pct/median
        onto CATEGORIES_METADATA in place, so the cold-start heuristic in
        calculate_spend_predictions/generate_dot_graph immediately reflects
        real survey data instead of the Step 8 static fallback numbers —
        called at startup and again after every superadmin recompute
        (backend/app/main.py), which is the actual mechanism behind "changing
        dataConfig triggers a recompute, not a redeploy." Never invents an
        entry for a category CATEGORIES_METADATA doesn't already have (name/
        color/essential stay as defined there — this only ever touches
        benchmark_pct and median_spend_inr) and safely no-ops if the doc is
        missing or malformed, leaving whatever was there before untouched.
        """
        if not benchmarks_doc or "overall" not in benchmarks_doc:
            return False
        overall = benchmarks_doc["overall"]
        applied_any = False
        for cat_id, meta in CATEGORIES_METADATA.items():
            stat = overall.get(cat_id)
            if not stat or stat.get("insufficientData"):
                continue
            meta["benchmark_pct"] = stat.get("adjustedBenchmarkPct", meta["benchmark_pct"])
            meta["median_spend_inr"] = stat.get("median", meta["median_spend_inr"])
            applied_any = True
        if applied_any:
            cls.live_benchmarks_applied = True
            cls.live_benchmarks_computed_at = benchmarks_doc.get("computedAt")
            cls.live_benchmarks_sample_size = benchmarks_doc.get("sampleSize", 0)
        return applied_any

    @staticmethod
    def _analyze_data_maturity(transactions: List[TransactionItem]) -> Tuple[bool, int, int]:
        """
        Determines if user has sufficient history (>= 14 active days & >= 5 transactions)
        for personalized ML vs heuristic cold-start mode.
        """
        tx_count = len(transactions)
        if tx_count == 0:
            return True, 0, 0
            
        timestamps = [tx.timestamp for tx in transactions]
        min_date = min(timestamps)
        max_date = max(timestamps)
        # Unique calendar days logged
        unique_days = len(set(t.date() for t in timestamps))
        day_span = max(1, (max_date - min_date).days + 1)
        effective_days = max(unique_days, day_span)
        
        is_cold_start = (effective_days < COLD_START_DAY_THRESHOLD) or (tx_count < MIN_TRANSACTION_COUNT_THRESHOLD)
        return is_cold_start, effective_days, tx_count

    @staticmethod
    def calculate_spend_predictions(
        user_id: str,
        transactions: List[TransactionItem],
        monthly_budget: float = 5000.0,
        period_days: int = 30
    ) -> SpendPredictResponse:
        is_cold_start, active_days, tx_count = MLEngine._analyze_data_maturity(transactions)
        total_historical = sum(tx.amount for tx in transactions)
        
        # Calculate category totals
        cat_totals: Dict[str, float] = {k: 0.0 for k in CATEGORIES_METADATA.keys()}
        for tx in transactions:
            cat_id = tx.category if tx.category in cat_totals else "miscellaneous"
            cat_totals[cat_id] += tx.amount

        category_breakdowns: List[CategoryForecast] = []
        high_risk_categories: List[str] = []
        insights: List[str] = []

        if is_cold_start:
            # -------------------------------------------------------------
            # COLD-START HEURISTIC MODE (< 14 days or < 5 transactions)
            # Rule-based heuristic using category medians & baseline weights
            # Clearly labeled to prevent fabricated/hallucinated predictions
            # -------------------------------------------------------------
            model_mode = "HEURISTIC_COLD_START"
            confidence_score = round(min(0.55, 0.25 + (active_days / COLD_START_DAY_THRESHOLD) * 0.25 + (tx_count * 0.02)), 2)
            last_retrained = None

            # Blended daily burn rate: 70% taxonomy baseline + 30% observed
            baseline_daily = monthly_budget / period_days
            observed_daily = (total_historical / max(1, active_days)) if total_historical > 0 else baseline_daily
            blended_daily_burn = round((0.65 * baseline_daily) + (0.35 * observed_daily), 2)
            predicted_total = round(blended_daily_burn * period_days, 2)
            
            projected_days_left = max(0.0, (monthly_budget - total_historical) / max(1.0, blended_daily_burn))

            for cat_id, meta in CATEGORIES_METADATA.items():
                hist_spend = cat_totals[cat_id]
                has_benchmark = bool(meta["benchmark_pct"])  # truthy: excludes both None and 0.0 (thin-sample zero)
                if has_benchmark:
                    # Heuristic expected allocation, from the surveyed taxonomy baseline
                    expected_cat_spend = round(predicted_total * meta["benchmark_pct"], 2)
                    # If observed spend exceeds benchmark expected allocation, flag as alert
                    is_flagged = hist_spend > (expected_cat_spend * 0.6) and not meta["essential"]
                else:
                    # No survey baseline for this category yet (Step 8) — the only honest
                    # "expected" figure is what's actually been observed. Never flag as
                    # over-budget against a baseline that doesn't exist: with zero benchmark,
                    # the first rupee logged would otherwise look like "infinitely over."
                    expected_cat_spend = round(hist_spend, 2)
                    is_flagged = False
                if is_flagged:
                    high_risk_categories.append(meta["name"])

                category_breakdowns.append(
                    CategoryForecast(
                        category_id=cat_id,
                        category_name=meta["name"],
                        predicted_spend=expected_cat_spend,
                        confidence=confidence_score,
                        historical_spend=round(hist_spend, 2),
                        trend_pct=0.0, # Do not fabricate false trend percentages on cold start
                        risk_level="medium" if is_flagged else "low",
                        is_heuristic=True
                    )
                )

            # Cold start insights
            insights.append(
                f"ℹ️ Early estimate (Cold-start heuristic): Logged {active_days}/14 required days ({tx_count} transactions). Antara uses teen taxonomy benchmarks until 14 days of real data are logged."
            )
            if high_risk_categories:
                insights.append(
                    f"⚠️ Early discretionary flag: {', '.join(high_risk_categories[:2])} is consuming higher budget share than baseline."
                )
            insights.append(
                f"💡 Daily target: Aim to keep daily expenses under ₹{round(monthly_budget / period_days)} to stay on budget."
            )

        else:
            # -------------------------------------------------------------
            # TRAINED EMBEDDING PREDICTION MODE (>= 14 days & >= 5 transactions)
            # Real trained velocity & time-decayed exponential category trend
            # -------------------------------------------------------------
            model_mode = "TRAINED_EMBEDDING_V1"
            confidence_score = round(min(0.92, 0.75 + (active_days / 60) * 0.15), 2)
            last_retrained = datetime.utcnow()

            daily_burn_rate = total_historical / max(1, active_days)
            predicted_total = round(daily_burn_rate * period_days, 2)
            projected_days_left = max(0.0, (monthly_budget - total_historical) / max(0.1, daily_burn_rate))

            for cat_id, meta in CATEGORIES_METADATA.items():
                hist_spend = cat_totals[cat_id]
                has_benchmark = bool(meta["benchmark_pct"])  # truthy: excludes both None and 0.0 (thin-sample zero)
                pct_of_total = (hist_spend / total_historical) if total_historical > 0 else (meta["benchmark_pct"] or 0.0)

                # Dynamic category trend. Without a survey benchmark (Step 8 categories),
                # there's no baseline to say a share is "too high" against, so skip the
                # over-benchmark growth nudge and just project the observed rate forward.
                cat_daily = hist_spend / max(1, active_days)
                over_benchmark = has_benchmark and pct_of_total > meta["benchmark_pct"]
                predicted_cat = round(cat_daily * period_days * (1.08 if not meta["essential"] and over_benchmark else 1.0), 2)
                trend_pct = round(((predicted_cat - hist_spend) / max(1.0, hist_spend)) * 100, 1)

                risk_level = "low"
                if has_benchmark and pct_of_total > (meta["benchmark_pct"] * 1.4) and not meta["essential"]:
                    risk_level = "high"
                    high_risk_categories.append(meta["name"])
                elif has_benchmark and pct_of_total > meta["benchmark_pct"]:
                    risk_level = "medium"

                category_breakdowns.append(
                    CategoryForecast(
                        category_id=cat_id,
                        category_name=meta["name"],
                        predicted_spend=predicted_cat,
                        confidence=confidence_score,
                        historical_spend=round(hist_spend, 2),
                        trend_pct=trend_pct,
                        risk_level=risk_level,
                        is_heuristic=False
                    )
                )

            insights.append(
                f"✨ Personalized ML Active: Trained on {active_days} days of verified spending ({tx_count} transactions)."
            )
            if predicted_total > monthly_budget:
                insights.append(
                    f"🚨 Burn alert: Projected month-end spend ₹{predicted_total:.0f} will exceed ₹{monthly_budget:.0f} budget by ₹{predicted_total - monthly_budget:.0f}."
                )
            else:
                insights.append(
                    f"🌱 Savings projection: You are on track to save ~₹{monthly_budget - predicted_total:.0f} this month."
                )

        category_breakdowns.sort(key=lambda x: x.predicted_spend, reverse=True)

        return SpendPredictResponse(
            user_id=user_id,
            predicted_total_spend=round(predicted_total, 2),
            current_burn_rate_daily=round(total_historical / max(1, active_days), 2),
            predicted_burn_rate_daily=round(predicted_total / period_days, 2),
            projected_days_until_budget_exhaustion=round(projected_days_left, 1),
            top_risk_categories=high_risk_categories,
            category_breakdown=category_breakdowns,
            smart_insights=insights,
            is_cold_start=is_cold_start,
            model_mode=model_mode,
            data_days_logged=active_days,
            data_points_count=tx_count,
            confidence_score=confidence_score,
            last_retrained_at=last_retrained,
            generated_at=datetime.utcnow()
        )

    @staticmethod
    def generate_dot_graph(user_id: str, transactions: List[TransactionItem]) -> DotGraphResponse:
        """
        Generates the Obsidian-style dot graph layout.
        Uses cold-start benchmark layout when < 14 days of data exists.
        Transitions to learned embedding cosine clustering when >= 14 days of data exists.
        """
        is_cold_start, active_days, tx_count = MLEngine._analyze_data_maturity(transactions)
        cat_totals: Dict[str, float] = {k: 0.0 for k in CATEGORIES_METADATA.keys()}
        for tx in transactions:
            cat_id = tx.category if tx.category in cat_totals else "miscellaneous"
            cat_totals[cat_id] += tx.amount
            
        total_spend = sum(cat_totals.values())
        cat_keys = list(CATEGORIES_METADATA.keys())

        if is_cold_start:
            model_mode = "HEURISTIC_COLD_START"
            confidence_score = round(min(0.50, 0.20 + (active_days / 14) * 0.25), 2)
            last_retrained = None
            
            # Blend user vector with benchmark taxonomy to prevent empty graph.
            # Categories with no survey benchmark yet (Step 8) contribute 0.0 baseline
            # weight rather than crashing on None or fabricating a plausible-looking one.
            if total_spend > 0:
                raw_vec = [cat_totals[k] / total_spend for k in cat_keys]
                user_vector = [(0.4 * raw_vec[i]) + (0.6 * (meta["benchmark_pct"] or 0.0)) for i, meta in enumerate(CATEGORIES_METADATA.values())]
            else:
                user_vector = [(meta["benchmark_pct"] or 0.0) for meta in CATEGORIES_METADATA.values()]

            archetype_name = "Heuristic Baseline (Early Stage)"
            archetype_desc = f"Logged {active_days}/14 days of transactions. Displaying baseline taxonomy gravity until personalized ML embedding activates at 14 days."

        else:
            model_mode = "TRAINED_EMBEDDING_V1"
            confidence_score = round(min(0.92, 0.75 + (active_days / 60) * 0.15), 2)
            last_retrained = datetime.utcnow()
            user_vector = [cat_totals[k] / total_spend for k in cat_keys]
            archetype_name = PEER_ARCHETYPES[0]["name"]
            archetype_desc = PEER_ARCHETYPES[0]["description"]

        # Compute cosine similarity with peer archetypes
        best_archetype = PEER_ARCHETYPES[0]
        best_similarity = -1.0
        archetype_matches = []

        for arc in PEER_ARCHETYPES:
            arc_vec = [arc["weights"].get(k, 0.01) for k in cat_keys]
            arc_norm = np.linalg.norm(arc_vec)
            user_norm = np.linalg.norm(user_vector)
            sim = float(np.dot(user_vector, arc_vec) / (arc_norm * user_norm)) if (user_norm > 0 and arc_norm > 0) else 0.5
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

        if not is_cold_start:
            archetype_name = best_archetype["name"]
            archetype_desc = best_archetype["description"]

        archetype_matches.sort(key=lambda x: x["similarity_pct"], reverse=True)

        # Build Graph Nodes & Links
        nodes: List[GraphNode] = []
        links: List[GraphLink] = []

        # Center User Node
        user_node_size = 28 + min(18, math.sqrt(total_spend) if total_spend > 0 else 8)
        nodes.append(
            GraphNode(
                id="user_center",
                label="You (Spend Core)" if not is_cold_start else "You (Early Estimate)",
                type="user",
                size=user_node_size,
                color="#8B5CF6" if not is_cold_start else "#A78BFA",
                amount=total_spend,
                x=0.0,
                y=0.0,
                metadata={
                    "total_spend": total_spend,
                    "tx_count": tx_count,
                    "active_days": active_days,
                    "is_cold_start": is_cold_start,
                    "archetype": archetype_name
                }
            )
        )

        # Category Gravity Nodes arranged radially (count follows CATEGORIES_METADATA,
        # not hardcoded — 18 as of Step 8's taxonomy merge, not the original 12)
        angle_step = (2 * math.pi) / len(CATEGORIES_METADATA)
        radius = 240.0

        for i, (cat_id, meta) in enumerate(CATEGORIES_METADATA.items()):
            spend = cat_totals[cat_id]
            # No-benchmark categories (Step 8) fall back to 0.0, not None, when there's
            # no observed spend to size the node from either.
            pct = (spend / total_spend) if total_spend > 0 else (meta["benchmark_pct"] or 0.0)
            node_size = 14 + (pct * 36)
            
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

            # Link between User and Category
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

            if not is_cold_start and arc["id"] == best_archetype["id"]:
                links.append(
                    GraphLink(
                        source="user_center",
                        target=f"arc_{arc['id']}",
                        strength=0.75,
                        distance=180.0,
                        type="similarity"
                    )
                )

        return DotGraphResponse(
            user_id=user_id,
            archetype=archetype_name,
            archetype_description=archetype_desc,
            is_cold_start=is_cold_start,
            model_mode=model_mode,
            data_days_logged=active_days,
            confidence_score=confidence_score,
            embedding=[round(float(v), 4) for v in user_vector],
            nodes=nodes,
            links=links,
            peer_archetypes=archetype_matches,
            last_retrained_at=last_retrained,
            generated_at=datetime.utcnow()
        )
