# @onlyoffice/ai-chat — Headless Next.js Sample

Headless AI chat widget with Next.js 16, PostgreSQL (via Prisma), and Docker.

Uses `@onlyoffice/ai-chat` stores, services, and pages directly — without the `AIChatWidget` wrapper — with a PostgreSQL-backed `StorageAdapter` instead of IndexedDB.

## Quick Start (Docker)

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

## Local Development

```bash
cp .env.example .env
# Start PostgreSQL (via Docker or locally)
docker compose up db -d

npm install
npx prisma db push
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server with Turbopack |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |
