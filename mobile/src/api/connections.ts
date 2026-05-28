import { api } from './client';

export interface UserConnection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  shared_order_id: string | null;
  created_at: string;
  other_user_id?: string;
  other_name?: string;
  other_username?: string | null;
  other_avatar?: string | null;
}

export interface ConnectionStatus {
  status: 'none' | 'pending' | 'accepted' | 'blocked';
  connection_id?: string;
  is_requester?: boolean;
}

export const connectionsApi = {
  request: (recipient_id: string, order_id?: string) =>
    api.post<{ connection: UserConnection }>('/connections/request', { recipient_id, order_id }),

  list: () =>
    api.get<{ connections: UserConnection[] }>('/connections'),

  respond: (connectionId: string, action: 'accept' | 'block') =>
    api.patch<{ connection: UserConnection }>(`/connections/${connectionId}/respond`, { action }),

  statusWith: (userId: string) =>
    api.get<ConnectionStatus>(`/connections/status/${userId}`),
};
