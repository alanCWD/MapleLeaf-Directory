import { pool } from '../../server/db.ts';

/**
 * Required stores table columns
 * ------------------------------------------------------------------
 * sovereign_plan_status   VARCHAR(20)  DEFAULT 'inactive'
 *                         Values: 'active' | 'trialing' | 'inactive'
 * sovereign_plan_expires_at TIMESTAMP  NULLABLE
 *                         Optional expiry set by admin override or subscription cancel
 * stripe_customer_id      TEXT         NULLABLE
 *                         Stripe Customer object ID (cus_xxx)
 * custom_domain           TEXT         NULLABLE  (UNIQUE WHERE NOT NULL)
 *                         Bare hostname, e.g. "myshop.com"
 * domain_verified         BOOLEAN      DEFAULT FALSE
 *                         Set to TRUE after a successful CNAME check
 * theme_config            JSONB        NULLABLE
 *                         Stores MicrositeTheme object (brandColor, fontPairing, etc.)
 * ------------------------------------------------------------------
 * Run ensureSovereignPlanColumns() and ensureCustomDomainColumns()
 * during your server startup to create these columns automatically.
 */

export async function ensureSovereignPlanColumns(): Promise<void> {
  await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS sovereign_plan_status VARCHAR(20) DEFAULT 'inactive'`);
  await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS sovereign_plan_expires_at TIMESTAMP`);
  await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
  console.log('[DB] sovereign_plan columns ensured');
}

export async function ensureCustomDomainColumns(): Promise<void> {
  await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain TEXT`);
  await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme_config JSONB`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain) WHERE custom_domain IS NOT NULL`);
  console.log('[DB] custom_domain columns ensured');
}

export async function getStoreByCustomDomain(domain: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT * FROM stores WHERE custom_domain = $1 AND domain_verified = true LIMIT 1`,
    [domain],
  );
  return result.rows[0] ?? null;
}

export async function updateStorePlanByStripeCustomerId(
  stripeCustomerId: string,
  status: 'active' | 'trialing' | 'inactive',
  expiresAt: Date | null,
  storeId?: string,
): Promise<void> {
  if (storeId) {
    await pool.query(
      `UPDATE stores
       SET sovereign_plan_status = $1, sovereign_plan_expires_at = $2, stripe_customer_id = $3
       WHERE id = $4`,
      [status, expiresAt, stripeCustomerId, storeId],
    );
  } else {
    await pool.query(
      `UPDATE stores
       SET sovereign_plan_status = $1, sovereign_plan_expires_at = $2
       WHERE stripe_customer_id = $3`,
      [status, expiresAt, stripeCustomerId],
    );
  }
}
