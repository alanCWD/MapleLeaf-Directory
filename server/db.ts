import pg from 'pg';
import type { Store, StoreFlag } from '../types';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

function snakeToCamel(row: Record<string, any>): Store {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    province: row.province,
    address: row.address,
    rating: row.rating ? parseFloat(row.rating) : undefined,
    featuredOfferings: row.featured_offerings || [],
    isClaimed: row.is_claimed ?? false,
    googlePlaceId: row.google_place_id || undefined,
    phone: row.phone || undefined,
    website: row.website || undefined,
    sourceUrl: row.source_url || undefined,
    reviews: row.reviews || [],
    hours: row.hours || [],
    verificationStatus: row.verification_status,
    confidenceScore: row.confidence_score ? parseFloat(row.confidence_score) : 0,
    evidenceSources: row.evidence_sources || [],
    evidenceCount: row.evidence_count ?? 0,
    flagCount: row.flag_count ?? 0,
    adminReviewed: row.admin_reviewed ?? false,
    adminNotes: row.admin_notes || undefined,
    lat: row.lat ? parseFloat(row.lat) : undefined,
    lng: row.lng ? parseFloat(row.lng) : undefined,
    placesApiMatch: row.places_api_match ?? false,
    placesCategory: row.places_category || undefined,
    lastVerifiedAt: row.last_verified_at ? row.last_verified_at.toISOString() : undefined,
    storeInsights: row.store_insights || null,
  };
}

function flagSnakeToCamel(row: Record<string, any>): StoreFlag {
  return {
    id: row.id,
    storeId: row.store_id,
    reason: row.reason,
    comment: row.comment || undefined,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
  };
}

