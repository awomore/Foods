const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<{ message: string }>('/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) =>
    api.post<{ token: string; user: AdminUser }>('/auth/verify-otp', { phone, otp }),
  me: () => api.get<{ user: AdminUser }>('/auth/me'),
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const statsApi = {
  overview: () => api.get<StatsOverview>('/admin/stats'),
  chart: (days = 30) => api.get<{ chart: ChartRow[] }>(`/admin/stats/chart?days=${days}`),
};

// ── Cooks ─────────────────────────────────────────────────────────────────────

export const cooksAdminApi = {
  list: (params: CookListParams) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.status) q.set('status', params.status);
    if (params.verified != null) q.set('verified', String(params.verified));
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ cooks: AdminCook[]; total: number }>(`/admin/cooks?${q}`);
  },
  get: (id: string) => api.get<{ cook: AdminCookDetail; stats: CookStats; recent_payouts: Payout[]; recent_orders: OrderSummary[] }>(`/admin/cooks/${id}`),
  verify: (id: string, body: { food_safety_verified?: boolean; id_verified?: boolean; verification_status?: string }) =>
    api.patch<{ cook: AdminCook }>(`/admin/cooks/${id}/verify`, body),
  suspend: (id: string, suspended: boolean, reason?: string) =>
    api.patch<{ cook: AdminCook }>(`/admin/cooks/${id}/suspend`, { suspended, reason }),
};

// ── Customers ─────────────────────────────────────────────────────────────────

export const customersApi = {
  list: (params: { q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ customers: AdminCustomer[]; total: number }>(`/admin/customers?${q}`);
  },
  suspend: (id: string, suspended: boolean) =>
    api.patch<{ customer: AdminCustomer }>(`/admin/customers/${id}/suspend`, { suspended }),
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersAdminApi = {
  list: (params: OrderListParams) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.q) q.set('q', params.q);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ orders: AdminOrder[]; total: number }>(`/admin/orders?${q}`);
  },
  setStatus: (id: string, status: string, note?: string) =>
    api.patch<{ order: AdminOrder }>(`/admin/orders/${id}/status`, { status, note }),
  refund: (id: string, reason: string) =>
    api.post<{ order: AdminOrder; message: string }>(`/admin/orders/${id}/refund`, { reason }),
};

// ── Payouts ───────────────────────────────────────────────────────────────────

export const payoutsApi = {
  list: (status = 'pending', limit = 50, offset = 0) =>
    api.get<{ payouts: Payout[]; total: number; total_amount: number }>(
      `/admin/payouts?status=${status}&limit=${limit}&offset=${offset}`
    ),
  process: (id: string, bank_reference?: string) =>
    api.patch<{ payout: Payout }>(`/admin/payouts/${id}/process`, { bank_reference }),
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export const reviewsApi = {
  list: (params: { flagged?: boolean; q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params.flagged) q.set('flagged', 'true');
    if (params.q) q.set('q', params.q);
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ reviews: Review[] }>(`/admin/reviews?${q}`);
  },
  flag: (id: string, flagged: boolean) =>
    api.patch<{ review: Review }>(`/admin/reviews/${id}/flag`, { flagged }),
  remove: (id: string) => api.delete<{ message: string }>(`/admin/reviews/${id}`),
};

// ── Config ────────────────────────────────────────────────────────────────────

export const configApi = {
  get: () => api.get<{ platform_fee_rate: number; country_configs: CountryConfig[] }>('/admin/config'),
};

// ── Disputes ──────────────────────────────────────────────────────────────────

export const disputesAdminApi = {
  list: (status?: string, limit = 50, offset = 0) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) q.set('status', status);
    return api.get<{ disputes: AdminDispute[]; total: number }>(`/admin/disputes?${q}`);
  },
  resolve: (id: string, body: { resolution: string; resolution_type: string; refund_amount?: number }) =>
    api.patch<{ dispute: AdminDispute }>(`/admin/disputes/${id}/resolve`, body),
  escalate: (id: string) =>
    api.patch<{ dispute: AdminDispute }>(`/admin/disputes/${id}/escalate`, {}),
};

