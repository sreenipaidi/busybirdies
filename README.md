# BusyBirdies

Multi-tenant customer support platform built with React, Fastify, PostgreSQL, and Redis.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, Zustand |
| Backend | Node.js 22, Fastify 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16, Redis 7 |
| Testing | Vitest, Playwright |
| CI/CD | GitHub Actions |
| Package Manager | pnpm 9 (workspaces) |

## Project Structure

```
supportdesk/
  packages/
    shared/          # Shared TypeScript types, Zod schemas, constants
    api/             # Fastify backend API
    web/             # React frontend (Vite)
  docker/            # Docker configs (API, web, nginx)
  .github/workflows/ # CI/CD pipelines
```

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Docker and Docker Compose (for PostgreSQL, Redis, MinIO)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/sreenipaidi/supportdesk.git
cd supportdesk
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy the environment file and configure:

```bash
cp .env.example .env
```

4. Start infrastructure services:

```bash
docker compose up -d
```

5. Run database migrations:

```bash
pnpm db:migrate
```

6. Seed the database (optional):

```bash
pnpm db:seed
```

7. Start the development servers:

```bash
pnpm dev
```

The API will be running at http://localhost:3000 and the frontend at http://localhost:5173.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Drizzle Studio |

## Branch Strategy

```
main (production)
  +-- develop (integration)
        +-- feature/db-schema
        +-- feature/api-core
        +-- feature/auth
        +-- feature/frontend-ui
        +-- feature/testing
```

## License

MIT
