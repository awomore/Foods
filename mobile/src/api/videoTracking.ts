import { client } from './client';

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
      await client.post('/video-views', params);
    } catch { /* silently swallow — tracking must not break the UI */ }
  },

  getStats: async (entityType: VideoEntityType, entityId: string) => {
    const res = await client.get<{ stats: VideoStats }>(`/video-views/${entityType}/${entityId}`);
    return res.data;
  },

  getCreatorTopVideos: async (limit = 10) => {
    const res = await client.get<{ items: any[] }>('/video-views/creator/top', { params: { limit } });
    return res.data;
  },
};