export async function getAllStores(filters: {
  province?: string;
  type?: string;
  verificationStatus?: string;
  hideUnverified?: boolean;
}): Promise<Store[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.province) {
    conditions.push(`province = $${idx++}`);
    params.push(filters.province);
  }
  if (filters.type) {
    conditions.push(`type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.verificationStatus) {
    conditions.push(`verification_status = $${idx++}`);
    params.push(filters.verificationStatus);
  }
  if (filters.hideUnverified) {
    conditions.push(`(verification_status != 'ai_suggested')`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM stores ${where} ORDER BY name ASC`;
  const result = await pool.query(query, params);
  return result.rows.map(snakeToCamel);
}

export async function getStoreById(id: string): Promise<Store | null> {
  const result = await pool.query('SELECT * FROM stores WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0]);
}

export async function upsertStore(store: Partial<Store>): Promise<Store> {
  const id = store.id || `${(store.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

  const result = await pool.query(
    `INSERT INTO stores (
      id, name, type, province, address, rating, featured_offerings,
      is_claimed, google_place_id, phone, website, source_url,
      hours, reviews, verification_status, confidence_score,
      evidence_sources, evidence_count, flag_count, admin_reviewed,
      admin_notes, lat, lng, places_api_match, places_category,
      last_verified_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, stores.name),
      type = COALESCE(EXCLUDED.type, stores.type),
      province = COALESCE(EXCLUDED.province, stores.province),
      address = COALESCE(EXCLUDED.address, stores.address),
      rating = COALESCE(EXCLUDED.rating, stores.rating),
      featured_offerings = COALESCE(EXCLUDED.featured_offerings, stores.featured_offerings),
      is_claimed = COALESCE(EXCLUDED.is_claimed, stores.is_claimed),
      google_place_id = COALESCE(EXCLUDED.google_place_id, stores.google_place_id),
      phone = COALESCE(EXCLUDED.phone, stores.phone),
      website = COALESCE(EXCLUDED.website, stores.website),
      source_url = COALESCE(EXCLUDED.source_url, stores.source_url),
      hours = COALESCE(EXCLUDED.hours, stores.hours),
      reviews = COALESCE(EXCLUDED.reviews, stores.reviews),
      verification_status = COALESCE(EXCLUDED.verification_status, stores.verification_status),
      confidence_score = COALESCE(EXCLUDED.confidence_score, stores.confidence_score),
      evidence_sources = COALESCE(EXCLUDED.evidence_sources, stores.evidence_sources),
      evidence_count = COALESCE(EXCLUDED.evidence_count, stores.evidence_count),
      admin_reviewed = COALESCE(EXCLUDED.admin_reviewed, stores.admin_reviewed),
      admin_notes = COALESCE(EXCLUDED.admin_notes, stores.admin_notes),
      lat = COALESCE(EXCLUDED.lat, stores.lat),
      lng = COALESCE(EXCLUDED.lng, stores.lng),
      places_api_match = COALESCE(EXCLUDED.places_api_match, stores.places_api_match),
      places_category = COALESCE(EXCLUDED.places_category, stores.places_category),
      last_verified_at = COALESCE(EXCLUDED.last_verified_at, stores.last_verified_at),
      updated_at = now()
    RETURNING *`,
    [
      id,
      store.name || 'Unknown',
      store.type || 'Local Gem',
      store.province || 'Ontario',
      store.address || '',
      store.rating ?? 4.0,
      store.featuredOfferings || [],
      store.isClaimed ?? false,
      store.googlePlaceId || null,
      store.phone || null,
      store.website || null,
      store.sourceUrl || null,
      JSON.stringify(store.hours || []),
      JSON.stringify(store.reviews || []),
      store.verificationStatus || 'ai_suggested',
      store.confidenceScore ?? 0,
      JSON.stringify(store.evidenceSources || []),
      store.evidenceCount ?? 0,
      store.flagCount ?? 0,
      store.adminReviewed ?? false,
      store.adminNotes || null,
      store.lat || null,
      store.lng || null,
      store.placesApiMatch ?? false,
      store.placesCategory || null,
      store.lastVerifiedAt || null,
    ]
  );

  return snakeToCamel(result.rows[0]);
}

export async function updateStore(id: string, updates: Partial<Store>): Promise<Store | null> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    type: 'type',
    province: 'province',
    address: 'address',
    rating: 'rating',
    featuredOfferings: 'featured_offerings',
    isClaimed: 'is_claimed',
    googlePlaceId: 'google_place_id',
    phone: 'phone',
    website: 'website',
    sourceUrl: 'source_url',
    hours: 'hours',
    reviews: 'reviews',
    verificationStatus: 'verification_status',
    confidenceScore: 'confidence_score',
    evidenceSources: 'evidence_sources',
    evidenceCount: 'evidence_count',
    flagCount: 'flag_count',
    adminReviewed: 'admin_reviewed',
    adminNotes: 'admin_notes',
    lat: 'lat',
    lng: 'lng',
    placesApiMatch: 'places_api_match',
    placesCategory: 'places_category',
    lastVerifiedAt: 'last_verified_at',
    storeInsights: 'store_insights',
  };

  for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
    if (jsKey in updates) {
      const val = (updates as any)[jsKey];
      if (dbKey === 'hours' || dbKey === 'reviews' || dbKey === 'evidence_sources' || dbKey === 'store_insights') {
        setClauses.push(`${dbKey} = $${idx++}`);
        params.push(JSON.stringify(val));
      } else if (dbKey === 'featured_offerings') {
        setClauses.push(`${dbKey} = $${idx++}`);
        params.push(val || []);
      } else {
        setClauses.push(`${dbKey} = $${idx++}`);
        params.push(val);
      }
    }
  }

  if (setClauses.length === 0) return getStoreById(id);

  setClauses.push('updated_at = now()');
  params.push(id);

  const query = `UPDATE stores SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0]);
}

export async function addFlag(storeId: string, reason: string, comment?: string): Promise<StoreFlag> {
  const result = await pool.query(
    `INSERT INTO store_flags (store_id, reason, comment) VALUES ($1, $2, $3) RETURNING *`,
    [storeId, reason, comment || null]
  );

  await pool.query(
    `UPDATE stores SET flag_count = flag_count + 1, updated_at = now() WHERE id = $1`,
    [storeId]
  );

  return flagSnakeToCamel(result.rows[0]);
}

export async function getFlags(storeId: string): Promise<StoreFlag[]> {
  const result = await pool.query(
    `SELECT * FROM store_flags WHERE store_id = $1 ORDER BY created_at DESC`,
    [storeId]
  );
  return result.rows.map(flagSnakeToCamel);
}

