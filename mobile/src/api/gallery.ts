import { api } from './client';

/** A photo on a creator's public gallery. `source: 'dish'` photos come from the
 *  creator's active menu and are not stored in the gallery. */
export interface GalleryPhoto {
  id: string;
  source: 'gallery' | 'dish';
  url: string;
  album_id: string | null;
  /** Set when the photo opens a dish that can be ordered now. */
  menu_item_id: string | null;
  title: string | null;
  price: number | null;
  /** A typed "from" price rather than a live dish price. */
  price_is_guide: boolean;
  currency_code: string;
}

export interface GalleryAlbum {
  id: string;
  name: string;
  cover_url: string | null;
  photo_count: number;
}

export interface MyGalleryPhoto {
  id: string;
  url: string;
  album_id: string | null;
  menu_item_id: string | null;
  guide_price: number | null;
  is_hidden: boolean;
  dish_title: string | null;
  dish_price: number | null;
  dish_currency: string | null;
  dish_active: boolean | null;
}

export interface MyGalleryAlbum {
  id: string;
  name: string;
  is_hidden: boolean;
  photo_count: number;
}

export interface MyDishPhoto {
  menu_item_id: string;
  title: string;
  url: string;
  price: number;
  currency_code: string;
}

export interface MyGallery {
  currency_code: string;
  albums: MyGalleryAlbum[];
  photos: MyGalleryPhoto[];
  dish_photos: MyDishPhoto[];
  limits: { max_photos: number; max_per_upload: number };
}

export interface AddPhotosBody {
  urls: { url: string; public_id?: string }[];
  album_name?: string;
  album_id?: string;
  menu_item_id?: string | null;
  guide_price?: number | null;
}

export const galleryApi = {
  forCook: (cookId: string) =>
    api.get<{ albums: GalleryAlbum[]; photos: GalleryPhoto[] }>(`/gallery/cook/${cookId}`),

  mine: () => api.get<MyGallery>('/gallery/me'),

  addPhotos: (body: AddPhotosBody) =>
    api.post<{ album_id: string | null; photos: { id: string }[] }>('/gallery/me/photos', body, { noRetry: true }),

  /** album_name creates a new album and moves the photo into it. */
  updatePhoto: (id: string, body: { menu_item_id?: string | null; guide_price?: number | null; album_id?: string | null; album_name?: string }) =>
    api.patch<{ photo: MyGalleryPhoto }>(`/gallery/me/photos/${id}`, body),

  deletePhoto: (id: string) => api.delete<{ ok: true }>(`/gallery/me/photos/${id}`),

  reorder: (photoIds: string[]) => api.put<{ ok: true }>('/gallery/me/order', { photo_ids: photoIds }),

  renameAlbum: (id: string, name: string) =>
    api.patch<{ album: { id: string; name: string } }>(`/gallery/me/albums/${id}`, { name }),

  deleteAlbum: (id: string) => api.delete<{ ok: true }>(`/gallery/me/albums/${id}`),

  report: (target: { album_id: string } | { photo_id: string }, reason: string) =>
    api.post<{ ok: true }>('/gallery/report', { ...target, reason }, { noRetry: true }),
};
