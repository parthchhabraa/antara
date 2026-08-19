export interface Transaction {
  id: string;
  amount: number;
  category: string;
  subcategory?: string;
  note?: string;
  timestamp: string; // ISO date string
  source?: 'upi' | 'cash' | 'card' | 'manual';
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  subcategories: string[];
  is_essential: boolean;
  description: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'superadmin' | 'user' | 'beta_tester';
  is_demo_mode: boolean;
  monthly_budget: number;
  created_at: string;
}

export interface CategoryForecast {
  category_id: string;
  category_name: string;
  predicted_spend: number;
  confidence: number;
  historical_spend: number;
  trend_pct: number;
  risk_level: 'low' | 'medium' | 'high';
}

export interface SpendPrediction {
  user_id: string;
  predicted_total_spend: number;
  current_burn_rate_daily: number;
  predicted_burn_rate_daily: number;
  projected_days_until_budget_exhaustion: number;
  top_risk_categories: string[];
  category_breakdown: CategoryForecast[];
  smart_insights: string[];
  generated_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'user' | 'category' | 'peer_cluster' | 'transaction_spike';
  size: number;
  color: string;
  category_id?: string;
  amount?: number;
  x?: number;
  y?: number;
  metadata?: Record<string, any>;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
  distance: number;
  type: 'gravity' | 'similarity' | 'co_occurrence';
}

export interface PeerArchetype {
  id: string;
  name: string;
  color: string;
  similarity_pct: number;
  description: string;
}

export interface DotGraphData {
  user_id: string;
  archetype: string;
  archetype_description: string;
  embedding: number[];
  nodes: GraphNode[];
  links: GraphLink[];
  peer_archetypes: PeerArchetype[];
  generated_at: string;
}

export interface BetaAllowlistEntry {
  email: string;
  added_at: string;
  added_by: string;
  notes?: string;
}
