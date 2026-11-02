const fs = require('fs');
const path = require('path');
const { loadTimelineData, writeDataFile } = require('./embed_data');

function buildSite(rootDir = path.join(__dirname, '..')) {
    const dataset = loadTimelineData(path.join(rootDir, 'data'));
    const html = fs.readFileSync(path.join(rootDir, 'copilot-timeline.html'));
    const assets = ['timeline.css', 'timeline.js'].map((name) => ({
        name,
        content: fs.readFileSync(path.join(rootDir, 'assets', name))
    }));
    const outputDir = path.join(rootDir, 'dist');

    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(outputDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'index.html'), html);
    fs.writeFileSync(path.join(outputDir, 'copilot-timeline.html'), html);
    assets.forEach(({ name, content }) => {
        fs.writeFileSync(path.join(outputDir, 'assets', name), content);
    });
    writeDataFile(dataset, path.join(outputDir, 'assets', 'timeline-data.js'));
    fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

    return outputDir;
}

if (require.main === module) {
    console.log(`Built site in ${buildSite()}`);
}

module.exports = { buildSite };
