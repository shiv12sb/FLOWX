Phase 18 — Migration & Seeding Guide

This document explains how to apply the Prisma schema changes for Phase 18 (EmergencyRequest and EmergencyUnit models), generate the Prisma client, run migrations (or push schema), and seed demo data for local testing.

Prerequisites
- Install Node.js (use the version supported by the project; project `package.json` lists dependencies).
- Ensure `DATABASE_URL` in your local `.env` points to a PostgreSQL database you can modify.
- From the repo root, change directory to `backend`.

Recommended steps (development)

1) Install dependencies

```powershell
cd backend
npm install
```

2) Generate Prisma client

```powershell
npx prisma generate
```

3) Create a migration (recommended during development)

```powershell
# interactive migration (creates migration files)
npx prisma migrate dev --name add_emergencies_and_units
```

If you prefer to push the schema without generating a migration (faster for local tests):

```powershell
npx prisma db push
```

4) (Optional) Open Prisma Studio to inspect data

```powershell
npx prisma studio
```

5) Seed demo data (signals, incidents, emergency units)

```powershell
# from backend/ folder
npm run seed:signals
npm run seed:incidents
npm run seed:emergencies
# or run all
npm run seed:all
```

Notes, troubleshooting
- If `npx prisma migrate dev` reports you are missing the Prisma client, run `npx prisma generate` first.
- If you get errors about `uuid_generate_v4()` when using `seedEmergencyUnits.js`, ensure the `uuid-ossp` extension is enabled in your Postgres DB or modify the script to use `gen_random_uuid()` (pgcrypto) or generate UUIDs in Node.
- Do NOT commit your `.env` or `DATABASE_URL` to source control.

Local smoke test (after seeding)

```powershell
# set test bypass if desired (only for local automated tests)
$env:SKIP_AUTH_FOR_TEST='1'
$env:PORT=4000
npm run dev
# In another shell:
node scripts/smokeTest.js
```

If you need me to run migrations or the seed script inside this environment, say so and I will attempt to run them (note: this environment may require shims for Prisma).