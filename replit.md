# LegacyLeaf Directory

## Overview
LegacyLeaf Directory is a React-based web application for discovering niche, independent, and sovereign cannabis shops across Canada. It focuses on finding non-corporate dispensaries including Indigenous sovereign shops and independent "Local Gem" stores. The app includes a full anti-hallucination verification pipeline and a comprehensive authentication system with user accounts, store ownership claims, and role-based access control.

## Technology Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite (port 5000)
- **Backend**: Express.js (port 3001)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini AI (@google/genai)
- **Routing**: React Router DOM (HashRouter)
- **Auth**: Multi-provider: Email/Password + Google OAuth + Replit Auth (all using Passport.js with PostgreSQL sessions)

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
│   ├── StoreDetail.tsx         # Includes MediaGallery, IntegrityCard, VideoRecorder/Uploader integration
│   ├── OwnerPortal.tsx         # Store claiming + owned store management + media management
│   ├── AdminSync.tsx           # Admin-only discovery engine
│   ├── AdminReviewQueue.tsx    # Admin-only review queue + claim reviews
│   ├── AdminStores.tsx         # Admin-only store management dashboard with edit + audit log
│   ├── AdminUsers.tsx          # Admin-only user management panel
│   ├── CommunitySubmit.tsx     # Login-gated store submissions
│   ├── PersonalScout.tsx
│   ├── VibeScout.tsx
│   ├── LeadBanner.tsx
│   ├── VideoRecorder.tsx       # Guided in-browser video recorder (VocalVideo-style UX)
│   ├── VideoUploader.tsx       # File-based video upload with TUS resumable uploads
│   ├── MediaGallery.tsx        # Video thumbnail grid + Bunny embed player modal
│   ├── IntegrityCard.tsx       # IntegrityScore visual display (compact + full modes)
│   ├── BadgeIcon.tsx           # Badge pill component (Verified Scout, Legacy Archivist, Integrity Anchor)
│   └── BadgeProgress.tsx       # Badge progress panel with criteria tracking
├── hooks/
│   └── useAuth.ts              # Auth hook (user, isAdmin, isOwner, isAuthenticated)
├── services/
│   ├── geminiService.ts
│   └── api.ts                  # Full API client with auth + integrity endpoints
└── server/
    ├── index.ts                # Express server entry (calls initIntegrityEngine on boot)
    ├── db.ts                   # PostgreSQL helpers (stores, flags, admin)
    ├── userDb.ts               # User/session/favorites/claims database functions
    ├── routes.ts               # API route handlers (with auth + integrity routes)
    ├── search.ts               # AI search endpoint
    ├── verification.ts         # Verification pipeline
    ├── bunnyStream.ts          # Bunny Stream API client (create/get/delete video, TUS creds)
    ├── videoStitcher.ts        # FFmpeg video auto-stitching (normalize, title cards, crossfade)
    ├── integrity/              # Portable Integrity Engine module
    │   ├── index.ts            # Module entry — exports + initIntegrityEngine()
    │   ├── types.ts            # TrustWeight, IntegrityScoreCard, WeightedReview, etc.
    │   ├── scoring.ts          # Trust-weight calculation + IntegrityScore formula
    │   ├── models.ts           # DB schema + CRUD for store_media, integrity_reviews, user_badges
    │   ├── badges.ts           # Badge evaluation engine (auto-award/revoke based on activity)
    │   └── media.ts            # Video UGC orchestration (wraps bunnyStream.ts)
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
- `BUNNY_STREAM_API_KEY`: Bunny.net Stream API key (required for video uploads)
- `BUNNY_STREAM_LIBRARY_ID`: Bunny.net Stream library ID (required for video uploads)
- `BUNNY_CDN_HOSTNAME`: Optional custom CDN hostname for Bunny (defaults to vz-{libraryId}.b-cdn.net)

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

## Integrity Engine
The Integrity Engine is a cleanly separated module in `server/integrity/` designed for future extraction into a standalone IaaS product.

### Trust-Weight Formula
Each review receives a trust weight calculated as:
- **Base weight**: 0.5
- **Video bonus**: +0.2 (if review includes verified video)
- **Scout status bonus**: +0.3 (activated when user earns Verified Scout badge)
- **Presence bonus**: +0.15 (if user has verified check-in at store within last 60 minutes)
- **Geo-deviation penalty**: -0.4 (if user submits review with GPS > 500m from store without check-in)
- Final weight clamped to 0.0–1.0

