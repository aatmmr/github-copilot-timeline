# GitHub Copilot Timeline — Copilot Instructions

## Project Overview

Interactive heatmap visualization of GitHub Copilot changelog entries, styled as a GitHub contribution graph. Scrapes the [GitHub Blog Changelog](https://github.blog/changelog/), filters for Copilot-related announcements, and renders a year-long heatmap in a static HTML page.

## Architecture

```
GitHub Actions (weekly cron) → Scrapers (Node.js) → JSON data file → HTML visualization → GitHub Pages
```

### Key Components

| Layer | Files | Purpose |
|-------|-------|---------|
| **Scraping** | `src/scrape_changelog*.js`, `src/fetch_copilot_rss.js` | Fetch entries from GitHub changelog via Puppeteer, Axios+Cheerio, or RSS |
| **Data** | `data/copilot-timeline-YYYY.json` | Canonical data store — one file per year, entries with metadata |
| **Processing** | `src/embed_data.js`, `src/create_working_html.js`, `src/verify_data.js` | Merge + embed JSON into HTML, generate HTML, validate data |
| **Styles** | `assets/timeline.css` | All page styles (dark theme, heatmap, modal, responsive) |
| **App logic** | `assets/timeline.js` | Client-side filtering, rendering, events, and modal interactions |
| **Data file** | `assets/timeline-data.js` | Generated JS file containing the merged `embeddedTimelineData` global (built by `npm run embed`) |
| **Visualization** | `copilot-timeline.html` | Production entry point — HTML structure only; loads CSS, data, and JS externally |
| **CI/CD** | `.github/workflows/update-timeline.yml` | Weekly scrape via GitHub Actions, deploy to GitHub Pages |

## How to Run

```sh
npm install                # Install dependencies (axios, cheerio, puppeteer, rss-parser)
npm run scrape:full        # Full scrape (slowest, most thorough)
npm run scrape             # Lighter scrape via Axios+Cheerio (CI default)
npm run verify             # Validate JSON data
npm run embed              # Embed JSON into HTML
npm run build              # Generate working HTML with debug panel
```

All scripts live in `src/` and can also be invoked directly, e.g. `node src/verify_data.js`.

## Deployment

- The site is deployed as a **GitHub Pages** static page directly from the repository
- The site is served from four files: `copilot-timeline.html` (HTML structure), `assets/timeline.css` (styles), `assets/timeline-data.js` (generated merged data), and `assets/timeline.js` (app logic) — no server-side rendering needed
- `assets/timeline.js` reads the `embeddedTimelineData` global defined in `assets/timeline-data.js`

## CI/CD — GitHub Actions

- The workflow file is `.github/workflows/update-timeline.yml`
- A **weekly scheduled workflow** (`cron`: Monday 9:00 UTC) scrapes the GitHub changelog, updates the JSON data, re-embeds it into HTML, and commits the result
- Can also be triggered manually via `workflow_dispatch`
- Pipeline steps: `npm install` → `npm run scrape` → `npm run verify` → `npm run embed` → commit & push
- Uses the lightweight scraper (`src/scrape_changelog_simple.js`) in CI to avoid Puppeteer's heavy browser dependency
- The workflow commits updated `data/copilot-timeline-2025.json` and `copilot-timeline.html` back to the branch that GitHub Pages serves from

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
- **No backups**: `src/embed_data.js` and `src/create_working_html.js` overwrite output files in place
- **Data file is generated**: `assets/timeline-data.js` is built by `npm run embed` from the `data/*.json` files — do not edit it manually
- **Asset paths are relative**: `assets/timeline.css` and `assets/timeline.js` are referenced with relative paths — serving from a subdirectory without a base tag will break them
- **Scraping fragility**: GitHub changelog HTML structure can change; selectors may need updating
- **Puppeteer weight**: `src/scrape_changelog.js` requires a headless browser — avoid in CI; use `npm run scrape` instead
- **GitHub Pages source**: Ensure the deployed branch/folder matches the GitHub Pages configuration in repo settings
- **CI commits**: The Actions workflow commits generated files — avoid merge conflicts by not editing JSON/HTML data manually
