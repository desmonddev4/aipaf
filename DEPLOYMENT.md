# Deployment Guide

This repository now supports a **split deployment architecture**:
- **Frontend**: Static files on Vercel
- **Backend**: API-only service on Render

## Quick Start

For the recommended split deployment, see [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md).

## Legacy Single-Platform Deployment

This document previously described deploying both frontend and backend on Vercel. This approach is no longer recommended as it requires the entire site to be on a single platform.

If you need to deploy on a single platform (not recommended), use the old `RENDER_DEPLOYMENT.md` guide for deploying the entire site on Render.

## Split Deployment Summary

### Frontend (Vercel)
- Static HTML/CSS/JS files
- No server-side code
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
- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) - Legacy single-platform deployment on Render
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables reference
