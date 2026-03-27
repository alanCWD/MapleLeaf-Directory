# Microsite Engine

A self-contained, adapter-driven Sovereign Site module. Drop it into any Express + React application that wants to serve branded microsites on custom domains.

## Architecture

```
microsite/
├── types.ts                 # Generic MicrositeConfig, MicrositeTheme, MicrositeStatus
├── adapter.ts               # MicrositeAdapter interface (the only contract a host app must fulfill)
├── legacyleaf-adapter.ts    # LegacyLeaf concrete adapter — maps Store → MicrositeConfig
├── components/
│   └── SovereignSite.tsx    # React renderer that accepts MicrositeConfig (decoupled from Store)
└── server/
    ├── billing.ts           # Stripe client + webhook business logic (canonical source)
    ├── db.ts                # Microsite SQL functions (ensureColumns, getByDomain, updatePlan)
    ├── middleware.ts        # createTenantMiddleware() — resolves custom domains per-request
    └── routes.ts            # createMicrositeRouter() — all 15 Sovereign Site API routes
```

## Required database columns

Run `ensureSovereignPlanColumns()` and `ensureCustomDomainColumns()` (from `microsite/server/db.ts`) during server startup. They add the following columns to your `stores` table:

| Column | Type | Default | Description |
|---|---|---|---|
| `sovereign_plan_status` | `VARCHAR(20)` | `'inactive'` | Plan state: `active`, `trialing`, or `inactive` |
| `sovereign_plan_expires_at` | `TIMESTAMP` | NULL | Optional expiry (admin override or cancel date) |
| `stripe_customer_id` | `TEXT` | NULL | Stripe Customer ID (`cus_xxx`) linked to the store |
| `custom_domain` | `TEXT` | NULL | Bare hostname, e.g. `myshop.com` (unique where not null) |
| `domain_verified` | `BOOLEAN` | `false` | Set to `true` after a successful CNAME DNS check |
| `theme_config` | `JSONB` | NULL | `MicrositeTheme` object: `brandColor`, `fontPairing`, etc. |

## Wiring it into a host app

### 1. Implement the MicrositeAdapter interface

```typescript
import type { MicrositeAdapter } from './microsite/adapter.ts';

export const myAdapter: MicrositeAdapter = {
  async resolveByDomain(domain) { /* look up by custom_domain */ },
  async resolveById(id)         { /* look up by primary key */ },
  async checkPlanEntitlement(userId, tenantId) {
    /* return true if userId is admin OR tenant plan is active/trialing */
  },
  async updateConfig(tenantId, updates) {
    /* persist MicrositeConfig partial to your DB, return updated config or null */
  },
};
```

### 2. Mount the tenant middleware (Express — before routes)

```typescript
import { createTenantMiddleware } from './microsite/server/middleware.ts';

// Place BEFORE app.use(express.json()) so the raw webhook body works correctly
app.use(createTenantMiddleware(myAdapter, 'your-main-domain.com'));
// req.tenantStore is now a MicrositeConfig | null on every request
```

### 3. Mount the API router

```typescript
import { createMicrositeRouter } from './microsite/server/routes.ts';

router.use('/', createMicrositeRouter({
  // Auth
  isAuthenticated,         // Express RequestHandler — validates session
  requireOwnerOrAdmin,     // Express RequestHandler — 401/403 guard
  requireAdmin,            // Express RequestHandler — admin-only guard
  getUserId,               // (req) => userId | null
  getUserRole,             // (userId) => Promise<'admin' | 'owner' | 'user' | ...>
  getClaimedStoresForOwner, // (userId) => Promise<string[]>
  // Data
  getStoreById,            // (id) => Promise<entity | null>
  updateStore,             // (id, updates) => Promise<entity | null>
  adminUpdateStore,        // optional; falls back to updateStore
  createAuditLog,          // (adminId, action, type, id, details) => Promise<any>
  authStorage,             // { getUser(id): Promise<{ email? }> }
  // Image pipeline
  imageUpload,             // multer() instance
  isBunnyStorageConfigured, // () => boolean
  uploadImageToStorage,    // (buf, filename, folder?) => Promise<url>
  uploadImageLocal,        // (buf, filename, folder?) => Promise<url>
  isHeicBuffer,            // (buf, mimetype) => boolean
  convertHeicToJpegBuffer, // (buf) => Promise<Buffer>
  paramId,                 // (params) => string  (handles array params)
}));
```

### 4. Use the React renderer (frontend)

```tsx
import { SovereignSite } from './microsite/components/SovereignSite.tsx';
// Props accept MicrositeConfig — not the app-specific Store type

<SovereignSite
  store={micrositeConfig}
  directoryOrigin="https://myapp.com"
  isPreview={false}
/>
```

## API routes provided

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | /tenant | public | Resolve current request's tenant |
| GET | /owner/stores/:id/preview | owner or admin | Preview store microsite data |
| POST | /owner/stores/:id/header-image | owner or admin | Upload header banner |
| POST | /owner/stores/:id/logo | owner or admin | Upload logo (plan required) |
| POST | /owner/stores/:id/photos | owner or admin | Add gallery photo (plan required) |
| DELETE | /owner/stores/:id/photos/:index | owner or admin | Delete gallery photo |
| PATCH | /owner/stores/:id/domain | owner or admin | Set custom domain + theme |
| POST | /owner/stores/:id/domain/verify | owner or admin | Verify CNAME DNS record |
| POST | /owner/stores/:id/billing/checkout | owner or admin | Create Stripe Checkout session |
| GET | /owner/stores/:id/billing/portal | owner or admin | Open Stripe Customer Portal |
| PATCH | /admin/stores/:id/sovereign-plan | admin only | Manually set plan status |
| PATCH | /admin/stores/:id/theme | admin only | Override store theme |
| POST | /admin/stores/:id/header-image | admin only | Admin upload header banner |
| POST | /admin/stores/:id/photos | admin only | Admin add gallery photo |
| DELETE | /admin/stores/:id/photos/:index | admin only | Admin delete gallery photo |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `REPLIT_DOMAINS` | Yes | Comma-separated public domain(s); used for CNAME verification + Stripe redirect URLs |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REPLIT_CONNECTORS_HOSTNAME` | Yes | Replit connectors proxy host |
| `REPL_IDENTITY` | Dev | Replit token for dev Stripe credentials |
| `WEB_REPL_RENEWAL` | Prod | Replit token for production Stripe credentials |
