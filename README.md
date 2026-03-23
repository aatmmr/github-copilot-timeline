# GitHub Copilot Timeline

Interactive timeline and heatmap of GitHub Copilot changelog activity.

This project scrapes Copilot-related entries from the GitHub changelog, stores them in yearly JSON files, generates a browser data asset, and renders a static page deployable to GitHub Pages.

## What It Does

- Scrapes GitHub changelog entries that match `Copilot`
- Stores canonical source data per year in `data/copilot-timeline-YYYY.json`
- Verifies data integrity and prints activity summaries
- Generates `assets/timeline-data.js` for the static frontend
- Renders an interactive heatmap with filtering, period navigation, and day details

## Project Structure

```text
.github/workflows/
  update-timeline.yml      # nightly scrape + verify + data asset generation
  deploy-pages.yml         # build artifact + deploy to GitHub Pages

assets/
  timeline.css             # styles
  timeline.js              # client-side app logic
  timeline-data.js         # generated data asset (from data/*.json)

data/
  copilot-timeline-YYYY.json

src/
  scrape_changelog.js      # scraper (supports optional year argument)
  verify_data.js           # verifies all yearly files in data/
  embed_data.js            # merges yearly JSON into assets/timeline-data.js

copilot-timeline.html      # static page entrypoint
```

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm ci
```

## Local Commands

### Scrape current year

```bash
npm run scrape
```

### Scrape a specific year

```bash
npm run scrape -- 2025
# or
npm run scrape:year -- 2025
```

### Verify all data files

```bash
npm run verify
```

### Generate frontend data asset

```bash
npm run embed
```

### Typical local refresh flow

```bash
npm run scrape -- 2026
npm run verify
npm run embed
```

## Deployment

### Automatic updates (data refresh)

Workflow: `.github/workflows/update-timeline.yml`

- Runs nightly (01:00 UTC) and on manual dispatch
- Executes: scrape -> verify -> embed
- Commits updated files in `data/` and `assets/timeline-data.js`

### GitHub Pages deployment

Workflow: `.github/workflows/deploy-pages.yml`

- Runs on push to `main` and manual dispatch
- Builds Pages artifact from:
  - `copilot-timeline.html`
  - `assets/*`
- Publishes via official Pages actions

## Notes

- `assets/timeline-data.js` is generated. Do not edit it manually.
- `data/*.json` are the canonical input files.
- The scraper keyword is currently set to `Copilot` in `src/scrape_changelog.js`.
