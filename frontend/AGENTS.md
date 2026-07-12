# AGENTS.md — Frontend

Context for AI coding agents working on this frontend. Two people (and their agents) work
on this repo concurrently — follow these conventions so parallel work merges cleanly.

## Project

Sparkz-AssetFlow: asset management app. This directory is the web frontend; it talks to a
Django REST backend in `../backend` (dev server at `http://localhost:8000`, overridable via
`NEXT_PUBLIC_API_URL`).

## Stack

- Next.js 16 (App Router, root `app/` directory — there is **no `src/`**)
- React 19, TypeScript (strict), path alias `@/*` → repo `frontend/` root
- Tailwind CSS v4 — CSS-first config in `app/globals.css` (`@theme` block); there is **no
  `tailwind.config.*`** file, do not create one
- shadcn/ui (radix-ui base) — components vendored in `components/ui/`; config in
  `components.json`; add more with `npx shadcn@latest add <name>`
- Zustand v5 is the client-state library — put stores in `lib/stores/` (one file per
  domain, e.g. `useAssetStore.ts`); don't add new React contexts for shared state. The
  existing auth state in `context/AuthContext.tsx` is the one legacy exception — leave it
  as is unless a task is explicitly about migrating it.
- Prettier with `prettier-plugin-tailwindcss` (class sorting); config in `.prettierrc.json`

## Design system — read `DESIGN.md` first

`DESIGN.md` (in this directory) is the authority for all UI: a Notion-inspired system —
warm paper canvas, near-black ink, hairline borders, one blue accent. Read it before
writing any UI. Non-negotiables:

- **Components**: use the shadcn/ui primitives in `components/ui/` (Button, Input, Dialog,
  Select, Table, Tabs, Badge, Calendar, Popover, Sheet, Field, Sonner toasts, …) — never
  hand-roll a primitive that already exists there. They are pre-themed to the Notion
  palette via the semantic variables in `app/globals.css`.
- **Colors**: shadcn semantic tokens (`bg-primary`, `bg-card`, `text-muted-foreground`,
  `border-border`, `bg-destructive`, …) are mapped to the Notion palette and are the
  default choice. The raw palette is also available (`bg-canvas-soft`, `text-ink-muted`,
  `border-hairline`, `bg-night`, accent colors — decorative only). Never hardcode hex
  values in components. `--background`/`--foreground` (`bg-background`, `bg-foreground`)
  remain valid tokens (page canvas / ink).
- **Blue `primary` (#0075de) is the only structural accent** — primary buttons, links,
  focus rings. Accent colors (pink, teal, orange, …) are decorative only (icons, category
  dots, illustration tiles), never CTAs or structural fills.
- **Fonts**: loaded via Google Fonts `@import` in `app/globals.css` — do **not** add
  `next/font` (Geist was removed).
  - `font-sans` → Inter — body text, forms, tables (default on `body`)
  - `font-display` → Google Sans — headings and display text; large headings get tight
    negative tracking (see the typography table in DESIGN.md)
- **Radii**: the Tailwind radius scale is overridden to the design system's
  (`rounded-xs` 4px … `rounded-xl` 16px, `rounded-full` for pill CTAs). Inputs stay tight
  (`rounded-xs`), cards `rounded-lg`/`rounded-xl`, marketing CTAs `rounded-full`.
- Elevation is hairline borders + barely-there shadows, never heavy drop-shadows.

## Structure & conventions

```
app/            routes (App Router). (auth) route group: login, signup, login_otp, forgot-password
components/     shared React components (PascalCase files, e.g. PasswordInput.tsx)
components/ui/  shadcn/ui primitives (vendored — edit to theme, don't rewrite)
context/        React context providers (AuthContext)
lib/api/        HTTP layer — http.ts (fetch wrapper, ApiError, API_BASE_URL), client.ts
lib/auth/       authApi.ts (auth endpoints), tokenStorage.ts (token persistence)
lib/hooks/      shared hooks (camelCase, useX naming)
lib/stores/     Zustand stores (one per domain: useAssetStore.ts, useBookingStore.ts, …)
```

- All backend calls go through `lib/api/http.ts` — never call `fetch` directly in
  components. API errors are `ApiError` (carries status + parsed DRF error body).
- Client components: mark `"use client"` only where needed (state/handlers); keep pages
  server components when possible.
- New shared UI goes in `components/`; route-specific pieces can live next to their page.

## Commands

```bash
npm run dev           # dev server (localhost:3000)
npm run build         # production build — must pass before PR
npm run lint          # eslint
npm run format        # prettier --write
```

## Concurrent-work rules

- Work on your own branch; PR into `main` (see PR #1 pattern). Don't push to `main`.
- Before starting, pull `main` and rebase your branch to pick up the other agent's work.
- Don't reformat, rename, or restructure files you aren't otherwise changing — it creates
  merge conflicts for the other agent.
- Shared surfaces (`app/globals.css` theme tokens, `lib/api/http.ts`, `AuthContext`,
  `app/layout.tsx`, this file, `DESIGN.md`) are contracts: extend them additively; if you
  must change existing behavior, flag it in the PR description.
- New design tokens go in the `@theme` block of `app/globals.css` **and** get a note in
  `DESIGN.md` so both stay in sync.
- Run `npm run lint` and `npm run build` before committing.

## Environment

- `NEXT_PUBLIC_API_URL` — backend base URL (defaults to `http://localhost:8000`)
- `.env*` files are gitignored; document any new variable here.
