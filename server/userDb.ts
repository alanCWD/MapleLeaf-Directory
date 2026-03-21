import { pool } from './db.ts';

export interface UserFavorite {
  userId: string;
  storeId: string;
  createdAt: string;
}

export interface StoreClaim {
  id: number;
  userId: string;
  storeId: string;
  status: string;
  message: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getUserFavorites(userId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT store_id FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows.map((r: any) => r.store_id);
}

export async function addUserFavorite(userId: string, storeId: string): Promise<void> {
  await pool.query(
    'INSERT INTO user_favorites (user_id, store_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, storeId]
  );
}

export async function removeUserFavorite(userId: string, storeId: string): Promise<void> {
  await pool.query(
    'DELETE FROM user_favorites WHERE user_id = $1 AND store_id = $2',
    [userId, storeId]
  );
}

export async function syncUserFavorites(userId: string, storeIds: string[]): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
    for (const storeId of storeIds) {
      await client.query(
        'INSERT INTO user_favorites (user_id, store_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, storeId]
      );
    }
    await client.query('COMMIT');
    return storeIds;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createStoreClaim(userId: string, storeId: string, message?: string): Promise<StoreClaim> {
  const result = await pool.query(
    `INSERT INTO store_claims (user_id, store_id, message)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, store_id) DO UPDATE SET
       message = COALESCE(EXCLUDED.message, store_claims.message),
       status = 'pending',
       updated_at = now()
     RETURNING *`,
    [userId, storeId, message || null]
  );
  return formatClaim(result.rows[0]);
}

export async function getStoreClaimsByUser(userId: string): Promise<StoreClaim[]> {
  const result = await pool.query(
    'SELECT * FROM store_claims WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows.map(formatClaim);
}

export async function getPendingClaims(): Promise<(StoreClaim & { storeName?: string; userName?: string })[]> {
  const result = await pool.query(
    `SELECT sc.*, s.name as store_name, u.email as user_email, u.first_name, u.last_name
     FROM store_claims sc
     JOIN stores s ON sc.store_id = s.id
     JOIN users u ON sc.user_id = u.id
     WHERE sc.status = 'pending'
     ORDER BY sc.created_at ASC`
  );
  return result.rows.map((r: any) => ({
    ...formatClaim(r),
    storeName: r.store_name,
    userName: r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : r.user_email,
  }));
}

export async function reviewClaim(
  claimId: number,
  action: 'approve' | 'reject',
  adminNotes?: string
): Promise<StoreClaim> {
  const status = action === 'approve' ? 'approved' : 'rejected';

  const result = await pool.query(
    `UPDATE store_claims SET status = $1, admin_notes = $2, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [status, adminNotes || null, claimId]
  );

  if (result.rows.length === 0) throw new Error('Claim not found');

  if (action === 'approve') {
    const claim = result.rows[0];
    await pool.query(
      `UPDATE stores SET is_claimed = true, updated_at = now() WHERE id = $1`,
      [claim.store_id]
    );
    await pool.query(
      `UPDATE users SET role = 'owner', updated_at = now() WHERE id = $1 AND role = 'user'`,
      [claim.user_id]
    );
  }

  return formatClaim(result.rows[0]);
}

export async function getClaimedStoresForOwner(userId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT store_id FROM store_claims WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  );
  return result.rows.map((r: any) => r.store_id);
}

export async function getUserRole(userId: string): Promise<string> {
  const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0].role : 'user';
}

export async function setUserRole(userId: string, role: string): Promise<void> {
  await pool.query('UPDATE users SET role = $1, updated_at = now() WHERE id = $2', [role, userId]);
}

export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  isCreator: boolean;
  createdAt: string;
  updatedAt: string;
  favoritesCount: number;
  claimsCount: number;
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const result = await pool.query(
    `SELECT u.*,
       COALESCE(fav.cnt, 0) as favorites_count,
       COALESCE(cl.cnt, 0) as claims_count
     FROM users u
     LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_favorites GROUP BY user_id) fav ON fav.user_id = u.id
     LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM store_claims GROUP BY user_id) cl ON cl.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  return result.rows.map(formatUser);
}

export async function deleteUser(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM store_claims WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateUserProfile(userId: string, data: {
  handle?: string | null;
  customProfileImageUrl?: string | null;
}): Promise<{ handle: string | null; avatarUrl: string | null }> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if ('handle' in data) {
    fields.push(`handle = $${idx++}`);
    values.push(data.handle || null);
  }
  if ('customProfileImageUrl' in data) {
    fields.push(`custom_profile_image_url = $${idx++}`);
    values.push(data.customProfileImageUrl || null);
  }
  if (fields.length === 0) {
    const r = await pool.query('SELECT handle, custom_profile_image_url, profile_image_url FROM users WHERE id = $1', [userId]);
    const row = r.rows[0] || {};
    return { handle: row.handle || null, avatarUrl: row.custom_profile_image_url || row.profile_image_url || null };
  }
  fields.push('updated_at = now()');
  values.push(userId);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING handle, custom_profile_image_url, profile_image_url`,
    values
  );
  const row = result.rows[0] || {};
  return {
    handle: row.handle || null,
    avatarUrl: row.custom_profile_image_url || row.profile_image_url || null,
  };
}

export async function getUserByHandle(handle: string): Promise<{ id: string; handle: string; avatarUrl: string | null; firstName: string | null } | null> {
  const result = await pool.query(
    'SELECT id, handle, custom_profile_image_url, profile_image_url, first_name FROM users WHERE LOWER(handle) = LOWER($1)',
    [handle]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    handle: row.handle,
    avatarUrl: row.custom_profile_image_url || row.profile_image_url || null,
    firstName: row.first_name || null,
  };
}

export async function getUserPublicProfile(userId: string): Promise<{
  posts: any[];
  reviews: any[];
}> {
  const postsResult = await pool.query(
    `SELECT p.id, p.title, p.subtitle, p.created_at, p.content_tier, p.store_id,
            s.name as store_name
     FROM creator_posts p
     LEFT JOIN stores s ON p.store_id = s.id
     WHERE p.user_id = $1 AND p.status = 'published'
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [userId]
  );

  const reviewsResult = await pool.query(
    `SELECT ir.id, ir.rating, ir.content_text, ir.created_at, ir.store_id,
            s.name as store_name
     FROM integrity_reviews ir
     LEFT JOIN stores s ON ir.store_id = s.id
     WHERE ir.user_id = $1
     ORDER BY ir.created_at DESC
     LIMIT 50`,
    [userId]
  );

  return {
    posts: postsResult.rows.map(r => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle || null,
      createdAt: r.created_at?.toISOString() || new Date().toISOString(),
      contentTier: r.content_tier,
      storeId: r.store_id || null,
      storeName: r.store_name || null,
    })),
    reviews: reviewsResult.rows.map(r => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.content_text || null,
      createdAt: r.created_at?.toISOString() || new Date().toISOString(),
      storeId: r.store_id || null,
      storeName: r.store_name || null,
    })),
  };
}

function formatUser(row: any): AdminUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    role: row.role,
    isCreator: row.is_creator === true,
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    favoritesCount: parseInt(row.favorites_count) || 0,
    claimsCount: parseInt(row.claims_count) || 0,
  };
}

function formatClaim(row: any): StoreClaim {
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    status: row.status,
    message: row.message,
    adminNotes: row.admin_notes,
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
  };
}
