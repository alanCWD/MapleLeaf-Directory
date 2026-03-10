import crypto from 'crypto';
import { pool } from '../db';

const ROTATION_INTERVAL_SECONDS = 5 * 60;
const GEO_FENCE_RADIUS_METERS = 200;

function getPresenceSecret(): string {
  if (process.env.PRESENCE_SECRET) {
    return process.env.PRESENCE_SECRET;
  }
  const dbUrl = process.env.DATABASE_URL || 'fallback-secret-key';
  return crypto.createHash('sha256').update(dbUrl).digest('hex');
}

function getCurrentEpoch(): number {
  return Math.floor(Date.now() / 1000 / ROTATION_INTERVAL_SECONDS);
}

export function generateQRSecret(storeId: string, epoch: number): string {
  const secret = getPresenceSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${storeId}:${epoch}`);
  return hmac.digest('hex');
}

export function getCurrentQRPayload(storeId: string): { code: string; expiresAt: string; storeId: string } {
  const epoch = getCurrentEpoch();
  const code = generateQRSecret(storeId, epoch);
  const expiresAtMs = (epoch + 1) * ROTATION_INTERVAL_SECONDS * 1000;
  return {
    code,
    expiresAt: new Date(expiresAtMs).toISOString(),
    storeId,
  };
}

export function validateQRCode(storeId: string, code: string): boolean {
  const epoch = getCurrentEpoch();
  const currentCode = generateQRSecret(storeId, epoch);
  if (code === currentCode) return true;
  const previousCode = generateQRSecret(storeId, epoch - 1);
  return code === previousCode;
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function verifyPresence(
  storeId: string,
  userId: string,
  qrCode: string,
  userLat: number,
  userLng: number
): Promise<{ verified: boolean; distance: number; geoVerified: boolean; qrValid: boolean; checkinId: number | null }> {
  const qrValid = validateQRCode(storeId, qrCode);

  const storeResult = await pool.query('SELECT lat, lng FROM stores WHERE id = $1', [storeId]);
  if (storeResult.rows.length === 0) {
    return { verified: false, distance: -1, geoVerified: false, qrValid, checkinId: null };
  }

  const storeLat = parseFloat(storeResult.rows[0].lat);
  const storeLng = parseFloat(storeResult.rows[0].lng);

  let distance = -1;
  let geoVerified = false;

  if (!isNaN(storeLat) && !isNaN(storeLng)) {
    distance = Math.round(calculateDistance(userLat, userLng, storeLat, storeLng) * 100) / 100;
    geoVerified = distance <= GEO_FENCE_RADIUS_METERS;
  }

  const verified = qrValid && geoVerified;

  const epoch = getCurrentEpoch();
  const codeSecret = generateQRSecret(storeId, epoch);

  const qrResult = await pool.query(
    `INSERT INTO presence_qr_codes (store_id, code_secret, rotation_epoch, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code_secret) DO UPDATE SET store_id = EXCLUDED.store_id
     RETURNING id`,
    [storeId, codeSecret, epoch, new Date((epoch + 1) * ROTATION_INTERVAL_SECONDS * 1000)]
  );
  const qrCodeId = qrResult.rows[0].id;

  const checkinResult = await pool.query(
    `INSERT INTO presence_checkins (store_id, user_id, qr_code_id, lat, lng, distance_meters, geo_verified, qr_valid, verified, method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [storeId, userId, qrCodeId, userLat, userLng, distance, geoVerified, qrValid, verified, 'qr+geo']
  );

  return {
    verified,
    distance,
    geoVerified,
    qrValid,
    checkinId: checkinResult.rows[0].id,
  };
}

export async function getStoreCheckins(storeId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM presence_checkins WHERE store_id = $1 ORDER BY verified_at DESC LIMIT 100`,
    [storeId]
  );
  return result.rows.map(checkinSnakeToCamel);
}

export async function getUserCheckins(userId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM presence_checkins WHERE user_id = $1 ORDER BY verified_at DESC LIMIT 100`,
    [userId]
  );
  return result.rows.map(checkinSnakeToCamel);
}

export async function hasRecentCheckin(userId: string, storeId: string, windowMinutes: number = 60): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM presence_checkins
     WHERE user_id = $1 AND store_id = $2 AND geo_verified = true AND qr_valid = true
       AND verified_at > NOW() - INTERVAL '1 minute' * $3`,
    [userId, storeId, windowMinutes]
  );
  return parseInt(result.rows[0].count) > 0;
}

function checkinSnakeToCamel(row: Record<string, any>) {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    qrCodeId: row.qr_code_id,
    verifiedAt: row.verified_at ? row.verified_at.toISOString() : new Date().toISOString(),
    lat: row.lat ? parseFloat(row.lat) : null,
    lng: row.lng ? parseFloat(row.lng) : null,
    distanceMeters: row.distance_meters ? parseFloat(row.distance_meters) : null,
    geoVerified: row.geo_verified ?? false,
    method: row.method || 'qr+geo',
  };
}
