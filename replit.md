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
-   **Creator Posts:** Allows vetted creators to publish freeform posts with media attachments. Supports moderation tiers (Clean for auto-moderation, Raw for admin review) and includes a public post feed.
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