# GitHub Copilot Timeline — Copilot Instructions

## Project Overview

Interactive heatmap visualization of GitHub Copilot changelog entries, styled as a GitHub contribution graph. Scrapes the [GitHub Blog Changelog](https://github.blog/changelog/), filters for Copilot-related announcements, and renders a year-long heatmap in a static HTML page.

## Architecture

```
GitHub Actions (nightly cron) → Scraper → Yearly JSON files → Node.js build → dist/ → GitHub Pages
```

### Key Components

| Layer | Files | Purpose |
|-------|-------|---------|
| **Scraping** | `src/scrape_changelog*.js`, `src/fetch_copilot_rss.js` | Fetch entries from GitHub changelog via Puppeteer, Axios+Cheerio, or RSS |
| **Data** | `data/copilot-timeline-YYYY.json` | Canonical data store — one file per year, entries with metadata |
| **Processing** | `src/embed_data.js`, `src/create_site.js`, `src/verify_data.js` | Validate and merge JSON, build the static site in `dist/` |
| **Styles** | `assets/timeline.css` | All page styles (dark theme, heatmap, modal, responsive) |
| **App logic** | `assets/timeline.js` | Client-side filtering, rendering, events, and modal interactions |
| **Data file** | `dist/assets/timeline-data.js` | Generated JS file containing the merged `embeddedTimelineData` global (built by `npm run build`) |
| **Visualization** | `copilot-timeline.html` | HTML source template; copied to `dist/index.html` and `dist/copilot-timeline.html` |
| **CI/CD** | `.github/workflows/update-timeline.yml`, `.github/workflows/deploy-pages.yml` | Nightly data refresh, Node.js build, GitHub Pages deployment |

## How to Run

```sh
npm install                # Install dependencies (axios, cheerio, puppeteer, rss-parser)
npm run scrape:full        # Full scrape (slowest, most thorough)
npm run scrape             # Lighter scrape via Axios+Cheerio (CI default)
npm run verify             # Validate JSON data
npm run embed              # Generate optional data asset for the source page
npm run build              # Verify data and generate the complete site in dist/
npm start                  # Build and serve locally at http://127.0.0.1:8080
npm run dev                # Rebuild and restart the local server on source changes
npm test                   # Run build tests with the Node.js test runner
```

All scripts live in `src/` and can also be invoked directly, e.g. `node src/verify_data.js`.

## Deployment

- Run `npm ci && npm run build` and deploy only **dist/** to a static host
- GitHub Pages uses the GitHub Actions artifact, not the repository root
- The build preserves the existing `copilot-timeline.html` URL and adds `index.html`
- Node.js is needed for the build, not for the deployed site
- `assets/timeline.js` reads the `embeddedTimelineData` global defined in `assets/timeline-data.js`

## CI/CD — GitHub Actions

- The update workflow is `.github/workflows/update-timeline.yml`
- A **nightly scheduled workflow** (01:00 UTC) scrapes the GitHub changelog and commits the yearly JSON source data
- Can also be triggered manually via `workflow_dispatch`
- Update steps: `npm ci` → `npm run scrape` → `npm run verify` → commit data & push
- Uses the lightweight scraper (`src/scrape_changelog_simple.js`) in CI to avoid Puppeteer's heavy browser dependency
- The deployment workflow runs `npm test` and `npm run build`, then uploads `dist/` to GitHub Pages

## Conventions

### Data Format
- JSON entries use `YYYY-MM-DD` date format
- Metadata block includes `scraped_at`, `total_entries`, `year_filter`, `keyword_filter`, `date_range`
- Deduplication key: `date + title`

### Heatmap Styling
- Dark theme: background `#0d1117`, text `#f0f6fc`
- Green intensity scale (5 levels): `#161b22` → `#0e4429` → `#006d32` → `#26a641` → `#39d353`
- Grid: 7 rows (Mon–Sun) × 52–53 week columns

### Scrapers
- Use multiple CSS selector fallbacks (`.changelog-post`, `article`, `.post`, etc.)
- Include rate-limiting delays (500–1000ms between requests)
- Deduplicate entries using a Set

## Important Pitfalls

- **Hardcoded year filter**: Scripts filter for `2025` — change manually for other years
- **Hardcoded filename**: All scripts reference `data/copilot-timeline-2025.json` — renaming breaks the pipeline
- **Build output is generated**: `npm run build` clears and replaces `dist/`; do not edit or commit it
- **Data file is generated**: The build creates `dist/assets/timeline-data.js` from `data/*.json`; `npm run embed` creates an optional ignored source-page asset
- **Asset paths are relative**: Preserve the output folder structure so project subpaths work
- **Scraping fragility**: GitHub changelog HTML structure can change; selectors may need updating
- **Puppeteer weight**: `src/scrape_changelog.js` requires a headless browser — avoid in CI; use `npm run scrape` instead
- **GitHub Pages source**: Select GitHub Actions in repository settings
- **CI commits**: The update workflow commits only canonical JSON files; deployment generates the site
