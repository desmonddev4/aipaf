# AIPAF

This repository uses a split deployment:

- `frontend/` is the static website and admin UI, built and deployed to Vercel.
- The repository root is the API backend, deployed to Render using `render.yaml`.

## Local development

Build the frontend:

```bash
npm run build
```

Start the backend (requires its environment variables and database):

```bash
npm start
```

Run backend tests:

```bash
npm run test:backend
```

See [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md) for deployment setup and
[ENV_SETUP.md](./ENV_SETUP.md) for backend environment variables.

## Project structure

```text
frontend/
  src/pages/          Public pages
  src/admin/pages/    Admin and CMS pages
  src/admin/partials/ Reusable admin layout pieces, including sidebar.html
  src/partials/       Shared public page shell, navbar, and footer
  public/             Frontend assets and admin JavaScript/styles
  scripts/build.mjs   Static-site build
src/server/           Backend API handlers and middleware
scripts/              Backend database and administration utilities
test/                 Backend tests
server.mjs            Render API server entry point
render.yaml           Render backend/database deployment
```

The frontend is intentionally maintained in one place: `frontend/`. Backend
runtime code is maintained at the repository root. Generated `dist/` output
and installed dependencies are not source files.
