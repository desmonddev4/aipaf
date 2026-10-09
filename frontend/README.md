# AIPAF Frontend - Vercel Deployment

This folder contains the frontend files ready for deployment on Vercel.

## Deployment Instructions

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Navigate to this folder:
   ```bash
   cd frontend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Set environment variables in Vercel dashboard:
   - `SITE_URL`: Your production domain (e.g., https://aipafgh.org)
   - `API_BASE_URL`: Your backend API URL (e.g., https://aipaf-backend.onrender.com)

### Option 2: Deploy via Vercel Dashboard

1. Push this `frontend` folder to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Add New Project"
4. Import your Git repository
5. Select the `frontend` folder as the root directory
6. Configure build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
7. Add environment variables:
   - `SITE_URL`: Your production domain
   - `API_BASE_URL`: Your backend API URL
8. Click "Deploy"

## Project Structure

```
frontend/
├── package.json          # Frontend dependencies and build script
├── vercel.json          # Vercel configuration
├── scripts/
│   └── build.mjs        # Build script for static site generation
├── src/
│   ├── pages/           # HTML page templates
│   ├── admin/pages/     # Admin page templates
│   ├── partials/        # Reusable components (layout, navbar, footer)
│   └── server/          # Server-side files (not used in Vercel)
└── public/              # Static assets
    ├── css/             # Stylesheets
    ├── js/              # JavaScript files
    ├── img/             # Images
    └── media/           # Media files
```

## Build Process

The build script (`scripts/build.mjs`) will:
1. Clean the `dist` directory
2. Copy `public/` to `dist/`
3. Wrap each page in `src/pages/` with the layout template
4. Generate sitemap.xml and robots.txt
5. Update API_BASE_URL in config.js based on environment variable

## Environment Variables

Required environment variables for production:

- `SITE_URL`: The frontend domain (e.g., https://aipafgh.org)
- `API_BASE_URL`: The backend API URL (e.g., https://aipaf-backend.onrender.com)

## Local Development

To test the build locally:

```bash
cd frontend
npm run build
```

The built files will be in the `dist/` directory. You can serve them with any static file server, for example:

```bash
npx serve dist
```

## Notes

- This is a static site build - no Node.js runtime is required on Vercel
- The build process uses only Node.js built-in modules (no external dependencies)
- The backend API should be deployed separately (e.g., on Render, Railway, or another platform)
