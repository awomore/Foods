import { api } from './client';

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes?: number;
  is_free_preview?: boolean;
}

export interface Course {
  id: string;
  cook_id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  price: number;
  currency: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
  duration_hours: number | null;
  lesson_count: number;
  category: string | null;
  tags: string[];
  is_published: boolean;
  is_free: boolean;
  enrollment_count: number;
  rating: number;
  lessons: CourseLesson[];
  created_at: string;
  cook_name?: string;
  cook_avatar?: string;
  cook_bio?: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  progress: number;
  completed: boolean;
  enrolled_at: string;
  completed_at: string | null;
}

export const coursesApi = {
  list: (params?: { cook_id?: string; category?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.cook_id) q.set('cook_id', params.cook_id);
    if (params?.category) q.set('category', params.category);
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get<{ courses: Course[] }>(`/courses?${q}`);
  },

  myCourses: () =>
    api.get<{ courses: Course[] }>('/courses/my'),

  get: (id: string) =>
    api.get<{ course: Course }>(`/courses/${id}`),

  create: (data: {
    title: string;
    description?: string;
    cover_image?: string;
    price?: number;
    difficulty_level?: string;
    duration_hours?: number;
    category?: string;
    tags?: string[];
    lessons?: CourseLesson[];
    is_free?: boolean;
  }) => api.post<{ course: Course }>('/courses', data),

  update: (id: string, data: Partial<Course>) =>
    api.patch<{ course: Course }>(`/courses/${id}`, data),

  enroll: (id: string, data: { tx_ref?: string; amount_paid?: number }) =>
    api.post<{ enrollment: CourseEnrollment }>(`/courses/${id}/enroll`, data),

  myProgress: (id: string) =>
    api.get<{ enrollment: CourseEnrollment }>(`/courses/${id}/my-progress`),

  updateProgress: (id: string, progress: number) =>
    api.patch<{ enrollment: CourseEnrollment }>(`/courses/${id}/progress`, { progress }),
};