### IntegrityScore Calculation
Composite score (0–10) from: 40% weighted average rating + 20% verified presence ratio + 20% review stability + 20% content richness.

### Video UGC Pipeline
1. Client calls `POST /api/stores/:id/media/init` to get TUS upload credentials
2. Client uploads via TUS resumable protocol directly to Bunny Stream CDN
3. Bunny sends encoding webhook to `POST /webhooks/bunny`
4. Media status updates: created → processing → ready (or failed)
5. Videos served via Bunny CDN embed player + thumbnails

### Video Auto-Stitching
Server-side FFmpeg pipeline that concatenates multi-question clips into a single polished video:
1. Client uploads individual recorded clips to `POST /api/stores/:id/media/stitch` (multipart form)
2. Server normalizes all clips to 1280x720, 30fps, H.264+AAC
3. Creates intro title card ("Video Review / Store Name") and per-question title cards
4. Stitches segments with crossfade transitions (0.5s) between clips
5. Uploads the final stitched MP4 to Bunny Stream via direct PUT upload
6. Returns mediaId for review submission
- Single-clip recordings bypass stitching and upload directly via TUS (existing flow)
- Files: `server/videoStitcher.ts` (FFmpeg orchestration), route in `server/routes.ts`
- Temp files stored in `/tmp/video-stitch/` and cleaned up after processing
- Supports up to 10 clips per stitch job, 200MB per clip max

### Guided Video Recorder (VocalVideo-Style)
Built natively with MediaRecorder API — no third-party service. Four-step flow:
1. Welcome screen with camera permission request
2. Prompted recording (per question) with record/pause/re-record controls
3. Review all clips + star rating + optional text comment
4. Auto-stitch (multi-clip) or TUS upload (single clip) + review submission with trust weight display

### Badge System
Three automatically-awarded badges that serve as trust signals:
| Badge | Criteria | Trust Impact |
|-------|----------|--------------|
| **Verified Scout** (purple) | 3+ video reviews across 2+ stores | +0.3 trust weight on future reviews |
| **Legacy Archivist** (amber) | 10+ reviews OR 5+ store submissions OR 3+ media uploads | Display-only reputation |
| **Integrity Anchor** (emerald) | 8+ reviews, avg trust ≥ 0.7, 0 flagged | Display-only reputation |

Badges auto-evaluate after every review submission and flag action. Displayed on reviews, navbar, admin panel, and the `/badges` progress page. Admins can filter users by badge type, manually award badges, and revoke badges from the User Management panel.

### Future Extraction
The `server/integrity/` module is structured for white-label extraction into a standalone service. All database operations, scoring logic, and media orchestration are self-contained with a clean public API via `index.ts`.

## Database Schema
- `stores` table: Store data with verification metadata and cached AI insights (store_insights JSONB column)
- `store_flags` table: User reports about listings
- `users` table: User accounts from Replit Auth
- `sessions` table: Session management
- `user_favorites` table: Database-synced favorites for logged-in users
- `store_claims` table: Ownership claim requests with status tracking
- `audit_logs` table: Admin action audit trail (admin_user_id, action, target_type, target_id, details JSONB, created_at)
- `store_media` table: Video/media uploads linked to stores (id, store_id, bunny_video_id, title, media_type, status, embed_url, thumbnail_url, duration, file_size)
- `integrity_reviews` table: Trust-weighted reviews (id, store_id, user_id, rating 1-5, content_text, video_asset_id FK, trust_weight JSONB, has_verified_video, is_flagged, disclosures JSONB)
- `user_badges` table: Earned badges (id, user_id, badge_type, awarded_at, metadata JSONB) — unique on (user_id, badge_type)

## API Endpoints
### Public (no auth required)
- `GET /api/stores` - List stores (filterable)
- `GET /api/stores/:id` - Single store
- `POST /api/search` - AI-powered search (database-first)
- `PATCH /api/stores/:id/insights` - Cache store insights

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

