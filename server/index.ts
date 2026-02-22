import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupAuth, registerAuthRoutes } from './replit_integrations/auth/index.ts';
import router from './routes.ts';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? 5000 : 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function startServer() {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use('/api', router);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/debug/users', async (_req, res) => {
    try {
      const { pool } = await import('./db.ts');
      const result = await pool.query('SELECT id, email, role, auth_provider, password_hash IS NOT NULL as has_password FROM users');
      res.json({ count: result.rows.length, users: result.rows, db_url_prefix: (process.env.DATABASE_URL || '').substring(0, 30) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Express API server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
