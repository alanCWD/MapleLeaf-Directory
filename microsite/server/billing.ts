import Stripe from 'stripe';
import { updateStorePlanByStripeCustomerId } from '../../server/db.ts';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Replit-Token': xReplitToken,
    },
  });

  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
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
        await updateStorePlanByStripeCustomerId(customerId, 'active', null, storeId);
      } else {
        await updateStorePlanByStripeCustomerId(customerId, 'active', null);
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
      await updateStorePlanByStripeCustomerId(customerId, status, periodEnd);
      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = typeof data.customer === 'string' ? data.customer : data.customer?.id;
      if (!customerId) break;
      const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000) : null;
      await updateStorePlanByStripeCustomerId(customerId, 'inactive', periodEnd);
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
