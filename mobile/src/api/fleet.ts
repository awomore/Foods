import { api } from './client';

export type FleetOperatorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type RiderStatus        = 'pending' | 'approved' | 'rejected' | 'suspended';
export type OperatorType       = 'company' | 'individual';
export type VehicleType        = 'bike' | 'bicycle';

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