### Integrity Engine (media + reviews)
- `POST /api/stores/:id/media/init` (authenticated) - Initialize video upload, returns TUS credentials
- `POST /api/stores/:id/media/stitch` (authenticated) - Upload clips + auto-stitch into polished video with transitions
- `GET /api/stores/:id/media` (public) - List store media
- `GET /api/stores/:id/media/:mediaId` (public) - Single media details
- `DELETE /api/stores/:id/media/:mediaId` (authenticated, owner/admin) - Delete media
- `POST /api/stores/:id/reviews` (authenticated) - Submit trust-weighted review
- `GET /api/stores/:id/reviews` (public) - Get weighted reviews for store
- `GET /api/stores/:id/integrity-score` (public) - Get IntegrityScoreCard
- `GET /api/stores/:id/recorder-questions` (public) - Get guided recording questions
- `POST /webhooks/bunny` (outside /api prefix) - Bunny Stream encoding webhook
- `GET /api/users/:userId/badges` (public) - Get user's badges
- `GET /api/user/badge-progress` (authenticated) - Get badge progress metrics
- `POST /api/admin/users/:userId/badges/:badgeType` (admin) - Manually award a badge
- `DELETE /api/admin/users/:userId/badges/:badgeType` (admin) - Manually revoke a badge

### Admin (admin role only)
- `POST /api/stores` - Create store
- `POST /api/stores/bulk` - Bulk upsert
- `PATCH /api/stores/:id` - Update any store
- `POST /api/stores/:id/verify` - Run verification
- `POST /api/stores/bulk-verify` - Bulk verify
- `GET /api/admin/stores` - List all stores with filters, pagination, status counts
- `PATCH /api/admin/stores/:id` - Admin edit store with audit logging
- `GET /api/admin/review-queue` - Stores needing review
- `PATCH /api/admin/stores/:id/review` - Approve/reject/close store (audit logged)
- `GET /api/admin/claims` - All pending claims
- `PATCH /api/admin/claims/:id/review` - Approve/reject claim (audit logged)
- `GET /api/admin/audit-logs` - View audit log with filters (store, admin, action, date range)
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
- `/admin/stores` - Admin store management with filters, edit, and audit log (admin only)
- `/admin/users` - Admin user management (admin only)
- `/badges` - Badge progress and achievements (login required)

## Routes
- `/auth` - Sign in / Register page (Email/Password + Google OAuth)

## Recent Changes
- 2026-03-16: Owner/Admin store editing expanded
  - Store owners can now edit store hours (add/remove day+time entries via UI in Owner Portal)
  - Store owners can now add/remove Featured Selection items (chip-based UI in Owner Portal)
  - "Visit Official Site" website URL field now clearly labelled in Owner Portal edit form
  - Admin store edit modal now includes Store Hours editor (add/remove entries) alongside existing fields
  - All these fields were already supported by the backend (`hours`, `featuredOfferings`, `website`, `headerImageUrl`); only UI was missing
  - Updated components: OwnerPortal.tsx, AdminStores.tsx
- 2026-03-11: Store header images overhaul
  - Replaced LoremFlickr-generated images with curated Unsplash cannabis/retail image repository (18 images)
  - New `header_image_url` column on stores table for persistent image storage
  - Unclaimed stores get varied default images via deterministic hash (not all the same)
  - Store owners can change header image from Owner Portal (pick from defaults or enter custom URL)
  - Admins can change any store's header image from Admin Store Management edit modal
  - New utility: `utils/defaultStoreImages.ts` with `getStoreHeaderImage()` and `getDefaultStoreImage()` helpers
  - Updated components: StoreCard.tsx, StoreDetail.tsx, OwnerPortal.tsx, AdminStores.tsx
  - API: `headerImageUrl` added to owner and admin store update endpoints
- 2026-03-10: Added Admin Store Management dashboard with audit log
  - New page at /admin/stores showing all stores in a filterable, sortable table
  - Status summary cards showing counts for verified, AI suggested, rejected, closed, and claimed
  - Filters: verification status, province, claimed/unclaimed, text search (name/address)
  - Sortable columns: name, confidence score, flag count, last updated
  - Server-side pagination (25 per page)
  - Inline edit modal for any store: name, address, province, type, phone, website, status, featured offerings, admin notes
  - Audit log tab showing timeline of all admin actions (store approvals, rejections, edits, claim reviews)
  - Audit log shows who performed the action, what changed (with before/after diffs), and when
  - Audit log filterable by action type and by specific store
  - Existing admin review and claim review actions now create audit entries
  - New table: audit_logs (admin_user_id, action, target_type, target_id, details JSONB)
  - New component: AdminStores.tsx
  - New API endpoints: GET /api/admin/stores, PATCH /api/admin/stores/:id, GET /api/admin/audit-logs
  - Navigation: "Store Management" link added to admin user menu
