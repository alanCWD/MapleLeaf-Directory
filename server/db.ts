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
  };

  for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
    if (jsKey in updates) {
      const val = (updates as any)[jsKey];
      if (dbKey === 'hours' || dbKey === 'reviews' || dbKey === 'evidence_sources') {
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

export { pool };
