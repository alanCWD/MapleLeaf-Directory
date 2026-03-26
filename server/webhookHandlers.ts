import type { Pool } from 'pg';
import { getStripeSync } from './stripeClient.ts';

async function getPool(): Promise<Pool> {
  const { pool } = await import('./db.ts');
  return pool;
}

async function updateStorePlanByCustomerId(stripeCustomerId: string, status: 'active' | 'trialing' | 'inactive', expiresAt: Date | null): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE stores SET sovereign_plan_status = $1, sovereign_plan_expires_at = $2, updated_at = now() WHERE stripe_customer_id = $3`,
    [status, expiresAt, stripeCustomerId]
  );
}

async function handleStripeEvent(event: any): Promise<void> {
  const data = event.data?.object;
  if (!data) return;

  switch (event.type) {
    case 'checkout.session.completed': {
      const customerId = typeof data.customer === 'string' ? data.customer : data.customer?.id;
      if (!customerId) break;
      const storeId = data.metadata?.storeId;
      if (storeId) {
        const pool = await getPool();
        await pool.query(
          `UPDATE stores SET sovereign_plan_status = 'active', sovereign_plan_expires_at = NULL, updated_at = now() WHERE id = $1`,
          [storeId]
        );
      } else {
        await updateStorePlanByCustomerId(customerId, 'active', null);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const customerId = typeof data.customer === 'string' ? data.customer : data.customer?.id;
      if (!customerId) break;
      let status: 'active' | 'trialing' | 'inactive';
      if (data.status === 'active') status = 'active';
      else if (data.status === 'trialing') status = 'trialing';
      else status = 'inactive';
      const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000) : null;
      await updateStorePlanByCustomerId(customerId, status, periodEnd);
      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = typeof data.customer === 'string' ? data.customer : data.customer?.id;
      if (!customerId) break;
      const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000) : null;
      await updateStorePlanByCustomerId(customerId, 'inactive', periodEnd);
      break;
    }

    default:
      break;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      await handleStripeEvent(event);
    } catch (err: any) {
      console.error('[Webhook] Business logic error (non-fatal):', err.message);
    }
  }
}
