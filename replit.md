# MapleLeaf Directory

## Overview
MapleLeaf Directory is a React-based web application for discovering niche, independent, and sovereign cannabis shops across Canada. It focuses on finding non-corporate dispensaries including Indigenous sovereign shops and independent "Local Gem" stores. The app includes a full anti-hallucination verification pipeline and a comprehensive authentication system with user accounts, store ownership claims, and role-based access control.

## Technology Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite (port 5000)
- **Backend**: Express.js (port 3001)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini AI (@google/genai)
- **Routing**: React Router DOM (HashRouter)
- **Auth**: Replit Auth integration (adapted for raw PostgreSQL)

## Architecture
The app uses a split frontend/backend architecture:
- **Vite dev server** on port 5000 (exposed to users), with proxy to backend for `/api/*` routes
- **Express API server** on port 3001 (internal), handles database CRUD, verification pipeline, auth, and admin endpoints
- **PostgreSQL** stores all listing data with verification metadata, user accounts, sessions, favorites, and claims

## Authentication & Authorization
- **Replit Auth**: Users sign in via Replit OAuth flow
- **Role Hierarchy**: guest (browse only) → user (can contribute/flag) → owner (can manage claimed stores) → admin (full access)
- **Guest Access**: Directory browsing, filtering, search all work without login
- **Login Required**: Community submissions, store flagging, favorites sync
- **Owner Access**: Edit owned store listings (phone, website, address)
- **Admin Access**: Review queue, database engine, claim approval/rejection
- **Favorites**: localStorage for guests, database-synced for logged-in users with merge on first login
- **Store Claims**: Users submit ownership claims → admin reviews → approved users get "owner" role and can edit their stores

## Project Structure
```
/
├── index.html              # Main HTML entry point
├── index.tsx               # React app entry point
├── App.tsx                 # Main App component with routing & favorites sync
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite config with API proxy
├── package.json
├── components/
│   ├── Navbar.tsx              # Auth-aware navbar with user menu
│   ├── Hero.tsx
│   ├── ProvinceSelector.tsx
│   ├── TypeSelector.tsx
│   ├── VerificationFilter.tsx
│   ├── VerificationBadge.tsx
│   ├── EvidencePanel.tsx
│   ├── FlagButton.tsx          # Login-gated reporting
│   ├── StoreList.tsx
│   ├── StoreCard.tsx
│   ├── StoreDetail.tsx
│   ├── OwnerPortal.tsx         # Store claiming + owned store management
│   ├── AdminSync.tsx           # Admin-only discovery engine
│   ├── AdminReviewQueue.tsx    # Admin-only review queue + claim reviews
│   ├── AdminUsers.tsx          # Admin-only user management panel
│   ├── CommunitySubmit.tsx     # Login-gated store submissions
│   ├── PersonalScout.tsx
│   ├── VibeScout.tsx
│   └── LeadBanner.tsx
├── hooks/
│   └── useAuth.ts              # Auth hook (user, isAdmin, isOwner, isAuthenticated)
├── services/
│   ├── geminiService.ts
│   └── api.ts                  # Full API client with auth endpoints
└── server/
    ├── index.ts                # Express server entry
    ├── db.ts                   # PostgreSQL helpers (stores, flags, admin)
    ├── userDb.ts               # User/session/favorites/claims database functions
    ├── routes.ts               # API route handlers (with auth middleware)
    ├── search.ts               # AI search endpoint
    ├── verification.ts         # Verification pipeline
    └── replit_integrations/
        └── auth/
            ├── replitAuth.ts   # Replit Auth OAuth setup
            └── storage.ts      # Session storage adapter
```

## Environment Variables
- `GEMINI_API_KEY`: Required for AI-powered search and recommendations
- `GOOGLE_PLACES_API_KEY`: Optional, enables Google Places verification
- `DATABASE_URL`: PostgreSQL connection string (auto-configured by Replit)
- `REPLIT_DOMAINS`: Auto-set by Replit for auth callback URLs
- `REPL_ID`: Auto-set by Replit for auth integration