- 2026-03-10: Added Video Auto-Stitching pipeline
  - Server-side FFmpeg processing concatenates multi-question clips into single polished video
  - Intro title card + per-question title cards generated automatically
  - Crossfade transitions (0.5s) between all segments
  - Clips normalized to 1280x720 H.264+AAC before stitching
  - Stitched video uploaded to Bunny Stream via direct PUT API
  - VideoRecorder updated with multi-phase progress UI (uploading → stitching → processing → submitting)
  - Single-clip recordings continue to use efficient direct TUS upload
  - New file: server/videoStitcher.ts
  - New API endpoint: POST /api/stores/:id/media/stitch
  - New dependency: multer (multipart file uploads)
- 2026-03-10: Added admin badge management to User Management panel
  - Badge filter bar (filter users by Verified Scout / Legacy Archivist / Integrity Anchor)
  - Badge count summary showing how many users hold each badge
  - Award badge button per user with badge type selector
  - Revoke badge with confirmation per user
  - Admin-only API routes: POST/DELETE /api/admin/users/:id/badges/:badgeType
- 2026-03-09: Added Badge System (Verified Scout, Legacy Archivist, Integrity Anchor)
  - Auto-awarded based on user activity thresholds
  - Verified Scout activates +0.3 trust weight bonus on reviews
  - Badge progress page at /badges with criteria tracking
  - Badges displayed on reviews, navbar dropdown, admin user panel
  - New table: user_badges
  - New components: BadgeIcon.tsx, BadgeProgress.tsx
  - New file: server/integrity/badges.ts (evaluation engine)
- 2026-03-09: Built Integrity Engine module (`server/integrity/`)
  - Trust-weighted review system with video bonus (+0.2 hard signal)
  - IntegrityScore display (IntegrityCard with circular progress, color-coded)
  - Bunny Stream video UGC pipeline (TUS resumable uploads, CDN delivery, encoding webhooks)
  - Guided in-browser video recorder (VideoRecorder.tsx, MediaRecorder API, VocalVideo-style UX)
  - File-based video uploader with drag-and-drop (VideoUploader.tsx, TUS resumable)
  - Media gallery with Bunny embed player (MediaGallery.tsx)
  - Owner portal media management section (upload, delete, encoding status)
  - VideoObject schema.org JSON-LD markup for SEO/AI discovery
  - New tables: store_media, integrity_reviews
  - Module structured for future white-label extraction
- 2026-03-01: Added store insights caching to eliminate repeated AI calls
  - New `store_insights` JSONB column on stores table caches atmosphere, community, specialties, sovereignty, proTip
  - First view of a store generates insights via Gemini, then saves to database
  - Subsequent views load cached insights instantly — zero AI calls
  - New public `PATCH /api/stores/:id/insights` endpoint (no auth required to cache)
  - StoreDetail checks for cached insights before calling Gemini
- 2026-02-25: Implemented database-first search to reduce Gemini API usage
  - Search queries now check PostgreSQL first before calling Gemini AI
  - If database returns 3+ matching results, AI call is skipped entirely
  - If fewer than 3 database results, AI supplements and results are merged (deduped by name)
  - Database search matches on name, address, province, and featured offerings
  - Supports province abbreviations (BC, ON, etc.) and type keywords (sovereign, indigenous, independent)
  - Manually input store data is included in database search results
  - Response includes `source` field: "database" or "combined" for transparency
- 2026-02-23: Added JSON-LD structured data to index.html for AI citation optimization
  - Organization schema with knowsAbout property listing 14 core cannabis directory topics
  - WebSite schema with SearchAction for AI-discoverable search functionality
  - WebApplication schema marking the site as a free business application
  - All schemas use @graph format with cross-references via @id
  - URLs set to legacyleaf.ca (update when custom domain is finalized)
- 2026-02-22: Added multi-provider authentication (Email/Password + Google OAuth)
  - Email/Password registration and login with bcrypt password hashing
  - Google OAuth sign-in via Passport.js Google strategy
  - Dedicated auth page at /auth with clean sign-in/register forms
  - Email case normalization to prevent duplicate accounts
  - Pre-existing users (e.g., manually added admins) can set a password on first email login
  - Google sign-in links existing accounts by email match
  - Replit Auth kept as fallback at /api/login
  - Session format unified across all three auth providers
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
