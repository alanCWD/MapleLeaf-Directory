import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupAuth, registerAuthRoutes } from './replit_integrations/auth/index.ts';
import router from './routes.ts';
import { seedStoresFromFile, initAuditLogTable, ensureHeaderImageColumn, ensureUserProfileColumns, ensureStorePhotosColumn, ensureCustomDomainColumns, ensureSovereignPlanColumns } from './db.ts';
import { initIntegrityEngine, handleWebhook } from './integrity/index.ts';
import { WebhookHandlers } from './webhookHandlers.ts';
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient.ts';
import { createTenantMiddleware } from '../microsite/server/middleware.ts';
import { legacyleafAdapter } from '../microsite/legacyleaf-adapter.ts';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? 5000 : 3001;

const __dirnameLocal = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirnameLocal, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use(cors());

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req: any, res: any) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Stripe] Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json({ limit: '10mb' }));

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[Stripe] DATABASE_URL not set, skipping Stripe init');
    return;
  }
  try {
    console.log('[Stripe] Running migrations...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('[Stripe] Migrations done');

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}`;
    console.log('[Stripe] Setting up managed webhook...');
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    console.log('[Stripe] Webhook configured');

    stripeSync.syncBackfill()
      .then(() => console.log('[Stripe] Backfill sync complete'))
      .catch((err: any) => console.error('[Stripe] Backfill error:', err.message));
  } catch (err: any) {
    console.error('[Stripe] Init error (non-fatal):', err.message);
  }
}

async function startServer() {
  await setupAuth(app);
  registerAuthRoutes(app);

  await initIntegrityEngine();
  await initAuditLogTable();
  await ensureHeaderImageColumn();
  await ensureStorePhotosColumn();
  await ensureUserProfileColumns();
  await ensureCustomDomainColumns();
  await ensureSovereignPlanColumns();

  const MAIN_DOMAIN = (process.env.REPLIT_DOMAINS || '').split(',')[0]?.trim() || '';
  app.use(createTenantMiddleware(legacyleafAdapter, MAIN_DOMAIN));

  app.use('/api', router);

  app.post('/webhooks/bunny', async (req, res) => {
    try {
      const result = await handleWebhook(req.body);
      res.json({ success: true, media: result });
    } catch (err: any) {
      console.error('[Webhook] Bunny error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (!isProduction) {
    app.get('/api/debug/users', async (_req, res) => {
      try {
        const { pool } = await import('./db.ts');
        const result = await pool.query('SELECT id, email, role, auth_provider, password_hash IS NOT NULL as has_password FROM users');
        res.json({ count: result.rows.length, users: result.rows, db_url_prefix: (process.env.DATABASE_URL || '').substring(0, 30) });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/setup-admins', async (_req, res) => {
      try {
        const { pool } = await import('./db.ts');
        const adminEmails = ['alanb613@gmail.com', 'alan@citywidedigital.ca', 'trunorthprokopetz@gmail.com'];
        const result = await pool.query(
          `UPDATE users SET role = 'admin' WHERE LOWER(email) = ANY($1) RETURNING email, role`,
          [adminEmails]
        );
        await pool.query('DELETE FROM sessions');
        res.json({ updated: result.rows, sessionsCleared: true, message: 'Admin roles set. Please sign in again.' });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  if (isProduction) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.resolve(__dirname, '..', 'dist');
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      },
    }));
    app.use((_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Server] Express API server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
    try {
      await seedStoresFromFile();
    } catch (err) {
      console.error('[Seed] Error during store seeding:', err);
    }
    initStripe().catch((err: any) => console.error('[Stripe] Background init error:', err.message));
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