## Anti-Hallucination System
Multi-layered verification pipeline:
1. **Strict AI Prompts**: Gemini returns only verifiable locations with real evidence
2. **Verification Pipeline**: Google Places API cross-check (if API key provided)
3. **Confidence Scoring**: 0.4 Places match + 0.2 website + 0.2 source URL + 0.1 offerings + 0.1 hours
4. **Verification Statuses**: verified (>= 0.6), ai_suggested (< 0.6), historically_closed, rejected
5. **Sovereign Threshold**: Lower verification bar (0.3) for Indigenous/sovereign shops
6. **Evidence Sources**: Each listing shows confirmation sources
7. **User Flagging**: Reports about incorrect listings (login required)
8. **Admin Review Queue**: Low-confidence and flagged stores require manual approval

## Database Schema
- `stores` table: Store data with verification metadata
- `store_flags` table: User reports about listings
- `users` table: User accounts from Replit Auth
- `sessions` table: Session management
- `user_favorites` table: Database-synced favorites for logged-in users
- `store_claims` table: Ownership claim requests with status tracking

## API Endpoints
### Public (no auth required)
- `GET /api/stores` - List stores (filterable)
- `GET /api/stores/:id` - Single store
- `POST /api/search` - AI-powered search

### Auth
- `GET /api/login` - Initiate Replit Auth login
- `GET /api/login/callback` - OAuth callback
- `GET /api/logout` - End session
- `GET /api/auth/user` - Current user info

### Authenticated (login required)
- `POST /api/stores/community-submit` - Submit store
- `POST /api/stores/:id/flag` - Flag store
- `GET /api/user/favorites` - Get favorites
- `POST /api/user/favorites/:storeId` - Add favorite
- `DELETE /api/user/favorites/:storeId` - Remove favorite
- `POST /api/user/favorites/sync` - Sync localStorage favorites
- `POST /api/user/claims` - Submit ownership claim
- `GET /api/user/claims` - View own claims

### Owner (owner/admin role)
- `GET /api/user/owned-stores` - Get owned stores
- `PATCH /api/owner/stores/:id` - Update owned store

### Admin (admin role only)
- `POST /api/stores` - Create store
- `POST /api/stores/bulk` - Bulk upsert
- `PATCH /api/stores/:id` - Update any store
- `POST /api/stores/:id/verify` - Run verification
- `POST /api/stores/bulk-verify` - Bulk verify
- `GET /api/admin/review-queue` - Stores needing review
- `PATCH /api/admin/stores/:id/review` - Approve/reject/close store
- `GET /api/admin/claims` - All pending claims
- `PATCH /api/admin/claims/:id/review` - Approve/reject claim
- `GET /api/admin/users` - List all users with stats
- `PATCH /api/admin/users/:id/role` - Change user role
- `DELETE /api/admin/users/:id` - Delete user account

## Routes
- `/` - Home page with search, filters, and directory
- `/store/:id` - Individual store details
- `/submit` - Community store submission (login required)
- `/owners` - Owner portal with claim workflow
- `/admin/sync` - Admin discovery engine (admin only)
- `/admin/review` - Admin review queue (admin only)
- `/admin/users` - Admin user management (admin only)

## Recent Changes
- 2026-02-22: Added Admin User Management panel
  - View all registered users with role badges, join date, favorites/claims counts
  - Change user roles (user/owner/admin) via dropdown
  - Delete users with confirmation dialog (cascading cleanup of favorites, claims, sessions)
  - Search users by name/email, filter by role
  - Self-modification prevention (admin cannot change own role or delete own account)
  - Accessible from admin user menu and mobile nav
- 2026-02-19: Implemented full authentication system
  - Added Replit Auth integration adapted for raw PostgreSQL (no Drizzle ORM)
  - Built user role hierarchy: guest → user → owner → admin
  - Store claiming workflow: owners request → admin reviews → owners can edit listings
  - Favorites sync from localStorage to database on first login
  - Community submissions and flagging now require login
  - Admin routes (review queue, database engine) restricted to admin role
  - Navbar shows sign in/out, user menu with role badge, and role-based navigation
  - Owner Portal now has functional store claiming form and owned store editing
  - AdminReviewQueue includes ownership claim review tab
- 2026-02-16: Enhanced discovery engine for sovereign shops
- 2026-02-16: Reduced verification restrictiveness for sovereign/trading post shops
- 2026-02-16: Implemented full anti-hallucination verification system
