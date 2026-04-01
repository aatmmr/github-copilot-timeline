const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

const dataFiles = fs.readdirSync(dataDir)
    .filter((fileName) => /^copilot-timeline-\d{4}\.json$/.test(fileName))
    .sort();

if (dataFiles.length === 0) {
    throw new Error('No timeline data files found in data/.');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const overallByDate = {};
let overallEntries = 0;
let hasErrors = false;

console.log('📊 JSON Data Summary (all years):');
console.log(`- Files: ${dataFiles.join(', ')}`);

dataFiles.forEach((fileName) => {
    const filePath = path.join(dataDir, fileName);
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const metadata = jsonData.metadata || {};
    const entries = jsonData.entries || [];

    console.log(`\n- ${fileName}`);
    console.log(`  Entries: ${metadata.total_entries ?? entries.length}`);
    console.log(`  Date range: ${metadata.date_range?.earliest ?? 'n/a'} to ${metadata.date_range?.latest ?? 'n/a'}`);
    console.log(`  Year filter: ${metadata.year_filter ?? 'n/a'}`);
    console.log(`  Keyword filter: ${metadata.keyword_filter ?? 'n/a'}`);

    entries.forEach((entry, index) => {
        const ref = `${fileName}[${index}]`;
        if (!entry.date) {
            console.error(`  ❌ Missing 'date' in ${ref}`);
            hasErrors = true;
        } else if (!DATE_RE.test(entry.date)) {
            console.error(`  ❌ Invalid date format '${entry.date}' in ${ref} (expected YYYY-MM-DD)`);
            hasErrors = true;
        }
        if (!entry.title) {
            console.error(`  ❌ Missing 'title' in ${ref}`);
            hasErrors = true;
        }
        if (!entry.url) {
            console.error(`  ❌ Missing 'url' in ${ref}`);
            hasErrors = true;
        }

        const date = entry.date;
        overallByDate[date] = (overallByDate[date] || 0) + 1;
    });

    overallEntries += entries.length;
});

console.log('\n📈 Aggregate Activity Summary:');
console.log(`- Total entries: ${overallEntries}`);
console.log(`- Unique dates with activity: ${Object.keys(overallByDate).length}`);

const topDates = Object.entries(overallByDate).sort((a, b) => b[1] - a[1]);
console.log('\n🔥 Top 10 most active dates (all years):');
topDates.slice(0, 10).forEach(([date, count]) => {
    console.log(`  ${date}: ${count} entries`);
});

const monthlyData = {};
Object.entries(overallByDate).forEach(([date, count]) => {
    const month = date.substring(0, 7);
    monthlyData[month] = (monthlyData[month] || 0) + count;
});

console.log('\n📅 Monthly distribution (all years):');
Object.entries(monthlyData).sort().forEach(([month, count]) => {
    console.log(`  ${month}: ${count} entries`);
});

if (overallEntries === 0) {
    console.error('\n❌ Verification failed: no entries found across all data files.');
    process.exit(1);
}

if (hasErrors) {
    console.error('\n❌ Verification failed: one or more entries have invalid or missing fields.');
    process.exit(1);
}

console.log('\n✅ Verification complete for all timeline data files.');