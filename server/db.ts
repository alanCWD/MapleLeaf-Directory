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
    headerImageUrl: row.header_image_url || undefined,
    storeInsights: row.store_insights || null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
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

  conditions.push(`verification_status != 'rejected'`);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM stores ${where} ORDER BY 
    CASE WHEN verification_status = 'verified' THEN 0
         WHEN verification_status = 'ai_suggested' THEN 1
         ELSE 2 END,
    confidence_score DESC, name ASC`;
  const result = await pool.query(query, params);
  const rows = result.rows.map(snakeToCamel);

  const seen = new Map<string, Store>();
  for (const store of rows) {
    const key = store.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, store);
    }
  }
  return Array.from(seen.values());
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
      last_verified_at, header_image_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
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
      header_image_url = COALESCE(EXCLUDED.header_image_url, stores.header_image_url),
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
      store.headerImageUrl || null,
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
    headerImageUrl: 'header_image_url',
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

export interface AuditLog {
  id: number;
  adminUserId: string;
  adminEmail?: string;
  adminName?: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  details: Record<string, any>;
  createdAt: string;
}

function formatAuditLog(row: Record<string, any>): AuditLog {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email || undefined,
    adminName: row.admin_name || undefined,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name || undefined,
    details: row.details || {},
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
  };
}

export async function initAuditLogTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      admin_user_id VARCHAR(255) NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`);
  console.log('[DB] audit_logs table initialized');
}

export async function ensureHeaderImageColumn(): Promise<void> {
  await pool.query(`
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS header_image_url TEXT
  `);
  console.log('[DB] header_image_url column ensured');
}

export async function ensureUserProfileColumns(): Promise<void> {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_profile_image_url TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle)`);
  console.log('[DB] user profile columns ensured');
}

export async function createAuditLog(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, any> = {}
): Promise<AuditLog> {
  const result = await pool.query(
    `INSERT INTO audit_logs (admin_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [adminUserId, action, targetType, targetId, JSON.stringify(details)]
  );
  return formatAuditLog(result.rows[0]);
}

