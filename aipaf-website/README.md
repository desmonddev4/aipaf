# AIPAF website (frontend)

Corporate multi-page website for the African Institute of Project Assurance and Forensics.
Plain HTML, CSS and JavaScript (ES modules). No dependencies, no framework, no install step.

## Run locally

```bash
node scripts/dev.mjs      # builds, then serves http://localhost:3000
```

Needs Node 18 or newer.

## Deploy to Vercel

1. Push this folder to a Git repository (GitHub, GitLab or Bitbucket).
2. In Vercel choose **Add New > Project** and import the repository.
3. Leave the settings as they are. `vercel.json` already sets the build command (`node scripts/build.mjs`), the output folder (`dist`) and clean URLs.
4. Optional: add an environment variable `SITE_URL` (for example `https://aipaf.africa`) so canonical links and the sitemap use your real domain.

Or with the CLI: `npx vercel` from this folder.

## How it is organised

```
src/pages/        One file per page. First line is a JSON comment with title, description, nav item.
src/partials/     layout.html (page shell), header.html, footer.html. Edit once, applies everywhere.
public/css/       styles.css (design tokens at the top: colours, fonts, spacing)
public/js/        main.js (menu, hero video, hero card), forms.js (validation), config.js (backend hooks)
public/media/     hero.webm and hero.mp4 (background video), hero-poster.jpg
public/img/       logo SVGs (full colour, mark, reversed, mono), stills from the video, favicons
scripts/          build.mjs (assembles dist/), dev.mjs (local preview)
BACKEND-TODO.md   Everything left for the backend
```

## Things to know

- **Colours** come from the seal: green `#02521d`, gold `#d28503`. Change them in `:root` at the top of `styles.css`.
- **Hero video** is the supplied storyboard video, re-encoded without sound (about 1 MB each as WebM and MP4). It pauses automatically for visitors who prefer reduced motion, and has a pause button.
- **Forms** work today by opening the visitor's email app. Add the endpoints in `public/js/config.js` once the backend exists.
- **Fonts** (Newsreader and Public Sans) load from Google Fonts. Safe fallbacks are set if they are blocked.
- To add a page: create `src/pages/yourpage.html` with the JSON comment on the first line, then add it to `header.html` and `footer.html` if it needs a menu link.
