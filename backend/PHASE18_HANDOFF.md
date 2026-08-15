Phase 18 — Emergency Response & Priority Routing

Purpose

This document is a concise handoff for local testing and operator onboarding for Phase 18 (Emergency Response & Priority Routing). It lists files added/modified, how to run migrations and seeds, how to run the backend and quick verification steps, known limitations in this environment, and suggested next steps.

Files Added
- `backend/scripts/seedEmergencyUnits.js` — seed emergency unit demo data (tolerant of test shim environments)
- `backend/PHASE18_SEED_AND_MIGRATE.md` — migration & seeding guide (detailed)
- `backend/PHASE18_HANDOFF.md` — this file
- `js/emergency/emergencyList.js` — enhanced frontend list with realtime and operator actions

Files Modified (Phase 18)
- `backend/src/services/emergencyService.js` — core emergency logic with in-memory fallbacks for test environments
- `backend/src/routes/emergencyRoutes.js` — emergency APIs and logging
- `backend/src/utils/emergencyRealtime.js` — WebSocket broadcaster
- `pages/emergencies.html` — emergency dashboard entry
- `backend/package.json` — added seed scripts

Local setup & quick run (developer)

1) From repo root, open PowerShell and go to backend:
```powershell
cd backend
npm install
```

2) Generate Prisma client:
```powershell
npx prisma generate
```

3) Apply DB schema (pick one):
```powershell
# create migration (recommended for development)
npx prisma migrate dev --name add_emergencies_and_units

# OR push schema without migration
npx prisma db push
```

4) Seed demo data:
```powershell
npm run seed:signals    # existing script
npm run seed:incidents  # existing script
npm run seed:emergencies
# or all:
npm run seed:all
```

5) Start backend (dev):
```powershell
$env:SKIP_AUTH_FOR_TEST='1'  # optional for quick smoke tests
npm run dev
```

6) Quick smoke test (from another shell):
```powershell
$env:SKIP_AUTH_FOR_TEST='1'
node scripts/smokeTest.js
```

Frontend
- Open `pages/emergencies.html` in the browser (from local dev server or via frontend hosting).
- The emergency list uses WebSocket to refresh on `emergency.*` events and provides operator action buttons.

Verification checklist
- API: `GET /api/emergencies` returns seeded emergencies (or empty list if no DB)
- Seed: `npm run seed:emergencies` completes without errors (or logs that DB not available)
- UI: `pages/emergencies.html` connects via WebSocket and refreshes when new emergency is created
- Smoke tests: `node scripts/smokeTest.js` exercises emergency endpoints (may use `SKIP_AUTH_FOR_TEST=1`)

Known limitations
- This environment may use local shims for missing Node modules and may not run full Prisma migrations here.
- `PHASE18` schema changes require `npx prisma generate` and migration/push against a real PostgreSQL DB.
- `SKIP_AUTH_FOR_TEST=1` is a test bypass only; do not use in production.

Suggested next steps
- Implement `emergencyDetails` UI for per-emergency route/ETA/signal recommendations and unit assignment UI.
- Add server-side unit selection endpoint that returns ranked units with ETA and reasoning for operator confirmation.
- Add end-to-end tests for operator workflow (create -> recommend -> assign -> approve -> simulate -> resolve).

Contact
- If you want me to attempt running migrations and seeds here, say so. I can try, but this environment may require extra shims or DB connectivity.

