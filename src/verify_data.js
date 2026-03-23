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

const overallByDate = {};
let overallEntries = 0;

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

    entries.forEach((entry) => {
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

console.log('\n✅ Verification complete for all timeline data files.');