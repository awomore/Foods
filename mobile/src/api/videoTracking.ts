import { api } from './client';

export type VideoEntityType = 'menu_item' | 'post' | 'story' | 'course' | 'customer_post';

export interface VideoStats {
  total_views: number;
  completions: number;
  avg_watch_seconds: number;
  completion_rate: number;
}

export const videoTrackingApi = {
  recordView: async (params: {
    entity_type: VideoEntityType;
    entity_id: string;
    watch_seconds?: number;
    completed?: boolean;
  }) => {
    try {
      await api.post('/video-views', params);
    } catch { /* silently swallow — tracking must not break the UI */ }
  },

  getStats: (entityType: VideoEntityType, entityId: string) =>
    api.get<{ stats: VideoStats }>(`/video-views/${entityType}/${entityId}`),

  getCreatorTopVideos: (limit = 10) =>
    api.get<{ items: any[] }>('/video-views/creator/top', { params: { limit } }),
};
