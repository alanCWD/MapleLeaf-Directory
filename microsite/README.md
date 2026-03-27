# Microsite Engine

A self-contained, adapter-driven Sovereign Site module.  Drop it into any Express + React application that wants to serve branded microsites on custom domains.

## Architecture

```
microsite/
├── types.ts                 # Generic MicrositeConfig, MicrositeTheme, MicrositeStatus
├── adapter.ts               # MicrositeAdapter interface (the only contract a host app must fulfill)
├── legacyleaf-adapter.ts    # LegacyLeaf concrete adapter — maps Store → MicrositeConfig
├── components/
│   └── SovereignSite.tsx    # React renderer for a branded microsite page
└── server/
    ├── billing.ts           # Stripe client + webhook business logic
    ├── db.ts                # Re-exports of DB helpers used by the module
    ├── middleware.ts        # createTenantMiddleware() — resolves custom domains
    └── routes.ts            # createMicrositeRouter() — all Sovereign Site API routes
```

## Wiring it into a host app

### 1. Implement the adapter

```typescript
import type { MicrositeAdapter, MicrositeConfig } from './microsite/adapter.ts';

export const myAdapter: MicrositeAdapter = {
  async resolveByDomain(domain) { ... },
  async resolveById(id)         { ... },
};
```

The adapter maps your entity type to `MicrositeConfig`.

### 2. Mount the tenant middleware (Express)

```typescript
import { createTenantMiddleware } from './microsite/server/middleware.ts';

app.use(createTenantMiddleware(myAdapter, 'your-main-domain.com'));
```

This resolves every incoming request's `Host` header against your data layer and attaches a `MicrositeConfig` to `req.tenantStore`.

### 3. Mount the API router (Express)

```typescript
import { createMicrositeRouter } from './microsite/server/routes.ts';

router.use('/', createMicrositeRouter({
  isAuthenticated,       // your auth middleware
  requireOwnerOrAdmin,   // your ownership middleware
  requireAdmin,          // your admin middleware
  getUserId,             // (req) => userId | null
  getUserRole,           // (userId) => Promise<string>
  getClaimedStoresForOwner, // (userId) => Promise<string[]>
  getStoreById,          // (id) => Promise<entity | null>
  updateStore,           // (id, updates) => Promise<entity | null>
  createAuditLog,        // (adminId, action, type, id, details) => Promise<any>
  authStorage,           // { getUser(id): Promise<{ email? }> }
  imageUpload,           // multer instance
  isBunnyStorageConfigured,
  uploadImageToStorage,
  uploadImageLocal,
  isHeicBuffer,
  convertHeicToJpegBuffer,
  paramId,               // (params) => string
}));
```

### 4. Use the React renderer (frontend)

```tsx
import { SovereignSite } from './components/SovereignSite.tsx';

<SovereignSite store={store} directoryOrigin="https://myapp.com" />
```

## API routes provided

| Method   | Path                                   | Guard          | Description                        |
|----------|----------------------------------------|----------------|------------------------------------|
| GET      | /tenant                                | public         | Resolve current request's tenant   |
| GET      | /owner/stores/:id/preview              | owner or admin | Preview store microsite data       |
| POST     | /owner/stores/:id/header-image         | owner or admin | Upload header banner               |
| POST     | /owner/stores/:id/logo                 | owner or admin | Upload logo (plan required)        |
| POST     | /owner/stores/:id/photos               | owner or admin | Add gallery photo (plan required)  |
| DELETE   | /owner/stores/:id/photos/:index        | owner or admin | Delete gallery photo               |
| PATCH    | /owner/stores/:id/domain               | owner or admin | Set custom domain + theme          |
| POST     | /owner/stores/:id/domain/verify        | owner or admin | Verify CNAME DNS record            |
| POST     | /owner/stores/:id/billing/checkout     | owner or admin | Create Stripe Checkout session     |
| GET      | /owner/stores/:id/billing/portal       | owner or admin | Open Stripe Customer Portal        |
| PATCH    | /admin/stores/:id/sovereign-plan       | admin only     | Manually set plan status           |
| PATCH    | /admin/stores/:id/theme                | admin only     | Override store theme               |
| POST     | /admin/stores/:id/header-image         | admin only     | Admin upload header banner         |
| POST     | /admin/stores/:id/photos               | admin only     | Admin add gallery photo            |
| DELETE   | /admin/stores/:id/photos/:index        | admin only     | Admin delete gallery photo         |

## Environment variables

- `REPLIT_DOMAINS` — comma-separated public domain(s); used for CNAME verification + Stripe URLs
- `DATABASE_URL` — PostgreSQL connection string
- `REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY` — Replit-managed Stripe credentials
