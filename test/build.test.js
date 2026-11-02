const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { buildSite } = require('../src/create_site');

function createFixture(t) {
    const rootDir = fs.mkdtempSync(path.join(__dirname, '.build-test-'));
    t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(rootDir, 'data'));
    fs.mkdirSync(path.join(rootDir, 'assets'));
    fs.copyFileSync(
        path.join(__dirname, '..', 'copilot-timeline.html'),
        path.join(rootDir, 'copilot-timeline.html')
    );
    for (const name of ['timeline.css', 'timeline.js']) {
        fs.copyFileSync(
            path.join(__dirname, '..', 'assets', name),
            path.join(rootDir, 'assets', name)
        );
    }
    for (const year of [2025, 2026]) {
        fs.writeFileSync(path.join(rootDir, 'data', `copilot-timeline-${year}.json`), JSON.stringify({
            metadata: { year_filter: year, total_entries: 2 },
            entries: [
                { date: `${year}-01-02`, title: 'Copilot update', url: `https://github.blog/${year}` },
                { date: `${year}-01-02`, title: 'Copilot update', url: `https://github.blog/${year}` }
            ]
        }));
    }
    return rootDir;
}

test('build produces a complete static site without changing source files', (t) => {
    const rootDir = createFixture(t);
    fs.writeFileSync(path.join(rootDir, 'assets', 'timeline-data.js'), 'stale source data');
    fs.writeFileSync(path.join(rootDir, 'assets', 'unrelated.txt'), 'not a site asset');
    const outputDir = buildSite(rootDir);
    const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');

    assert.equal(html, fs.readFileSync(path.join(rootDir, 'copilot-timeline.html'), 'utf8'));
    assert.equal(html, fs.readFileSync(path.join(outputDir, 'copilot-timeline.html'), 'utf8'));
    assert.deepEqual(fs.readdirSync(outputDir).sort(), ['.nojekyll', 'assets', 'copilot-timeline.html', 'index.html']);
    assert.deepEqual(fs.readdirSync(path.join(outputDir, 'assets')).sort(), [
        'timeline-data.js', 'timeline.css', 'timeline.js'
    ]);
    for (const match of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
        assert.ok(fs.existsSync(path.join(outputDir, match[1])), `Missing asset: ${match[1]}`);
        assert.equal(new URL(match[1], 'https://example.com/project/').pathname, `/project/${match[1]}`);
    }
    for (const name of ['timeline.css', 'timeline.js']) {
        assert.deepEqual(
            fs.readFileSync(path.join(outputDir, 'assets', name)),
            fs.readFileSync(path.join(rootDir, 'assets', name))
        );
    }
    const data = vm.runInNewContext(
        `${fs.readFileSync(path.join(outputDir, 'assets', 'timeline-data.js'), 'utf8')}\nembeddedTimelineData`
    );
    assert.deepEqual(Array.from(data.manifest.years), [2025, 2026]);
    assert.equal(data.manifest.totalEntries, 2);
    assert.equal(data.entries.length, 2);
    assert.equal(data.entries[0].year, 2025);
    assert.equal(data.entries[1].year, 2026);
    assert.equal(fs.readFileSync(path.join(rootDir, 'assets', 'timeline-data.js'), 'utf8'), 'stale source data');
});

test('rebuild removes stale output and produces the same data', (t) => {
    const rootDir = createFixture(t);
    const outputDir = buildSite(rootDir);
    const dataPath = path.join(outputDir, 'assets', 'timeline-data.js');
    const firstData = fs.readFileSync(dataPath, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'stale.txt'), 'old output');
    buildSite(rootDir);
    assert.equal(fs.existsSync(path.join(outputDir, 'stale.txt')), false);
    assert.equal(fs.readFileSync(dataPath, 'utf8'), firstData);
    assert.equal(fs.existsSync(path.join(rootDir, 'assets', 'timeline-data.js')), false);
});

test('invalid or missing inputs fail before replacing an existing build', (t) => {
    const rootDir = createFixture(t);
    const outputDir = buildSite(rootDir);
    const dataPath = path.join(rootDir, 'data', 'copilot-timeline-2025.json');
    const originalData = fs.readFileSync(dataPath);
    const html = fs.readFileSync(path.join(outputDir, 'index.html'));

    fs.writeFileSync(dataPath, '{invalid JSON');
    assert.throws(() => buildSite(rootDir), SyntaxError);
    assert.deepEqual(fs.readFileSync(path.join(outputDir, 'index.html')), html);
    fs.writeFileSync(dataPath, originalData);
    fs.unlinkSync(path.join(rootDir, 'assets', 'timeline.css'));
    assert.throws(() => buildSite(rootDir), { code: 'ENOENT' });
    assert.deepEqual(fs.readFileSync(path.join(outputDir, 'index.html')), html);
    for (const file of fs.readdirSync(path.join(rootDir, 'data'))) {
        fs.unlinkSync(path.join(rootDir, 'data', file));
    }
    assert.throws(() => buildSite(rootDir), /No timeline data files/);
});
