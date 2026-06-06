import { api } from './client';

export interface TimeSlot {
  start: string;
  end: string;
  label?: string;
}

export interface AvailabilitySlot {
  id: string;
  cook_id: string;
  date: string;
  is_available: boolean;
  time_slots: TimeSlot[];
  notes: string | null;
  created_at: string;
}

export const chefAvailabilityApi = {
  forCook: (cookId: string, start?: string, end?: string) => {
    const q = new URLSearchParams();
    if (start) q.set('start', start);
    if (end) q.set('end', end);
    return api.get<{ slots: AvailabilitySlot[] }>(`/chef-availability/${cookId}?${q}`);
  },

  setDay: (date: string, data: {
    is_available: boolean;
    time_slots?: TimeSlot[];
    notes?: string;
  }) => api.put<{ slot: AvailabilitySlot }>(`/chef-availability/${date}`, data),

  setBulk: (dates: Array<{
    date: string;
    is_available: boolean;
    time_slots?: TimeSlot[];
    notes?: string;
  }>) => api.put<{ slots: AvailabilitySlot[] }>('/chef-availability/bulk/set', { dates }),

  myCalendar: (days?: number) => {
    const q = days ? `?days=${days}` : '';
    return api.get<{ slots: AvailabilitySlot[] }>(`/chef-availability/my/upcoming${q}`);
  },
};