export async function getReviewQueue(): Promise<Store[]> {
  const result = await pool.query(
    `SELECT * FROM stores 
     WHERE admin_reviewed = false 
       AND (confidence_score < 0.6 OR flag_count > 0)
     ORDER BY flag_count DESC, confidence_score ASC`
  );
  return result.rows.map(snakeToCamel);
}

export async function adminReview(
  id: string,
  action: 'approve' | 'reject' | 'mark_closed',
  notes?: string
): Promise<Store | null> {
  let status: string;
  switch (action) {
    case 'approve':
      status = 'verified';
      break;
    case 'reject':
      status = 'rejected';
      break;
    case 'mark_closed':
      status = 'historically_closed';
      break;
    default:
      status = 'ai_suggested';
  }

  const result = await pool.query(
    `UPDATE stores SET 
      verification_status = $1,
      admin_reviewed = true,
      admin_notes = $2,
      updated_at = now()
     WHERE id = $3 RETURNING *`,
    [status, notes || null, id]
  );

  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0]);
}

export async function seedStoresFromFile(): Promise<number> {
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM stores');
  const existingCount = parseInt(count);
  
  if (existingCount >= 200) {
    console.log(`[Seed] Database already has ${existingCount} stores, skipping seed.`);
    return 0;
  }

  console.log(`[Seed] Database has only ${existingCount} stores. Seeding from backup...`);
  
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const currentDir = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.join(currentDir, 'seed_stores.json');
  
  if (!fs.existsSync(seedPath)) {
    console.log('[Seed] No seed file found at', seedPath);
    return 0;
  }

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  let imported = 0;

  for (const store of seedData) {
    try {
      await pool.query(
        `INSERT INTO stores (
          id, name, type, province, address, rating, featured_offerings,
          is_claimed, google_place_id, phone, website, source_url,
          hours, reviews, verification_status, confidence_score,
          evidence_sources, evidence_count, flag_count, admin_reviewed,
          admin_notes, lat, lng, places_api_match, places_category,
          last_verified_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
        ON CONFLICT (id) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, stores.name),
          type = COALESCE(EXCLUDED.type, stores.type),
          province = COALESCE(EXCLUDED.province, stores.province),
          address = COALESCE(EXCLUDED.address, stores.address),
          rating = COALESCE(EXCLUDED.rating, stores.rating),
          featured_offerings = COALESCE(EXCLUDED.featured_offerings, stores.featured_offerings),
          is_claimed = COALESCE(EXCLUDED.is_claimed, stores.is_claimed),
          google_place_id = COALESCE(EXCLUDED.google_place_id, stores.google_place_id),
          phone = COALESCE(EXCLUDED.phone, stores.phone),
          website = COALESCE(EXCLUDED.website, stores.website),
          source_url = COALESCE(EXCLUDED.source_url, stores.source_url),
          hours = COALESCE(EXCLUDED.hours, stores.hours),
          reviews = COALESCE(EXCLUDED.reviews, stores.reviews),
          verification_status = COALESCE(EXCLUDED.verification_status, stores.verification_status),
          confidence_score = COALESCE(EXCLUDED.confidence_score, stores.confidence_score),
          evidence_sources = COALESCE(EXCLUDED.evidence_sources, stores.evidence_sources),
          evidence_count = COALESCE(EXCLUDED.evidence_count, stores.evidence_count),
          flag_count = COALESCE(EXCLUDED.flag_count, stores.flag_count),
          admin_reviewed = COALESCE(EXCLUDED.admin_reviewed, stores.admin_reviewed),
          admin_notes = COALESCE(EXCLUDED.admin_notes, stores.admin_notes),
          lat = COALESCE(EXCLUDED.lat, stores.lat),
          lng = COALESCE(EXCLUDED.lng, stores.lng),
          places_api_match = COALESCE(EXCLUDED.places_api_match, stores.places_api_match),
          places_category = COALESCE(EXCLUDED.places_category, stores.places_category),
          last_verified_at = COALESCE(EXCLUDED.last_verified_at, stores.last_verified_at)`,
        [
          store.id, store.name, store.type, store.province, store.address,
          store.rating, store.featured_offerings, store.is_claimed,
          store.google_place_id, store.phone, store.website, store.source_url,
          store.hours ? JSON.stringify(store.hours) : '[]',
          store.reviews ? JSON.stringify(store.reviews) : '[]',
          store.verification_status, store.confidence_score,
          store.evidence_sources ? JSON.stringify(store.evidence_sources) : '[]',
          store.evidence_count, store.flag_count, store.admin_reviewed,
          store.admin_notes, store.lat, store.lng, store.places_api_match,
          store.places_category, store.last_verified_at
        ]
      );
      imported++;
    } catch (err: any) {
      console.error(`[Seed] Error importing store ${store.id}:`, err.message);
    }
  }

  console.log(`[Seed] Successfully imported ${imported} stores.`);
  return imported;
}