export async function getAuditLogs(filters: {
  storeId?: string;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.storeId) {
    conditions.push(`(a.target_id = $${idx} OR (a.target_type = 'claim' AND a.details->>'storeId' = $${idx}))`);
    params.push(filters.storeId);
    idx++;
  }
  if (filters.adminUserId) {
    conditions.push(`a.admin_user_id = $${idx++}`);
    params.push(filters.adminUserId);
  }
  if (filters.action) {
    conditions.push(`a.action = $${idx++}`);
    params.push(filters.action);
  }
  if (filters.targetType) {
    conditions.push(`a.target_type = $${idx++}`);
    params.push(filters.targetType);
  }
  if (filters.startDate) {
    conditions.push(`a.created_at >= $${idx++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`a.created_at <= $${idx++}`);
    params.push(filters.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = ((filters.page || 1) - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM audit_logs a ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const logsResult = await pool.query(
    `SELECT a.*, u.email as admin_email,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) as admin_name,
            s.name as target_name
     FROM audit_logs a
     LEFT JOIN users u ON a.admin_user_id = u.id
     LEFT JOIN stores s ON a.target_type = 'store' AND a.target_id = s.id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return {
    logs: logsResult.rows.map(formatAuditLog),
    total,
  };
}

export async function getAdminAllStores(filters: {
  status?: string;
  claimed?: string;
  search?: string;
  province?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ stores: Store[]; total: number; statusCounts: Record<string, number>; claimedCount: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`verification_status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.claimed === 'true') {
    conditions.push(`is_claimed = true`);
  } else if (filters.claimed === 'false') {
    conditions.push(`is_claimed = false`);
  }
  if (filters.province) {
    conditions.push(`province = $${idx++}`);
    params.push(filters.province);
  }
  if (filters.search) {
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(address) LIKE $${idx})`);
    params.push(`%${filters.search.toLowerCase()}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM stores ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const statusResult = await pool.query(
    `SELECT verification_status, COUNT(*) as cnt FROM stores GROUP BY verification_status`
  );
  const statusCounts: Record<string, number> = {};
  for (const row of statusResult.rows) {
    statusCounts[row.verification_status] = parseInt(row.cnt);
  }

  const claimedResult = await pool.query(`SELECT COUNT(*) FROM stores WHERE is_claimed = true`);
  const claimedCount = parseInt(claimedResult.rows[0].count);

  const allowedSorts: Record<string, string> = {
    name: 'name',
    updated_at: 'updated_at',
    confidence_score: 'confidence_score',
    flag_count: 'flag_count',
    verification_status: 'verification_status',
  };
  const sortCol = allowedSorts[filters.sortBy || ''] || 'updated_at';
  const sortDir = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const limit = filters.limit || 25;
  const offset = ((filters.page || 1) - 1) * limit;

  const storesResult = await pool.query(
    `SELECT * FROM stores ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return {
    stores: storesResult.rows.map(snakeToCamel),
    total,
    statusCounts,
    claimedCount,
  };
}

export async function adminUpdateStore(
  id: string,
  updates: Partial<Store>,
  adminUserId: string
): Promise<Store | null> {
  const existing = await getStoreById(id);
  if (!existing) return null;

  const changes: Record<string, { from: any; to: any }> = {};
  const trackFields = ['name', 'address', 'province', 'type', 'phone', 'website',
    'verificationStatus', 'adminNotes', 'featuredOfferings', 'isClaimed', 'headerImageUrl'] as const;
  
  for (const field of trackFields) {
    if (field in updates && JSON.stringify((updates as any)[field]) !== JSON.stringify((existing as any)[field])) {
      changes[field] = { from: (existing as any)[field], to: (updates as any)[field] };
    }
  }

  const updated = await updateStore(id, updates);

  if (Object.keys(changes).length > 0) {
    try {
      await createAuditLog(adminUserId, 'store_edited', 'store', id, {
        changes,
        storeName: existing.name,
      });
    } catch (auditErr) {
      console.error('Failed to write audit log:', auditErr);
    }
  }

  return updated;
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

export async function findStoreByNameOrAddress(name: string, address: string): Promise<Store | null> {
  const normalizedName = name.trim().toLowerCase();
  const normalizedAddress = address.trim().toLowerCase();
  const result = await pool.query(
    `SELECT * FROM stores 
     WHERE LOWER(TRIM(name)) = $1 OR LOWER(TRIM(address)) = $2
     ORDER BY 
       CASE WHEN verification_status = 'verified' THEN 0
            WHEN verification_status = 'ai_suggested' THEN 1
            ELSE 2 END
     LIMIT 1`,
    [normalizedName, normalizedAddress]
  );
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0]);
}

export async function searchStoresInDb(query: string): Promise<Store[]> {
  const searchTerms = query.trim().toLowerCase();
  
  const provinceMap: Record<string, string> = {
    'british columbia': 'British Columbia', 'bc': 'British Columbia',
    'alberta': 'Alberta', 'ab': 'Alberta',
    'saskatchewan': 'Saskatchewan', 'sk': 'Saskatchewan',
    'manitoba': 'Manitoba', 'mb': 'Manitoba',
    'ontario': 'Ontario', 'on': 'Ontario',
    'québec': 'Quebec', 'quebec': 'Quebec', 'qc': 'Quebec',
    'new brunswick': 'New Brunswick', 'nb': 'New Brunswick',
    'nova scotia': 'Nova Scotia', 'ns': 'Nova Scotia',
    'prince edward island': 'Prince Edward Island', 'pei': 'Prince Edward Island', 'pe': 'Prince Edward Island',
    'newfoundland and labrador': 'Newfoundland and Labrador', 'newfoundland': 'Newfoundland and Labrador', 'nl': 'Newfoundland and Labrador',
    'northwest territories': 'Northwest Territories', 'nwt': 'Northwest Territories', 'nt': 'Northwest Territories',
    'nunavut': 'Nunavut', 'nu': 'Nunavut',
    'yukon': 'Yukon', 'yt': 'Yukon',
  };

  // Sort keys longest-first so multi-word provinces match before abbreviations
  const sortedProvinceKeys = Object.keys(provinceMap).sort((a, b) => b.length - a.length);

  let matchedProvince: string | null = null;
  let remainingTerms = searchTerms;

  for (const key of sortedProvinceKeys) {
    if (searchTerms.includes(key)) {
      matchedProvince = provinceMap[key];
      // Strip the province keyword from remaining terms to isolate the city/name portion
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      remainingTerms = remainingTerms.replace(new RegExp(escaped, 'g'), '');
      break;
    }
  }

  // Clean up: remove commas, extra whitespace left after stripping province
  remainingTerms = remainingTerms.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

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
    if (remainingTerms.includes(key)) {
      matchedType = value;
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      remainingTerms = remainingTerms.replace(new RegExp(escaped, 'g'), '').trim();
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

  // Only apply text filter if there are meaningful city/name terms left after stripping province/type
  if (remainingTerms.length > 0) {
    const likeParam = `%${remainingTerms}%`;
    // For address matching, use regex to match the term as a city (start of address or after a comma),
    // not as part of a street name like "123 Victoria St". This prevents false positives like
    // a store on "Victoria St, Kamloops" appearing in a "Victoria, BC" search.
    const cityRegex = `(^|,\\s*)${remainingTerms.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    conditions.push(`(
      LOWER(name) LIKE $${idx} OR 
      LOWER(address) ~* $${idx + 1} OR
      LOWER(COALESCE(array_to_string(featured_offerings, ' '), '')) LIKE $${idx}
    )`);
    params.push(likeParam);
    params.push(cityRegex);
    idx += 2;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const sql = `SELECT * FROM stores ${where} ORDER BY 
    CASE WHEN verification_status = 'verified' THEN 0 
         WHEN verification_status = 'ai_suggested' THEN 1 
         ELSE 2 END,
    confidence_score DESC, name ASC
    LIMIT 50`;

  const result = await pool.query(sql, params);
  const rows = result.rows.map(snakeToCamel);

  const seen = new Map<string, Store>();
  for (const store of rows) {
    const key = store.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, store);
    } else {
      const existing = seen.get(key)!;
      const rank = (s: Store) => {
        if (s.verificationStatus === 'verified') return 2;
        if (s.verificationStatus === 'ai_suggested') return 1;
        return 0;
      };
      if (rank(store) > rank(existing) || (rank(store) === rank(existing) && (store.confidenceScore || 0) > (existing.confidenceScore || 0))) {
        seen.set(key, store);
      }
    }
  }
  return Array.from(seen.values());
}

export { pool };
