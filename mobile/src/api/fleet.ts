import { api } from './client';

export type FleetOperatorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type RiderStatus        = 'pending' | 'approved' | 'rejected' | 'suspended';
export type OperatorType       = 'company' | 'individual';
export type VehicleType        = 'bike' | 'bicycle';
// 'bvn'/'nin' only appear on old rows; new submissions use national_id/passport.
export type KycType            = 'national_id' | 'passport' | 'bvn' | 'nin';
export type KycStatus          = 'not_verified' | 'pending_review' | 'verified' | 'failed' | 'rejected';
export interface IdTypeOption { type: KycType; label: string; placeholder: string; automatic: boolean }

export interface RiderKyc {
  kyc_type: KycType | null;
  kyc_country?: string | null;
  kyc_submitted_at?: string | null;
  kyc_id_suffix: string | null;
  kyc_status: KycStatus;
  kyc_verified_name: string | null;
  kyc_verified_dob: string | null;
  kyc_verified_phone: string | null;
  kyc_verified_at: string | null;
  kyc_error: string | null;
}

export interface FleetOperator {
  id: string;
  user_id: string;
  operator_type: OperatorType;
  business_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  vehicle_types: VehicleType[];
  vehicle_count: number;
  service_areas: string[];
  id_document_url: string | null;
  vehicle_docs_url: string | null;
  insurance_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_code: string | null;
  status: FleetOperatorStatus;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  rider_count?: number;
  vehicle_count_actual?: number;
  applicant_name?: string;
  applicant_email?: string;
}

export interface RiderProfile {
  id: string;
  user_id: string;
  fleet_operator_id: string | null;
  full_name: string;
  phone: string;
  vehicle_type: VehicleType;
  vehicle_plate: string | null;
  government_id_url: string | null;
  vehicle_registration_url: string | null;
  service_areas: string[];
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_code: string | null;
  is_available: boolean;
  status: RiderStatus;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
  // KYC
  kyc_type: KycType | null;
  kyc_id_suffix: string | null;
  kyc_status: KycStatus;
  kyc_verified_name: string | null;
  kyc_verified_dob: string | null;
  kyc_verified_at: string | null;
  kyc_error: string | null;
  // joined
  fleet_name?: string;
  applicant_name?: string;
  applicant_email?: string;
}

export const fleetApi = {
  // ── Fleet operators ──────────────────────────────────────────
  registerOperator: (data: {
    operator_type: OperatorType;
    business_name: string;
    contact_name: string;
    contact_phone: string;
    contact_email?: string;
    vehicle_types: VehicleType[];
    vehicle_count?: number;
    service_areas?: string[];
    id_document_url?: string;
    vehicle_docs_url?: string;
    insurance_url?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    bank_code?: string;
  }) => api.post<{ fleet_operator: FleetOperator }>('/fleet/operators', data),

  getMyOperator: () =>
    api.get<{ fleet_operator: FleetOperator }>('/fleet/operators/me'),

  // ── Riders ───────────────────────────────────────────────────
  registerRider: (data: {
    fleet_operator_id?: string;
    full_name: string;
    phone: string;
    vehicle_type: VehicleType;
    vehicle_plate?: string;
    government_id_url?: string;
    vehicle_registration_url?: string;
    service_areas?: string[];
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    bank_code?: string;
  }) => api.post<{ rider: RiderProfile }>('/fleet/riders', data),

  getMyRider: () =>
    api.get<{ rider: RiderProfile }>('/fleet/riders/me'),

  // ── Admin ────────────────────────────────────────────────────
  adminListOperators: (params?: { status?: FleetOperatorStatus; limit?: number; offset?: number }) =>
    api.get<{ fleet_operators: FleetOperator[] }>('/fleet/operators', { params }),

  adminReviewOperator: (id: string, data: { status: 'approved' | 'rejected' | 'suspended'; rejection_reason?: string }) =>
    api.patch<{ fleet_operator: FleetOperator }>(`/fleet/operators/${id}/review`, data),

  adminListRiders: (params?: { status?: RiderStatus; limit?: number; offset?: number }) =>
    api.get<{ riders: RiderProfile[] }>('/fleet/riders', { params }),

  adminReviewRider: (id: string, data: { status: 'approved' | 'rejected' | 'suspended'; rejection_reason?: string }) =>
    api.patch<{ rider: RiderProfile }>(`/fleet/riders/${id}/review`, data),

  // ── KYC ─────────────────────────────────────────────────────
  // Riders verify with their own country's national ID (no BVN). The server
  // says which ID applies; countries without an automated check review a photo.
  idTypes: (country: string) =>
    api.get<{ country: string; id_types: IdTypeOption[] }>(`/fleet/id-types?country=${encodeURIComponent(country)}`),

  // Pre-registration check — no rider profile required. review=true means this
  // country's ID is checked by a person once the application is in.
  checkIdentity: (data: { country: string; type: KycType; value: string }) =>
    api.post<{ verified: boolean; verified_name?: string | null; review?: boolean }>('/fleet/check-identity', data),

  // document: base64 image data URI of the ID, stored privately for review.
  submitKyc: (data: { country: string; type: KycType; value: string; document?: string }) =>
    api.post<{ verified: boolean; status: KycStatus; verified_name?: string | null; message?: string }>('/fleet/riders/me/kyc', data),

  getMyKyc: () =>
    api.get<{ kyc: RiderKyc }>('/fleet/riders/me/kyc'),

  // ── Customer: get rider GPS for an order ─────────────────────
  getOrderLocation: (orderId: string) =>
    api.get<{
      location: {
        latitude: number;
        longitude: number;
        heading: number | null;
        speed: number | null;
        updated_at: string;
      } | null;
      order_status: string;
    }>(`/fleet/orders/${orderId}/location`),

  // ── Customer: rate the rider after delivery ──────────────────
  rateRider: (riderId: string, data: { rating: number; order_id: string; note?: string }) =>
    api.post<{ ok: true }>(`/fleet/riders/${riderId}/rate`, data),

  // ── Fleet operator earnings ───────────────────────────────────
  operatorEarnings: () =>
    api.get<{
      operator: { id: string; business_name: string; status: string };
      aggregate: {
        total_deliveries: number;
        total_gross: number;
        week_deliveries: number;
        week_gross: number;
        rider_count: number;
        active_riders: number;
      };
      per_rider: Array<{
        id: string;
        full_name: string;
        phone: string;
        vehicle_type: string;
        status: string;
        is_available: boolean;
        total_deliveries: number;
        all_time_gross: number;
        week_gross: number;
        week_deliveries: number;
      }>;
      daily_breakdown: Array<{ day: string; deliveries: number; gross: number }>;
    }>('/fleet/operators/me/earnings'),
};