// ── Verifications ─────────────────────────────────────────────────────────────

export const verificationsAdminApi = {
  list: (status = 'pending', limit = 50, offset = 0) =>
    api.get<{ submissions: VerificationSubmission[]; total: number }>(
      `/admin/verifications?status=${status}&limit=${limit}&offset=${offset}`
    ),
  approve: (id: string, review_notes?: string, expires_at?: string) =>
    api.patch<{ submission: VerificationSubmission }>(`/admin/verifications/${id}/approve`, { review_notes, expires_at }),
  reject: (id: string, review_notes?: string) =>
    api.patch<{ submission: VerificationSubmission }>(`/admin/verifications/${id}/reject`, { review_notes }),
};

// ── Moderation ────────────────────────────────────────────────────────────────

export const moderationAdminApi = {
  list: (limit = 50, offset = 0) =>
    api.get<{ flagged_reviews: FlaggedReview[]; reported_posts: ReportedPost[] }>(
      `/admin/moderation?limit=${limit}&offset=${offset}`
    ),
  dismissReview: (id: string) =>
    api.patch<{ ok: boolean }>(`/admin/moderation/reviews/${id}/dismiss`, {}),
  deleteReview: (id: string) =>
    api.delete<{ message: string }>(`/admin/moderation/reviews/${id}`),
};

// ── Fraud ─────────────────────────────────────────────────────────────────────

export const fraudAdminApi = {
  get: () => api.get<FraudData>('/admin/fraud'),
  resolveSignal: (id: string, resolution_note?: string) =>
    api.patch<{ signal: FraudSignal }>(`/admin/fraud/signals/${id}/resolve`, { resolution_note }),
  updateRiskLevel: (userId: string, risk_level: string, flagged?: boolean) =>
    api.patch<{ user: { id: string; full_name: string; account_risk_level: string; fraud_flagged: boolean } }>(
      `/admin/fraud/users/${userId}/risk-level`, { risk_level, flagged }
    ),
};

// ── Riders / Fleet ────────────────────────────────────────────────────────────

export const ridersAdminApi = {
  listOperators: (status?: string, limit = 30, offset = 0) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) q.set('status', status);
    return api.get<{ fleet_operators: FleetOperator[] }>(`/fleet/operators?${q}`);
  },
  listRiders: (status?: string, limit = 30, offset = 0) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) q.set('status', status);
    return api.get<{ riders: RiderProfile[] }>(`/fleet/riders?${q}`);
  },
  reviewOperator: (id: string, status: string, rejection_reason?: string) =>
    api.patch<{ fleet_operator: FleetOperator }>(`/fleet/operators/${id}/review`, { status, rejection_reason }),
  reviewRider: (id: string, status: string, rejection_reason?: string) =>
    api.patch<{ rider_profile: RiderProfile }>(`/fleet/riders/${id}/review`, { status, rejection_reason }),
};

// ── SLA / Delivery ────────────────────────────────────────────────────────────

