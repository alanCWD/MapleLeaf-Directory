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
    : row.trust_weight || { base: 0.5, videoBonus: 0, scoutBonus: 0, geoDeviation: 0, presenceBonus: 0, final: 0.5 };

  const disapproved = row.moderation_status === 'disapproved';

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
    embedUrl: disapproved ? null : (row.embed_url || null),
    thumbnailUrl: disapproved ? null : (row.thumbnail_url || null),
    contentRating: row.content_rating || 'clean',
    moderationStatus: row.moderation_status || 'approved',
    reviewerHandle: row.reviewer_handle || null,
    reviewerAvatarUrl: row.reviewer_avatar_url || null,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(500) NOT NULL,
      badge_type VARCHAR(50) NOT NULL,
      awarded_at TIMESTAMP DEFAULT NOW(),
      metadata JSONB,
      UNIQUE(user_id, badge_type)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_badges_type ON user_badges(badge_type)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS presence_qr_codes (
      id SERIAL PRIMARY KEY,
      store_id VARCHAR(500) NOT NULL,
      code_secret VARCHAR(255) NOT NULL UNIQUE,
      rotation_epoch INTEGER NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_presence_qr_codes_store ON presence_qr_codes(store_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS presence_checkins (
      id SERIAL PRIMARY KEY,
      store_id VARCHAR(500) NOT NULL,
      user_id VARCHAR(500) NOT NULL,
      qr_code_id INTEGER REFERENCES presence_qr_codes(id),
      verified_at TIMESTAMP DEFAULT NOW(),
      lat NUMERIC,
      lng NUMERIC,
      distance_meters NUMERIC,
      geo_verified BOOLEAN DEFAULT false,
      qr_valid BOOLEAN DEFAULT false,
      verified BOOLEAN DEFAULT false,
      method VARCHAR(50) DEFAULT 'qr+geo'
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_presence_checkins_store ON presence_checkins(store_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_presence_checkins_user ON presence_checkins(user_id)
  `);

  await pool.query(`
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS bc_region VARCHAR(100)
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE store_media ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(50) DEFAULT 'approved'
  `);
  await pool.query(`
    ALTER TABLE store_media ADD COLUMN IF NOT EXISTS content_rating VARCHAR(20) DEFAULT 'clean'
  `);
  await pool.query(`
    ALTER TABLE store_media ADD COLUMN IF NOT EXISTS moderation_notes TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS creator_posts (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(500) NOT NULL,
      store_id VARCHAR(500),
      title VARCHAR(500) NOT NULL,
      subtitle VARCHAR(500),
      body_text TEXT,
      content_tier VARCHAR(20) NOT NULL DEFAULT 'clean',
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      moderation_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_creator_posts_user ON creator_posts(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_creator_posts_store ON creator_posts(store_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_creator_posts_status ON creator_posts(status)`);
  try {
    await pool.query(`ALTER TABLE creator_posts ADD CONSTRAINT fk_creator_posts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL`);
  } catch {
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_media (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      media_type VARCHAR(20) NOT NULL DEFAULT 'image',
      bunny_id VARCHAR(255),
      cdn_url TEXT NOT NULL,
      caption VARCHAR(500),
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id)`);

  console.log('[IntegrityEngine] creator_posts & post_media tables ensured');
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
    `SELECT * FROM store_media WHERE store_id = $1 AND media_type != 'review' ORDER BY created_at DESC`,
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
    `SELECT ir.*,
            u.handle as reviewer_handle,
            COALESCE(u.custom_profile_image_url, u.profile_image_url) as reviewer_avatar_url
     FROM integrity_reviews ir
     LEFT JOIN users u ON ir.user_id = u.id
     WHERE ir.store_id = $1
     ORDER BY ir.created_at DESC`,
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
  const review = reviewSnakeToCamel(result.rows[0]);

  import('./badges').then(({ evaluateUserBadges }) => {
    evaluateUserBadges(review.userId).catch((err: any) =>
      console.error('[Badges] Error evaluating badges after flag:', err)
    );
  });

  return review;
}

export interface UserBadge {
  id: number;
  userId: string;
  badgeType: string;
  awardedAt: string;
  metadata: Record<string, any> | null;
}

function badgeSnakeToCamel(row: Record<string, any>): UserBadge {
  return {
    id: row.id,
    userId: row.user_id,
    badgeType: row.badge_type,
    awardedAt: row.awarded_at ? row.awarded_at.toISOString() : new Date().toISOString(),
    metadata: row.metadata || null,
  };
}

export async function awardBadge(
  userId: string,
  badgeType: string,
  metadata?: Record<string, any>
): Promise<UserBadge> {
  const result = await pool.query(
    `INSERT INTO user_badges (user_id, badge_type, metadata)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, badge_type) DO UPDATE SET metadata = $3, awarded_at = NOW()
     RETURNING *`,
    [userId, badgeType, metadata ? JSON.stringify(metadata) : null]
  );
  return badgeSnakeToCamel(result.rows[0]);
}

export async function revokeBadge(userId: string, badgeType: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM user_badges WHERE user_id = $1 AND badge_type = $2`,
    [userId, badgeType]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const result = await pool.query(
    `SELECT * FROM user_badges WHERE user_id = $1 ORDER BY awarded_at DESC`,
    [userId]
  );
  return result.rows.map(badgeSnakeToCamel);
}

export async function getUsersWithBadge(badgeType: string): Promise<UserBadge[]> {
  const result = await pool.query(
    `SELECT * FROM user_badges WHERE badge_type = $1 ORDER BY awarded_at DESC`,
    [badgeType]
  );
  return result.rows.map(badgeSnakeToCamel);
}

export async function getReviewsWithBadges(storeId: string): Promise<(WeightedReview & { reviewerBadges: UserBadge[] })[]> {
  const reviews = await pool.query(
    `SELECT ir.*, sm.embed_url, sm.thumbnail_url, sm.moderation_status, sm.content_rating,
            u.handle as reviewer_handle,
            COALESCE(u.custom_profile_image_url, u.profile_image_url) as reviewer_avatar_url
     FROM integrity_reviews ir
     LEFT JOIN store_media sm ON sm.id = ir.video_asset_id
     LEFT JOIN users u ON ir.user_id = u.id
     WHERE ir.store_id = $1
     ORDER BY ir.created_at DESC`,
    [storeId]
  );

  const userIds = [...new Set(reviews.rows.map((r: any) => r.user_id))];

  let badgesByUser: Record<string, UserBadge[]> = {};
  if (userIds.length > 0) {
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const badgeResult = await pool.query(
      `SELECT * FROM user_badges WHERE user_id IN (${placeholders}) ORDER BY awarded_at DESC`,
      userIds
    );
    for (const row of badgeResult.rows) {
      const badge = badgeSnakeToCamel(row);
      if (!badgesByUser[badge.userId]) badgesByUser[badge.userId] = [];
      badgesByUser[badge.userId].push(badge);
    }
  }

  return reviews.rows.map((row: any) => ({
    ...reviewSnakeToCamel(row),
    reviewerBadges: badgesByUser[row.user_id] || [],
  }));
}

export async function updateMediaModeration(
  id: number,
  data: { moderationStatus?: string; contentRating?: string; moderationNotes?: string }
): Promise<(StoreMedia & { moderationStatus: string; contentRating: string; moderationNotes: string | null }) | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [id];
  let idx = 2;

  if (data.moderationStatus !== undefined) {
    setClauses.push(`moderation_status = $${idx++}`);
    params.push(data.moderationStatus);
  }
  if (data.contentRating !== undefined) {
    setClauses.push(`content_rating = $${idx++}`);
    params.push(data.contentRating);
  }
  if (data.moderationNotes !== undefined) {
    setClauses.push(`moderation_notes = $${idx++}`);
    params.push(data.moderationNotes);
  }

  const result = await pool.query(
    `UPDATE store_media SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...mediaSnakeToCamel(row),
    moderationStatus: row.moderation_status || 'approved',
    contentRating: row.content_rating || 'clean',
    moderationNotes: row.moderation_notes || null,
  };
}

function deriveStreamThumbnail(embedUrl: string | null, thumbnailUrl: string | null): string | null {
  if (thumbnailUrl) return thumbnailUrl;
  if (!embedUrl) return null;
  try {
    const match = embedUrl.match(/\/embed\/\d+\/([a-f0-9-]+)/);
    if (match) {
      const videoId = match[1];
      const hostname = process.env.BUNNY_CDN_HOSTNAME || `vz-${process.env.BUNNY_STREAM_LIBRARY_ID}.b-cdn.net`;
      return `https://${hostname}/${videoId}/thumbnail.jpg`;
    }
  } catch {}
  return null;
}

export async function getVideoReviews(): Promise<any[]> {
  const result = await pool.query(
    `SELECT sm.*, s.name AS store_name,
            ir.content_text AS review_text, ir.rating AS review_rating,
            ir.user_id AS reviewer_id, ir.created_at AS review_created_at,
            top_badge.badge_type AS reviewer_badge_type
     FROM store_media sm
     LEFT JOIN stores s ON s.id = sm.store_id
     LEFT JOIN integrity_reviews ir ON ir.video_asset_id = sm.id
     LEFT JOIN LATERAL (
       SELECT badge_type FROM user_badges
       WHERE user_id = COALESCE(ir.user_id, sm.user_id)
       ORDER BY CASE badge_type
         WHEN 'founding_bc_architect' THEN 7
         WHEN 'bc_culture_guide' THEN 6
         WHEN 'provincial_connector' THEN 5
         WHEN 'cross_region_contributor' THEN 4
         WHEN 'regional_builder' THEN 3
         WHEN 'local_scout' THEN 2
         ELSE 1
       END DESC LIMIT 1
     ) top_badge ON true
     WHERE sm.media_type = 'review'
     ORDER BY sm.created_at DESC`
  );
  return result.rows.map(row => ({
    ...mediaSnakeToCamel(row),
    storeName: row.store_name || null,
    moderationStatus: row.moderation_status || 'approved',
    contentRating: row.content_rating || 'clean',
    moderationNotes: row.moderation_notes || null,
    reviewText: row.review_text || null,
    reviewRating: row.review_rating ? parseFloat(row.review_rating) : null,
    reviewerId: row.reviewer_id || row.user_id || null,
    reviewerBadge: row.reviewer_badge_type || null,
    reviewCreatedAt: row.review_created_at ? row.review_created_at.toISOString() : null,
    thumbnailUrl: deriveStreamThumbnail(row.embed_url, row.thumbnail_url),
  }));
}
