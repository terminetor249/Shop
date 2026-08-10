# Dokkaebi Shop — PRD

## Original Problem Statement
Build a Dokkaebi Shop (inspired by Omniscient Reader's Viewpoint manhwa) for a DnD campaign.
Players and admin log in. Admin creates items/skills/modifiers/star-relics with rankings
F–SSS + Star Relic and can upload images. Admin grants coins with a reason. Sky-blue ORV theme.
Also a scenarios tab where the DM creates main / sub / bounty scenarios visible to all or select players.

## Architecture
- Backend: FastAPI + MongoDB (Motor), JWT (PyJWT) auth via httpOnly cookies + Authorization Bearer fallback.
- Image storage: Emergent Object Storage (proxy), served through /api/files/{path} with query-param auth.
- Frontend: React (react-router-dom v7), Tailwind CSS, Shadcn primitives, lucide-react icons, sonner toasts.
- Fonts: Outfit (display), JetBrains Mono (body/system).

## Core Requirements — DONE (2026-02)
- JWT auth: register, login, logout, me — with admin seeded on startup
- Role-based access (admin / player)
- Items CRUD (name, description, category, rank, price, stock, image) — admin only
- Image upload to Emergent Object Storage; secure download endpoint
- Shop grid with rank badges, category/rank filters, hover motion, glow for S+/Relic tiers
- Purchase flow — decrements coins, decrements stock (if limited), logs transaction, adds to inventory
- Inventory page for player
- Grant/deduct coins by admin with mandatory reason; transaction log per player
- Scenarios CRUD with types (main / sub / bounty) and visibility (all / specific player list)
- Player scenarios page grouped by type
- Transaction log page (admin sees all, player sees own)
- Sky-blue ORV crystal-glassmorphism theme with LitRPG "System" aesthetic
- End-to-end tested by testing_agent_v3: 100% pass rate on backend + frontend

## Test Credentials
See /app/memory/test_credentials.md (admin@dokkaebi.shop / admin123).

## Backlog / Next Ideas
- P1: Purchase confirmation modal (currently instant confirm via toast)
- P1: Item quantity/stack (buy multiple)
- P2: Scenario completion state (mark done, auto-award coins)
- P2: Public read-only shop link for guests
- P2: Import/export item CSV for quick campaign setup
- P2: Character stats / equipment slots
