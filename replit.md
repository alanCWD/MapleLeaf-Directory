# LegacyLeaf Directory

## Overview
LegacyLeaf Directory is a React-based web application for discovering niche, independent, and sovereign cannabis shops across Canada. It aims to highlight non-corporate dispensaries, including Indigenous sovereign shops and independent "Local Gem" stores. The application incorporates a robust anti-hallucination verification pipeline and a comprehensive authentication system featuring user accounts, store ownership claims, and role-based access control to ensure data integrity and user trust.

## User Preferences
I prefer iterative development with a focus on clear, modular code. Please ask before making significant architectural changes or adding new external dependencies. For any new features, prioritize a mobile-first approach.

## System Architecture
The application utilizes a split frontend/backend architecture. The frontend is built with React 19 and TypeScript, using Vite on port 5000, and proxies API requests to the backend. The backend is an Express.js server on port 3001, handling database operations, the verification pipeline, authentication, and admin functionalities. PostgreSQL serves as the primary database, storing all listing data, verification metadata, user accounts, sessions, favorites, claims, and audit logs. Tailwind CSS (via CDN) is used for styling, and React Router DOM (HashRouter) manages client-side routing.

**Key Features and Design Patterns:**
-   **Authentication & Authorization:** Implements multi-provider authentication (Replit Auth, Email/Password, Google OAuth) using Passport.js with PostgreSQL sessions. A role hierarchy (guest, user, owner, admin) governs access to features. Favorites sync between localStorage for guests and the database for logged-in users.
-   **Anti-Hallucination System:** A multi-layered verification pipeline includes strict AI prompts, Google Places API cross-checks, confidence scoring based on multiple data points, and distinct verification statuses (verified, ai_suggested, historically_closed, rejected). It also features a lower verification threshold for Indigenous/sovereign shops and user flagging with admin review for low-confidence or flagged listings.
-   **Integrity Engine:** A modular system (`server/integrity/`) designed for future extraction, focusing on trust and credibility. It includes:
    -   **Trust-Weight Formula:** Calculates a trust score for reviews based on factors like video evidence, user badge status (Verified Scout), and geo-presence.
    -   **IntegrityScore Calculation:** A composite score (0-10) derived from weighted average ratings, verified presence ratio, review stability, and content richness.
    -   **Video UGC Pipeline:** Orchestrates user-generated video content, from guided in-browser recording and resumable TUS uploads to Bunny Stream, server-side FFmpeg auto-stitching for multi-clip videos, and webhook-driven processing.
    -   **Badge System:** Automatically awards badges (Verified Scout, Legacy Archivist, Integrity Anchor) based on user activity, acting as trust signals and influencing review trust weights.
-   **Culture Hub:** A dedicated creator content section accessible via "Hub" in the navigation. Clean posts (admin-promoted) are visible to all visitors; Raw posts are blurred with a sign-in prompt for unauthenticated visitors. All new posts default to Raw (pending admin review); only creators at Local Scout badge rank or above can select the Clean tier when submitting. The Clean toggle in the post editor is visible but locked for Explorer-rank creators. Badge rank gating is enforced on both frontend and backend. Store-linked posts appear in the Hub feed as well as on their linked store profile.
-   **Store Insights Caching:** Caches AI-generated store insights (`store_insights JSONB` column) to minimize repeated Gemini API calls, improving performance for subsequent views.
-   **Database-First Search:** Prioritizes PostgreSQL database searches for listings before falling back to or supplementing with AI-powered search, optimizing Gemini API usage.
-   **Admin Management:** Comprehensive admin panels for store management (with audit logs), user management (role changes, deletion, badge management), and review queues for community submissions and ownership claims.
-   **Structured Data:** Utilizes JSON-LD structured data in `index.html` for SEO and AI discoverability, including Organization, WebSite, and WebApplication schemas.

