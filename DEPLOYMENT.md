# Deployment Guide

This repository now supports a **split deployment architecture**:
- **Frontend**: Static files on Vercel
- **Backend**: API-only service on Render

## Quick Start

For the recommended split deployment, see [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md).

## Split Deployment Summary

### Frontend (Vercel)
- Static HTML/CSS/JS files
- Vercel project root: `frontend/`
- Domain: https://aipafgh.org
- Environment variables: `SITE_URL`, `API_BASE_URL`

### Backend (Render)
- Node.js API server
- PostgreSQL database
- Domain: https://aipaf-backend.onrender.com
- Environment variables: All backend secrets and database URL

### Architecture
```
Vercel Frontend (static) → Render Backend API → PostgreSQL (Render)
```

## Documentation

- [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md) - Recommended split deployment guide
- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) - Render backend setup guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables reference
