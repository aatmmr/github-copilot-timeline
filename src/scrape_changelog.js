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
  console.log('Starting comprehensive archive exploration...\n');
  
  // 1. Try the main page first
  await tryUrl(BASE_URL, 'Main page');
  
  // 2. Try date-based URLs for each month of 2025
  console.log('\n--- Trying monthly archives ---');
  for (let month = 1; month <= 12; month++) {
    await tryUrl(`${BASE_URL}${YEAR}/${month.toString().padStart(2, '0')}/`, `Month ${month}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 3. Try yearly archive
  console.log('\n--- Trying yearly archives ---');
  await tryUrl(`${BASE_URL}${YEAR}/`, `Year ${YEAR}`);
  
  // 4. Try different pagination formats
  console.log('\n--- Trying different pagination formats ---');
  for (let page = 2; page <= 5; page++) {
    await tryUrl(`${BASE_URL}page/${page}/`, `Page ${page}`);
    await tryUrl(`${BASE_URL}?page=${page}`, `Query Page ${page}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 5. Try sitemap or feed endpoints
  console.log('\n--- Trying alternative endpoints ---');
  const altEndpoints = [
    `${BASE_URL}feed/`,
    `${BASE_URL}sitemap.xml`,
    `${BASE_URL}archive/`,
    `${BASE_URL}all/`,
    'https://github.blog/feed/',
    'https://github.blog/changelog/feed.xml',
    'https://github.blog/changelog/atom.xml',
  ];
  
  for (const endpoint of altEndpoints) {
    await tryUrl(endpoint, `Alt endpoint`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 6. Try searching for older entries using GitHub's search
  console.log('\n--- Trying search endpoints ---');
  const searchUrls = [
    `https://github.blog/search?q=copilot+changelog`,
    `https://github.blog/changelog/?q=copilot`,
    `https://github.blog/changelog/search?q=copilot`,
  ];
  
  for (const searchUrl of searchUrls) {
    await tryUrl(searchUrl, 'Search');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\nExploration complete. Found ${foundEntries.size} unique entries total.`);
  
  // Sort entries by date (newest first)
  entriesData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Create structured JSON output
  const output = {
    metadata: {
      scraped_at: new Date().toISOString(),
      total_entries: entriesData.length,
      year_filter: YEAR,
      keyword_filter: KEYWORD,
      date_range: {
        earliest: entriesData.length > 0 ? entriesData[entriesData.length - 1].date : null,
        latest: entriesData.length > 0 ? entriesData[0].date : null
      }
    },
    entries: entriesData
  };
  
  // Save to JSON file
  const filename = `copilot-timeline-${YEAR}.json`;
  const outputPath = path.join(__dirname, '..', 'data', filename);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Data saved to ${outputPath}`);
  console.log(`📊 Summary: ${entriesData.length} Copilot-related entries from ${YEAR}`);
}

console.log(`Scraping GitHub changelog for year: ${YEAR}`);
exploreArchives();