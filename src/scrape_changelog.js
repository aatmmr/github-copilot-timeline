const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://github.blog/changelog/';
const YEAR = process.argv[2] ? parseInt(process.argv[2], 10) : new Date().getFullYear();
const KEYWORD = 'Copilot';
const PREVIEW_MAX_PARAGRAPHS = 3;
const PREVIEW_MAX_CHARS = 900;

// Try different URL patterns that might exist for archives
const urlPatterns = [
  // Standard pagination
  (page) => `${BASE_URL}page/${page}/`,
  // Date-based URLs
  (month) => `${BASE_URL}${YEAR}/${month.toString().padStart(2, '0')}/`,
  // Yearly archives
  (year) => `${BASE_URL}${year}/`,
  // Weekly/monthly archives
  (week) => `${BASE_URL}week/${week}/`,
  (month) => `${BASE_URL}month/${month}/`,
];

const foundEntries = new Set(); // Track unique entries to avoid duplicates
const entriesData = []; // Store structured data for JSON output
const previewCache = new Map();

function normalizeWhitespace(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPreviewHtml(paragraphs) {
  return paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

async function fetchEntryPreview(url) {
  if (previewCache.has(url)) {
    return previewCache.get(url);
  }

  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(data);
    $('script, style, noscript').remove();

    const metaDescription = normalizeWhitespace(
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content')
    );

    let paragraphs = [];
    const paragraphCandidates = [
      'article p',
      '.post-content p',
      '.entry-content p',
      'main p'
    ];

    for (const selector of paragraphCandidates) {
      const values = $(selector)
        .map((_, element) => normalizeWhitespace($(element).text()))
        .get()
        .filter((value) => value.length >= 40);

      if (values.length > 0) {
        paragraphs = values;
        break;
      }
    }

    const selectedParagraphs = paragraphs.slice(0, PREVIEW_MAX_PARAGRAPHS);
    let excerpt = metaDescription || normalizeWhitespace(selectedParagraphs.join(' '));
    if (excerpt.length > PREVIEW_MAX_CHARS) {
      excerpt = `${excerpt.slice(0, PREVIEW_MAX_CHARS - 1)}…`;
    }

    const preview = {
      excerpt,
      html: buildPreviewHtml(selectedParagraphs),
      hasContent: Boolean(excerpt || selectedParagraphs.length > 0)
    };

    previewCache.set(url, preview);
    return preview;
  } catch (error) {
    const fallback = {
      excerpt: '',
      html: '',
      hasContent: false,
      error: error.message
    };
    previewCache.set(url, fallback);
    return fallback;
  }
}

async function tryUrl(url, context = '') {
  try {
    console.log(`Trying ${context}: ${url}`);
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    let entriesFound = 0;
    
    // Try various selectors
    const selectors = ['.changelog-post', 'article', '.post', '.entry'];
    let posts = $();
    
    for (const selector of selectors) {
      const foundPosts = $(selector);
      if (foundPosts.length > 0) {
        posts = foundPosts;
        break;
      }
    }
    
    for (const el of posts.toArray()) {
      const $el = $(el);
      
      const title = $el.find('.changelog-post-title, h1 a, h2 a, h3 a, h4 a, .entry-title, .post-title').text().trim() ||
                   $el.find('a').first().text().trim();
                   
      const date = $el.find('relative-time').attr('datetime') ||
                  $el.find('time').attr('datetime') ||
                  $el.find('[datetime]').attr('datetime');
                  
      const link = $el.find('.changelog-post-title a, h1 a, h2 a, h3 a, h4 a, .entry-title a, .post-title a').attr('href') ||
                  $el.find('a').first().attr('href');
      
      if (title && date && link) {
        const entryKey = `${date}-${title}`;
        
        if (!foundEntries.has(entryKey)) {
          foundEntries.add(entryKey);
          
          const entryYear = new Date(date).getFullYear();
          const matchesYear = !YEAR || entryYear === YEAR;
          const matchesKeyword = !KEYWORD || title.toLowerCase().includes(KEYWORD.toLowerCase());
          
          if (matchesYear && matchesKeyword) {
            entriesFound++;
            const fullLink = link.startsWith('/') ? `https://github.blog${link}` : link;
            const preview = await fetchEntryPreview(fullLink);
            
            // Store structured data
            const entryData = {
              date: date.slice ? date.slice(0, 10) : date,
              title: title,
              url: fullLink,
              source: context,
              year: entryYear,
              preview: {
                excerpt: preview.excerpt,
                html: preview.html,
                hasContent: preview.hasContent
              }
            };
            entriesData.push(entryData);
            
            console.log(`✓ [${context}] ${entryData.date} - ${title}`);
            console.log(`  ${fullLink}\n`);
          }
        }
      }
    }
    
    if (entriesFound > 0) {
      console.log(`Found ${entriesFound} new matching entries from ${context}`);
    }
    
    return entriesFound > 0;
    
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log(`404: ${context} - ${url}`);
    } else {
      console.log(`Error ${context}: ${err.message}`);
    }
    return false;
  }
}

