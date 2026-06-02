import { Linking } from 'react-native';
import { api } from './client';

const WEB_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

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
  list: (params?: { cook_id?: string; category?: string; limit?: number; is_published?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.cook_id) q.set('cook_id', params.cook_id);
    if (params?.category) q.set('category', params.category);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.is_published != null) q.set('is_published', String(params.is_published));
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

  updateProgress: (id: string, data: { lessons_completed: number; total_lessons?: number }) =>
    api.patch<{ enrollment: CourseEnrollment }>(`/courses/${id}/progress`, data),

  issueCertificate: (id: string) =>
    api.post<{ enrollment: CourseEnrollment; certificate_url: string }>(`/courses/${id}/certificate`, {}),

  getStudents: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ students: any[]; total: number }>(`/courses/${id}/students`),

  myEnrolled: () =>
    api.get<{ enrollments: any[] }>('/courses/my/enrolled'),

  myCertificates: () =>
    api.get<{ certificates: any[] }>('/courses/my/certificates'),

  // Open the certificate page in the device browser (printable/saveable as PDF)
  openCertificate: async (certificateUrl: string): Promise<void> => {
    // certificateUrl is already the full /certificate/:token URL from the backend
    const fullUrl = certificateUrl.startsWith('http') ? certificateUrl : `${WEB_BASE}${certificateUrl}`;
    await Linking.openURL(fullUrl);
  },
};
