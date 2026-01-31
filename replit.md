# MapleLeaf Directory

## Overview
MapleLeaf Directory is a React-based web application for discovering niche, independent, and sovereign cannabis shops across Canada. It focuses on finding non-corporate dispensaries including Indigenous sovereign shops and independent "Local Gem" stores.

## Technology Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini AI (@google/genai)
- **Routing**: React Router DOM (HashRouter)

## Project Structure
```
/
├── index.html          # Main HTML entry point
├── index.tsx           # React app entry point
├── App.tsx             # Main App component with routing
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
├── package.json        # Dependencies and scripts
├── components/         # React components
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── ProvinceSelector.tsx
│   ├── TypeSelector.tsx
│   ├── StoreList.tsx
│   ├── StoreCard.tsx
│   ├── StoreDetail.tsx
│   ├── OwnerPortal.tsx
│   ├── AdminSync.tsx
│   ├── PersonalScout.tsx
│   ├── VibeScout.tsx
│   └── LeadBanner.tsx
└── services/
    └── geminiService.ts  # Gemini AI integration for store search
```

## Environment Variables
- `GEMINI_API_KEY`: Required for AI-powered search and recommendations

## Development
The app runs on port 5000 with Vite dev server.

## Key Features
- AI-powered search for independent cannabis shops
- Province and store type filtering
- Favorites system (stored in localStorage)
- Store detail pages with reviews
- Owner portal for claiming stores
- Admin sync for database updates
- Personal Scout AI matching

## Routes
- `/` - Home page with search and directory
- `/store/:id` - Individual store details
- `/owners` - Owner portal
- `/admin/sync` - Admin sync page
