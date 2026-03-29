import type {
  RecorderQuestion,
  UploadCredentials,
  AdminVideoReview,
  VideoMediaType,
  SubmitReviewData,
  VideoReviewSubmitResult,
} from '../types.ts';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...(isFormData ? {} : { headers: { 'Content-Type': 'application/json' } }),
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

export async function initMediaUpload(
  subjectId: string,
  title: string,
  mediaType: VideoMediaType
): Promise<UploadCredentials> {
  return apiFetch<UploadCredentials>(`/stores/${subjectId}/media/init`, {
    method: 'POST',
    body: JSON.stringify({ title, mediaType }),
  });
}

export async function fetchRecorderQuestions(
  subjectId: string
): Promise<RecorderQuestion[]> {
  return apiFetch<RecorderQuestion[]>(`/stores/${subjectId}/recorder-questions`);
}

export async function stitchVideoClips(
  subjectId: string,
  clips: { blob: Blob; questionId: string }[],
  questions: { id: string; prompt: string }[],
  subjectName: string,
  title?: string
): Promise<{ mediaId: number; videoId: string; embedUrl: string; durationSeconds: number }> {
  const formData = new FormData();
  clips.forEach((clip, idx) => {
    formData.append('clips', clip.blob, `clip_${idx}.webm`);
  });

  const orderedQuestions = clips.map(clip => {
    const q = questions.find(q => q.id === clip.questionId);
    return { id: clip.questionId, prompt: q?.prompt || `Part ${clips.indexOf(clip) + 1}` };
  });

  formData.append('questions', JSON.stringify(orderedQuestions));
  formData.append('storeName', subjectName);
  if (title) formData.append('title', title);

  const res = await fetch(`${API_BASE}/stores/${subjectId}/media/stitch`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Video stitching failed');
  }
  return res.json();
}

export async function fetchAdminVideoReviews(): Promise<AdminVideoReview[]> {
  return apiFetch<AdminVideoReview[]>('/admin/media/video-reviews');
}

export async function moderateVideoReview(
  id: number,
  data: { moderationStatus?: string; contentRating?: string; moderationNotes?: string }
): Promise<AdminVideoReview> {
  return apiFetch<AdminVideoReview>(`/admin/media/${id}/moderate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminVideo(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/media/${id}`, { method: 'DELETE' });
}

export async function syncAllStuckVideos(): Promise<{
  checked: number;
  fixed: number;
  stillPending: number;
  failed: number;
  errors: Array<{ bunnyVideoId: string; error: string }>;
}> {
  return apiFetch('/admin/video-reviews/sync-all-stuck', { method: 'POST' });
}

export async function submitStoreReview(
  storeId: string,
  data: SubmitReviewData
): Promise<VideoReviewSubmitResult> {
  return apiFetch<VideoReviewSubmitResult>(`/stores/${storeId}/video-reviews`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