export const slaAdminApi = {
  dashboard: () => api.get<SlaAdminDashboard>('/sla/admin/dashboard'),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export interface StatsOverview {
  total_users: number;
  total_active_cooks: number;
  orders_by_status: Record<string, number>;
  total_orders: number;
  platform_revenue: number;
  pending_payout_amount: number;
  pending_payout_count: number;
  pending_verifications: number;
}

export interface ChartRow {
  day: string;
  orders: number;
  revenue: number;
}

export interface AdminCook {
  id: string;
  display_name: string;
  username: string;
  location: string;
  is_live: boolean;
  is_active: boolean;
  food_safety_verified: boolean;
  id_verified: boolean;
  verification_status: string;
  average_rating: number;
  total_orders: number;
  platform_follower_count: number;
  created_at: string;
  phone: string;
  email: string | null;
  full_name: string;
}

export interface AdminCookDetail extends AdminCook {
  joined_at: string;
}

export interface CookStats {
  total_orders: number;
  total_earned: number;
}

export interface OrderSummary {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export interface CookListParams {
  q?: string;
  status?: 'active' | 'suspended';
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface AdminCustomer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  total_orders: number;
  total_spent: number;
}

export interface AdminOrder {
  id: string;
  status: string;
  total_amount: number;
  platform_fee: number;
  cook_payout: number;
  cook_name: string;
  customer_name: string;
  customer_phone: string;
  item_title: string;
  created_at: string;
  payment_tx_ref: string | null;
  customer_id: string;
}

export interface OrderListParams {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface Payout {
  id: string;
  cook_id: string;
  amount: number;
  currency_code: string;
  status: string;
  bank_reference: string | null;
  processed_at: string | null;
  created_at: string;
  cook_name: string;
  cook_username: string;
  cook_phone: string;
}

export interface Review {
  id: string;
  cook_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  is_flagged: boolean;
  created_at: string;
  cook_name: string;
  customer_name: string;
}

export interface CountryConfig {
  id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  is_active: boolean;
}

export interface AdminDispute {
  id: string;
  order_id: string;
  customer_id: string;
  cook_id: string;
  status: 'open' | 'under_review' | 'escalated' | 'resolved';
  reason: string;
  details: string | null;
  resolution: string | null;
  resolution_type: string | null;
  refund_amount: number | null;
  sla_deadline: string | null;
  created_at: string;
  resolved_at: string | null;
  customer_name: string;
  cook_name: string;
  order_total: number;
}

export interface VerificationSubmission {
  id: string;
  cook_id: string;
  status: 'pending' | 'approved' | 'rejected';
  document_type: string;
  document_url: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  expires_at: string | null;
  cook_name: string;
  cook_avatar: string | null;
  phone: string;
}

export interface FlaggedReview {
  id: string;
  comment: string | null;
  rating: number;
  report_reason: string | null;
  reported: boolean;
  created_at: string;
  entity_type: 'review';
  reporter_name: string;
  cook_name: string;
}

export interface ReportedPost {
  id: string;
  body: string | null;
  post_type: string;
  created_at: string;
  entity_type: 'post';
  cook_name: string;
}

export interface FraudSignal {
  id: string;
  user_id: string;
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  account_risk_level: string | null;
}

export interface FraudData {
  high_dispute_cooks: Array<{
    id: string;
    display_name: string;
    dispute_count: number;
    reliability_score: number;
    average_rating: number;
  }>;
  refund_rate: { refunded: number; total: number; rate: number };
  large_orders: Array<{
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    customer_name: string;
    cook_name: string;
  }>;
  fraud_signals: FraudSignal[];
  payout_abuse: Array<{
    display_name: string;
    payout_count: number;
    total_withdrawn: number;
    last_payout: string;
  }>;
  duplicate_accounts: Array<{
    phone_base: string;
    account_count: number;
    names: string[];
  }>;
  velocity_breaches: Array<{
    id: string;
    full_name: string;
    phone: string;
    order_count: number;
    total_spent: number;
  }>;
  high_risk_users: Array<{
    id: string;
    full_name: string;
    phone: string;
    account_risk_level: string;
    fraud_flagged: boolean;
    fraud_flagged_at: string | null;
    created_at: string;
  }>;
}

export interface FleetOperator {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  applicant_name: string;
  applicant_email: string | null;
  rider_count: number;
}

export interface RiderProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  fleet_operator_id: string | null;
  created_at: string;
  applicant_name: string;
  applicant_email: string | null;
  fleet_name: string | null;
}

export interface SlaAdminDashboard {
  sla_breaches: { total: number; breached: number; breach_rate: number };
  avg_delivery_minutes: number;
  dispute_window: { dispute_window_open: number };
  penalty_stats: { total_penalties: number; total_deductions: number };
  top_breaching_cooks: Array<{ display_name: string; username: string; breach_count: number }>;
}
