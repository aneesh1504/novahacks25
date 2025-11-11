# Liquid Glass Frontend

Elegant Next.js (App Router) UI ready to plug into any backend.

## Quick Start

```bash
# from this folder
npm install
npm run dev
# open http://localhost:3000 (login) or http://localhost:3000/admin (dashboard)
```

If you see peer-deps conflicts with React 19, `.npmrc` already sets `legacy-peer-deps=true` to install cleanly.

## Environment

Copy `.env.local.example` to `.env.local` and set:

```
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

No backend is required to preview the UI. When a backend is ready, point this base URL to it.

## Integration Points

- `lib/api/types.ts` — shared TypeScript types for students, teachers, radar dimensions, and matching.
- `lib/api/client.ts` — tiny JSON client using `NEXT_PUBLIC_API_BASE_URL`.
- `lib/api/endpoints.ts` — centralized endpoint paths and typed functions (placeholders now).
- `app/admin/page.tsx` — the Student ↔ Teacher matching UI. Replace mock/random data with calls to `api.*` once endpoints are known.

Example (where to swap in real data later):
- The match action in `app/admin/page.tsx` currently computes mock scores. Replace that block with a call to `api.match(payload)` and then render the response.

## Monorepo-Friendly

If you want to place this inside a backend repo:

```
root/
  backend/           # your existing Python project
  web/               # move this folder here
```

- Run with different ports if needed: `npm run dev` (web, 3000) and your backend on 8000.
- In Docker Compose, set `NEXT_PUBLIC_API_BASE_URL=http://backend:8000` and add a network.

## Scripts

- `npm run dev` — start Next dev server
- `npm run build && npm start` — production build

## Accessibility

- Dialogs use `DialogTitle` to satisfy Radix a11y rules.

## Notes

- Node 20+ recommended for Next 15/React 19.
- Images are `unoptimized` in `next.config.mjs` to keep things simple.