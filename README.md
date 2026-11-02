# GitHub Copilot Timeline

Interactive timeline and heatmap of GitHub Copilot changelog activity.

This project scrapes Copilot-related entries from the GitHub changelog and stores them in yearly JSON files. A Node.js build converts the source files and data into a static site in `dist/`. Deploy this folder to GitHub Pages or another static host. The deployed site does not need Node.js.

## What It Does

- Scrapes GitHub changelog entries that match `Copilot`
- Stores canonical source data per year in `data/copilot-timeline-YYYY.json`
- Verifies data integrity and prints activity summaries
- Generates `dist/assets/timeline-data.js` during the build
- Renders an interactive heatmap with filtering, period navigation, and day details

## Project Structure

```text
.github/workflows/
  update-timeline.yml      # nightly scrape + verify + source data commit
  deploy-pages.yml         # build artifact + deploy to GitHub Pages

assets/
  timeline.css             # styles
  timeline.js              # client-side app logic

data/
  copilot-timeline-YYYY.json

src/
  scrape_changelog.js      # scraper (supports optional year argument)
  verify_data.js           # verifies all yearly files in data/
  embed_data.js            # merges yearly JSON into assets/timeline-data.js
  create_site.js           # builds the complete site in dist/

test/
  build.test.js            # build tests

copilot-timeline.html      # HTML source template

dist/                     # generated output; not committed
  index.html              # site entry point
  copilot-timeline.html    # same page at the existing URL
  assets/                 # CSS, app logic, and generated data
  .nojekyll               # disables Jekyll processing
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

### Build the site

```bash
npm run build
```

The build verifies all yearly data files, clears the previous `dist/` folder, and generates the complete site. It does not scrape the network or change source files. Asset paths are relative, so the output works at a host root or a GitHub Pages project path.

### Run the site locally

For development:

```bash
npm run dev
```

Open `http://127.0.0.1:8080`. Changes to HTML, CSS, JavaScript, or yearly data rebuild the site and restart the server. Refresh the browser after the restart. Stop with `Ctrl+C`.

For a single build with no file monitoring:

```bash
npm start
```

This command builds the site and starts a local server. Open `http://127.0.0.1:8080`. Browser caching is disabled. Stop the server with `Ctrl+C`. Restart it after changing source files or data.

To use a different port:

```bash
npm start -- -p 3000
```

### Run build tests

```bash
npm test
```

### Generate a data asset for the source page

```bash
npm run embed
```

This optional command generates the ignored `assets/timeline-data.js` file for the source page. Deployment uses `npm run build` instead.

### Typical local refresh flow

```bash
npm run scrape -- 2026
npm run build
```

## Deployment

### Automatic updates (data refresh)

Workflow: `.github/workflows/update-timeline.yml`

- Runs nightly (01:00 UTC) and on manual dispatch
- Executes: scrape -> verify
- Commits only updated source files in `data/`
- The resulting push starts the Pages build

### GitHub Pages deployment

Workflow: `.github/workflows/deploy-pages.yml`

- Runs on push to `main` and manual dispatch
- Executes `npm ci`, `npm test`, and `npm run build`
- Uploads only `dist/` as the Pages artifact
- Publishes via official Pages actions

Set the repository's Pages source to **GitHub Actions**. For other static hosts, use `npm ci && npm run build` as the build command and `dist` as the publish directory. Do not deploy the repository root.

## Notes

- `dist/` and `assets/timeline-data.js` are generated. Do not edit or commit them.
- `data/*.json` are the canonical input files.
- The scraper keyword is currently set to `Copilot` in `src/scrape_changelog.js`.
