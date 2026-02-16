# MapleLeaf Directory

## Overview
MapleLeaf Directory is a React-based web application for discovering niche, independent, and sovereign cannabis shops across Canada. It focuses on finding non-corporate dispensaries including Indigenous sovereign shops and independent "Local Gem" stores. The app includes a full anti-hallucination verification pipeline to ensure listed stores are grounded in real-world evidence.

## Technology Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite (port 5000)
- **Backend**: Express.js (port 3001)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini AI (@google/genai)
- **Routing**: React Router DOM (HashRouter)

## Architecture
The app uses a split frontend/backend architecture:
- **Vite dev server** on port 5000 (exposed to users), with proxy to backend for `/api/*` routes
- **Express API server** on port 3001 (internal), handles database CRUD, verification pipeline, and admin endpoints
- **PostgreSQL** stores all listing data with verification metadata

## Project Structure
```
/
├── index.html              # Main HTML entry point
├── index.tsx               # React app entry point
├── App.tsx                 # Main App component with routing
├── types.ts                # TypeScript type definitions (Store, Verification, Evidence, Flags)
├── vite.config.ts          # Vite config with API proxy
├── package.json
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── ProvinceSelector.tsx
│   ├── TypeSelector.tsx
│   ├── VerificationFilter.tsx    # Filter by verification status
│   ├── VerificationBadge.tsx     # Visual badges (Verified/AI-Suggested/Closed)
│   ├── EvidencePanel.tsx         # Shows evidence sources per listing
│   ├── FlagButton.tsx            # Report incorrect listings
│   ├── StoreList.tsx
│   ├── StoreCard.tsx             # With verification badges
│   ├── StoreDetail.tsx           # With evidence panel and flag button
│   ├── OwnerPortal.tsx
│   ├── AdminSync.tsx             # Discovery engine with auto-verification
│   ├── AdminReviewQueue.tsx      # Admin review for low-confidence stores
│   ├── PersonalScout.tsx
│   ├── VibeScout.tsx
│   └── LeadBanner.tsx
├── services/
│   ├── geminiService.ts          # Gemini AI with anti-hallucination prompts
│   └── api.ts                    # Frontend API client for backend
└── server/
    ├── index.ts                  # Express server entry
    ├── db.ts                     # PostgreSQL helpers (CRUD, flags, admin)
    ├── routes.ts                 # API route handlers
    └── verification.ts           # Verification pipeline (Google Places API)
```

## Environment Variables
- `GEMINI_API_KEY`: Required for AI-powered search and recommendations
- `GOOGLE_PLACES_API_KEY`: Optional, enables Google Places verification for store listings
- `DATABASE_URL`: PostgreSQL connection string (auto-configured by Replit)

## Anti-Hallucination System
The app implements a multi-layered verification pipeline:

1. **Strict AI Prompts**: Gemini is instructed to only return verifiable locations with real evidence
2. **Verification Pipeline**: Each store candidate is checked against Google Places API (if API key provided)
3. **Confidence Scoring**: 0.4 Places match + 0.2 website + 0.2 source URL + 0.1 offerings + 0.1 hours
4. **Verification Statuses**: verified (>= 0.6), ai_suggested (< 0.6), historically_closed, rejected
5. **Evidence Sources**: Each listing shows what sources confirmed its existence
6. **User Flagging**: Users can report non-existent or incorrect listings
7. **Admin Review Queue**: Low-confidence and flagged stores require manual approval

## Database Schema
- `stores` table: All store data with verification fields (verification_status, confidence_score, evidence_sources, flag_count, admin_reviewed, lat/lng, places_api_match)
- `store_flags` table: User reports about incorrect listings

## API Endpoints
- `GET /api/stores` - List stores (filterable)
- `GET /api/stores/:id` - Single store
- `POST /api/stores` - Create/upsert store
- `POST /api/stores/bulk` - Bulk upsert
- `PATCH /api/stores/:id` - Update store
- `POST /api/stores/:id/verify` - Run verification pipeline
- `POST /api/stores/bulk-verify` - Bulk verify
- `POST /api/stores/community-submit` - Community store submission with auto-verification
- `POST /api/stores/:id/flag` - Flag a store
- `GET /api/stores/:id/flags` - Get flags
- `GET /api/admin/review-queue` - Stores needing review
- `PATCH /api/admin/stores/:id/review` - Admin approve/reject/close

## Routes
- `/` - Home page with search, filters, and directory
- `/store/:id` - Individual store details with evidence panel
- `/submit` - Community store submission form
- `/owners` - Owner portal
- `/admin/sync` - Admin sync page with auto-verification
- `/admin/review` - Admin review queue for unverified stores

## Recent Changes
- 2026-02-16: Reduced verification restrictiveness for sovereign/trading post shops
  - Lowered verification threshold for Sovereign type (0.3 vs 0.6 for Local Gem)
  - Added community_report evidence type with automatic boost for sovereign stores
  - Updated Gemini AI prompts to explicitly include unlicensed trading posts, sovereign shops, and informal dispensaries
  - AI now accepts social media, news articles, community forums as valid evidence sources
  - Added community store submission form (/submit) for users to report known stores
  - Descriptive locations now accepted (e.g. "Highway 97A near Enderby, BC")
- 2026-02-16: Implemented full anti-hallucination verification system
  - Added PostgreSQL database with verification metadata
  - Created Express backend API with verification pipeline
  - Updated Gemini prompts with strict anti-hallucination instructions
  - Added verification badges, evidence panels, and user flagging to UI
  - Built admin review queue for manual approval of low-confidence stores
  - Added verification status filter to directory listings