## External Dependencies
-   **Database:** PostgreSQL (Neon-backed)
-   **AI Integration:** Google Gemini AI (@google/genai)
-   **Video Hosting & Streaming:** Bunny.net Stream (for video uploads, encoding, and CDN delivery)
-   **File Uploads:** Bunny.net Storage (for post image uploads)
-   **OAuth:** Google OAuth, Replit Auth (via Passport.js)
-   **Geocoding/Verification (Optional):** Google Places API
-   **Video Processing:** FFmpeg (server-side for video auto-stitching)
-   **Multipart File Uploads:** Multer (for video stitching endpoint)

## User Profile System
Users can set a public `@handle` (2–30 chars, letters/numbers/underscores, reserved handles blocked), upload a custom avatar (stored via Bunny CDN or local fallback), and add one optional social media link. Social link fields:
- `social_link_platform` — one of: instagram, facebook, x, reddit, discord
- `social_link_url` — full URL (instagram/facebook/x/reddit) or plain username string (discord)
- `social_link_public` — boolean toggle (default false); only public links appear on public profiles
- `social_link_verified` — boolean set by server-side HTTP HEAD check at save time (non-Discord only)

**ProfileSettings.tsx**: 5-button platform picker → URL/username input → public toggle → Save
**UserProfilePage.tsx**: shows social link badge in header only when public (clickable link for URL platforms, plain text for Discord)
**AdminUsers.tsx**: always shows social link for admin users (with private indicator if not public)
**API**: `PATCH /api/user/profile` (FormData); `GET /api/user/profile/:handle` (conditionally exposes social link)

## Sovereign Site + Stripe Billing
Store owners can unlock a "Sovereign Site" — a branded microsite on a custom domain — via a $29 CAD/month subscription.

**Schema additions to `stores` table:**
- `sovereign_plan_status VARCHAR(20) DEFAULT 'inactive'` — one of `active`, `trialing`, `inactive`
- `sovereign_plan_expires_at TIMESTAMP` — optional expiry (for admin overrides)
- `stripe_customer_id TEXT` — Stripe customer ID linked to the store

**Stripe integration:**
- `server/stripeClient.ts` — Replit-managed credentials (no hardcoded keys); exports `getUncachableStripeClient()`, `getStripeSync()`, `getStripePublishableKey()`
- `server/webhookHandlers.ts` — minimal webhook handler calling `stripe-replit-sync`'s `processWebhook()`
- Webhook route `/api/stripe/webhook` registered BEFORE `express.json()` in `server/index.ts`
- `initStripe()` runs on startup: `runMigrations()` → `getStripeSync()` → `findOrCreateManagedWebhook()` → `syncBackfill()` (non-fatal on error)
- Sovereign Site product seeded via `scripts/seed-sovereign-plan.ts` (run once in dev)

**Backend routes:**
- `POST /api/owner/stores/:id/billing/checkout` — creates Stripe Checkout session; creates Stripe customer if none; finds Sovereign Site price dynamically
- `GET /api/owner/stores/:id/billing/portal` — creates Stripe Billing Portal session for active subscribers
- `PATCH /api/admin/stores/:id/sovereign-plan` — admin manual override of `sovereignPlanStatus` + optional expiry

**Frontend (OwnerPortal):**
- `OwnedSiteSection` is gated: inactive plan → shows upgrade CTA card (benefits list + $29/month price + "Unlock Sovereign Site" button → Stripe Checkout); active/trialing → shows full site editor with "Manage Billing →" link
- Success banner shown when returning from checkout with `?upgraded=1` in URL
- Plan status badge shown in section header

**Frontend (AdminStores):**
- "Edit Site" modal includes a "Sovereign Plan (Admin)" section: active/trialing/inactive toggle buttons + optional expiry date picker + "Update Sovereign Plan" button

**Key services/api.ts exports:**
- `ownerCreateCheckout(storeId)` — POST to checkout endpoint
- `ownerGetBillingPortal(storeId)` — GET billing portal URL
- `adminSetSovereignPlan(storeId, status, expiresAt?)` — admin plan override