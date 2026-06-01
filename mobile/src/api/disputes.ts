import { api } from './client';

export type DisputeType = 'wrong_order' | 'not_delivered' | 'quality_issue' | 'late_delivery' | 'fraud' | 'other';
export type DisputeStatus = 'open' | 'evidence_review' | 'admin_review' | 'resolved' | 'escalated' | 'closed';
export type ResolutionType = 'full_refund' | 'partial_refund' | 'no_refund' | 'replacement';

export interface Dispute {
  id: string;
  order_id: string;
  customer_id: string;
  cook_id: string;
  type: DisputeType;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  resolution_type: ResolutionType | null;
  refund_amount: number | null;
  sla_deadline: string;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  cook_name?: string;
  order_total?: number;
}

export interface DisputeEvidence {
  id: string;
  dispute_id: string;
  submitted_by: string;
  role: 'customer' | 'cook' | 'admin';
  file_url: string;
  file_type: 'image' | 'video' | 'document';
  description: string | null;
  created_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  role: 'customer' | 'cook' | 'admin';
  message: string;
  created_at: string;
  sender_name?: string;
}

export const disputesApi = {
  file: (data: { order_id: string; type: DisputeType; reason: string }) =>
    api.post<{ dispute: Dispute }>('/disputes', data),

  list: () =>
    api.get<{ disputes: Dispute[] }>('/disputes'),

  get: (id: string) =>
    api.get<{ dispute: Dispute; evidence: DisputeEvidence[]; messages: DisputeMessage[] }>(`/disputes/${id}`),

  addEvidence: (id: string, data: {
    file_url: string;
    file_type: 'image' | 'video' | 'document';
    description?: string;
  }) => api.post<{ evidence: DisputeEvidence }>(`/disputes/${id}/evidence`, data),

  sendMessage: (id: string, message: string) =>
    api.post<{ message: DisputeMessage }>(`/disputes/${id}/messages`, { message }),
};
