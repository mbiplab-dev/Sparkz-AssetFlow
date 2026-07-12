# AssetFlow frontend

Next.js App Router UI for AssetFlow.

**Use the monorepo root for setup:**

```bash
cd ..          # repo root
make init      # first time
make run       # backend + this app
```

See the root [README.md](../README.md) for demo accounts, make targets, and API notes.

Dev server only:

```bash
npm run dev -- --port 3000
```

API calls go to `/api/*` and are rewritten to Django (`BACKEND_ORIGIN`, default `http://127.0.0.1:8000`) unless `NEXT_PUBLIC_API_URL` is set.