async function exploreArchives() {
  console.log('Starting archive exploration (current month only)...\n');

  // Get current month
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const isCurrentYear = YEAR === currentYear;

  if (isCurrentYear) {
    console.log(`Fetching data for months 1–${currentMonth} of ${YEAR}\n`);
    for (let month = 1; month <= currentMonth; month++) {
      console.log(`--- Trying month ${month}/${YEAR} ---`);
      await tryUrl(`${BASE_URL}${YEAR}/${month.toString().padStart(2, '0')}/`, `Month ${month}`);
    }
  } else {
    console.log(`Fetching all months for year ${YEAR}...\n`);
    for (let month = 1; month <= 12; month++) {
      console.log(`--- Trying month ${month}/${YEAR} ---`);
      await tryUrl(`${BASE_URL}${YEAR}/${month.toString().padStart(2, '0')}/`, `Month ${month}`);
    }
  }

  console.log(`\nExploration complete. Found ${foundEntries.size} unique entries total.`);
  
  // Sort entries by date (newest first)
  entriesData.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Load existing data and merge with newly scraped entries
  const filename = `copilot-timeline-${YEAR}.json`;
  const outputPath = path.join(__dirname, '..', 'data', filename);
  let allEntries = entriesData;

  if (fs.existsSync(outputPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const existingEntries = existingData.entries || [];

      // Create a set of new entry keys for quick lookup
      const newEntryKeys = new Set(entriesData.map(e => `${e.date}-${e.title}`));

      // Add existing entries that are not in the newly scraped data
      let kept = 0;
      for (const existingEntry of existingEntries) {
        const entryKey = `${existingEntry.date}-${existingEntry.title}`;
        if (!newEntryKeys.has(entryKey)) {
          allEntries.push(existingEntry);
          kept++;
        }
      }

      console.log(`\n📦 Merged with existing data. Kept ${kept} existing entries not found in this scrape.`);
    } catch (err) {
      console.log(`\n⚠️  Could not read existing data, starting fresh: ${err.message}`);
    }
  }

  // Re-sort all entries by date (newest first)
  allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Create structured JSON output
  const output = {
    metadata: {
      scraped_at: new Date().toISOString(),
      total_entries: allEntries.length,
      year_filter: YEAR,
      keyword_filter: KEYWORD,
      date_range: {
        earliest: allEntries.length > 0 ? allEntries[allEntries.length - 1].date : null,
        latest: allEntries.length > 0 ? allEntries[0].date : null
      }
    },
    entries: allEntries
  };

  // Save to JSON file
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Data saved to ${outputPath}`);
  console.log(`📊 Summary: ${allEntries.length} total Copilot-related entries from ${YEAR}`);
}

console.log(`Scraping GitHub changelog for year: ${YEAR}`);
exploreArchives();