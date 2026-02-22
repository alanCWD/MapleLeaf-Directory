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

function formatUser(row: any): AdminUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    role: row.role,
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
