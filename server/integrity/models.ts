import { pool } from '../db';
import type { StoreMedia, MediaStatus } from '../../types';
import type { WeightedReview, TrustWeight } from './types';

function mediaSnakeToCamel(row: Record<string, any>): StoreMedia {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    bunnyVideoId: row.bunny_video_id,
    bunnyLibraryId: row.bunny_library_id,
    title: row.title,
    description: row.description || null,
    status: row.status,
    thumbnailUrl: row.thumbnail_url || null,
    embedUrl: row.embed_url || null,
    mediaType: row.media_type,
    durationSeconds: row.duration_seconds ? parseInt(row.duration_seconds) : null,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
  };
}

function reviewSnakeToCamel(row: Record<string, any>): WeightedReview {
  const trustWeight: TrustWeight = typeof row.trust_weight === 'string'
    ? JSON.parse(row.trust_weight)
    : row.trust_weight || { base: 0.5, videoBonus: 0, scoutBonus: 0, geoDeviation: 0, final: 0.5 };

  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    rating: parseFloat(row.rating),
    contentText: row.content_text || '',
    videoAssetId: row.video_asset_id || null,
    trustWeight,
    hasVerifiedVideo: row.has_verified_video ?? false,
    isFlagged: row.is_flagged ?? false,
    disclosures: row.disclosures || null,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
  };
}

export async function ensureIntegrityTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_media (
      id SERIAL PRIMARY KEY,
      store_id VARCHAR(500) NOT NULL,
      user_id VARCHAR(500),
      bunny_video_id VARCHAR(255) NOT NULL,
      bunny_library_id VARCHAR(255) NOT NULL,
      title VARCHAR(500),
      description TEXT,
      status VARCHAR(50) DEFAULT 'uploading',
      thumbnail_url TEXT,
      embed_url TEXT,
      media_type VARCHAR(50) DEFAULT 'video',
      duration_seconds INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS integrity_reviews (
      id SERIAL PRIMARY KEY,
      store_id VARCHAR(500) NOT NULL,
      user_id VARCHAR(500) NOT NULL,
      rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
      content_text TEXT,
      video_asset_id INTEGER REFERENCES store_media(id) ON DELETE SET NULL,
      trust_weight JSONB NOT NULL,
      has_verified_video BOOLEAN DEFAULT false,
      is_flagged BOOLEAN DEFAULT false,
      disclosures JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_integrity_reviews_store ON integrity_reviews(store_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_integrity_reviews_user ON integrity_reviews(user_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_store_media_store ON store_media(store_id)
  `);
}

export async function createStoreMedia(data: {
  storeId: string;
  userId: string | null;
  bunnyVideoId: string;
  bunnyLibraryId: string;
  title: string;
  description?: string;
  status?: MediaStatus;
  thumbnailUrl?: string;
  embedUrl?: string;
  mediaType?: string;
}): Promise<StoreMedia> {
  const result = await pool.query(
    `INSERT INTO store_media (store_id, user_id, bunny_video_id, bunny_library_id, title, description, status, thumbnail_url, embed_url, media_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      data.storeId,
      data.userId || null,
      data.bunnyVideoId,
      data.bunnyLibraryId,
      data.title,
      data.description || null,
      data.status || 'uploading',
      data.thumbnailUrl || null,
      data.embedUrl || null,
      data.mediaType || 'video',
    ]
  );
  return mediaSnakeToCamel(result.rows[0]);
}

export async function getStoreMedia(storeId: string): Promise<StoreMedia[]> {
  const result = await pool.query(
    `SELECT * FROM store_media WHERE store_id = $1 ORDER BY created_at DESC`,
    [storeId]
  );
  return result.rows.map(mediaSnakeToCamel);
}

export async function getMediaById(id: number): Promise<StoreMedia | null> {
  const result = await pool.query(`SELECT * FROM store_media WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mediaSnakeToCamel(result.rows[0]);
}

export async function updateMediaStatus(
  bunnyVideoId: string,
  status: MediaStatus,
  extras?: { thumbnailUrl?: string; embedUrl?: string; durationSeconds?: number }
): Promise<StoreMedia | null> {
  const setClauses = ['status = $2', 'updated_at = NOW()'];
  const params: any[] = [bunnyVideoId, status];
  let idx = 3;

  if (extras?.thumbnailUrl) {
    setClauses.push(`thumbnail_url = $${idx++}`);
    params.push(extras.thumbnailUrl);
  }
  if (extras?.embedUrl) {
    setClauses.push(`embed_url = $${idx++}`);
    params.push(extras.embedUrl);
  }
  if (extras?.durationSeconds != null) {
    setClauses.push(`duration_seconds = $${idx++}`);
    params.push(extras.durationSeconds);
  }

  const result = await pool.query(
    `UPDATE store_media SET ${setClauses.join(', ')} WHERE bunny_video_id = $1 RETURNING *`,
    params
  );
  if (result.rows.length === 0) return null;
  return mediaSnakeToCamel(result.rows[0]);
}

export async function deleteStoreMedia(id: number): Promise<boolean> {
  const result = await pool.query(`DELETE FROM store_media WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function createReview(data: {
  storeId: string;
  userId: string;
  rating: number;
  contentText: string;
  videoAssetId?: number;
  trustWeight: TrustWeight;
  hasVerifiedVideo: boolean;
  disclosures?: Record<string, any>;
}): Promise<WeightedReview> {
  const result = await pool.query(
    `INSERT INTO integrity_reviews (store_id, user_id, rating, content_text, video_asset_id, trust_weight, has_verified_video, disclosures)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.storeId,
      data.userId,
      data.rating,
      data.contentText,
      data.videoAssetId || null,
      JSON.stringify(data.trustWeight),
      data.hasVerifiedVideo,
      data.disclosures ? JSON.stringify(data.disclosures) : null,
    ]
  );
  return reviewSnakeToCamel(result.rows[0]);
}

export async function getReviewsByStore(storeId: string): Promise<WeightedReview[]> {
  const result = await pool.query(
    `SELECT * FROM integrity_reviews WHERE store_id = $1 ORDER BY created_at DESC`,
    [storeId]
  );
  return result.rows.map(reviewSnakeToCamel);
}

export async function getReviewsByUser(userId: string): Promise<WeightedReview[]> {
  const result = await pool.query(
    `SELECT * FROM integrity_reviews WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(reviewSnakeToCamel);
}

export async function flagReview(reviewId: number, flagged: boolean = true): Promise<WeightedReview | null> {
  const result = await pool.query(
    `UPDATE integrity_reviews SET is_flagged = $2 WHERE id = $1 RETURNING *`,
    [reviewId, flagged]
  );
  if (result.rows.length === 0) return null;
  return reviewSnakeToCamel(result.rows[0]);
}