export async function searchStoresInDb(query: string): Promise<Store[]> {
  const searchTerms = query.trim().toLowerCase();
  
  const provinceMap: Record<string, string> = {
    'bc': 'British Columbia', 'british columbia': 'British Columbia',
    'ab': 'Alberta', 'alberta': 'Alberta',
    'sk': 'Saskatchewan', 'saskatchewan': 'Saskatchewan',
    'mb': 'Manitoba', 'manitoba': 'Manitoba',
    'on': 'Ontario', 'ontario': 'Ontario',
    'qc': 'Quebec', 'quebec': 'Quebec', 'québec': 'Quebec',
    'nb': 'New Brunswick', 'new brunswick': 'New Brunswick',
    'ns': 'Nova Scotia', 'nova scotia': 'Nova Scotia',
    'pe': 'Prince Edward Island', 'prince edward island': 'Prince Edward Island', 'pei': 'Prince Edward Island',
    'nl': 'Newfoundland and Labrador', 'newfoundland': 'Newfoundland and Labrador', 'newfoundland and labrador': 'Newfoundland and Labrador',
    'nt': 'Northwest Territories', 'northwest territories': 'Northwest Territories', 'nwt': 'Northwest Territories',
    'nu': 'Nunavut', 'nunavut': 'Nunavut',
    'yt': 'Yukon', 'yukon': 'Yukon',
  };

  let matchedProvince: string | null = null;
  for (const [key, value] of Object.entries(provinceMap)) {
    if (searchTerms.includes(key)) {
      matchedProvince = value;
      break;
    }
  }

  const typeKeywords: Record<string, string> = {
    'sovereign': 'Sovereign',
    'indigenous': 'Sovereign',
    'first nations': 'Sovereign',
    'trading post': 'Sovereign',
    'local gem': 'Local Gem',
    'independent': 'Local Gem',
  };

  let matchedType: string | null = null;
  for (const [key, value] of Object.entries(typeKeywords)) {
    if (searchTerms.includes(key)) {
      matchedType = value;
      break;
    }
  }

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  conditions.push(`verification_status != 'rejected'`);

  if (matchedProvince) {
    conditions.push(`province = $${idx++}`);
    params.push(matchedProvince);
  }

  if (matchedType) {
    conditions.push(`type = $${idx++}`);
    params.push(matchedType);
  }

  const likeParam = `%${searchTerms}%`;
  conditions.push(`(
    LOWER(name) LIKE $${idx} OR 
    LOWER(address) LIKE $${idx} OR 
    LOWER(province) LIKE $${idx} OR
    LOWER(COALESCE(array_to_string(featured_offerings, ' '), '')) LIKE $${idx}
    ${matchedProvince ? ` OR province = $${idx - (matchedType ? 2 : 1)}` : ''}
  )`);
  params.push(likeParam);

  const where = `WHERE ${conditions.join(' AND ')}`;
  const sql = `SELECT * FROM stores ${where} ORDER BY 
    CASE WHEN verification_status = 'verified' THEN 0 
         WHEN verification_status = 'ai_suggested' THEN 1 
         ELSE 2 END,
    confidence_score DESC, name ASC
    LIMIT 50`;

  const result = await pool.query(sql, params);
  return result.rows.map(snakeToCamel);
}

import type { StoreMedia, MediaStatus } from '../types';

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

export async function ensureMediaTable(): Promise<void> {
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

export { pool };
