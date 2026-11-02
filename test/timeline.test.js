const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function loadTimeline(entries = []) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'timeline.js'), 'utf8');
    const context = vm.createContext({
        embeddedTimelineData: { entries },
        document: { getElementById: () => ({}) }
    });
    vm.runInContext(source.slice(0, source.lastIndexOf('\ninitializeState();')), context);
    return context;
}

test('categories support legacy shapes, empty fallbacks and uncategorized entries', () => {
    const context = loadTimeline();
    for (const [entry, expected] of [
        [{ categories: [' Feature ', 'Feature', '', null] }, ['Feature']],
        [{ category: 'Improvement' }, ['Improvement']],
        [{ type: 'Retired' }, ['Retired']],
        [{ categories: [], category: 'Feature' }, ['Feature']],
        [{ category: ' ', type: 'Retired' }, ['Retired']],
        [{}, []]
    ]) {
        context.entry = entry;
        assert.deepEqual(Array.from(vm.runInContext('getEntryCategories(entry)', context)), expected);
    }
});

test('available categories are unique, sorted and cached, including an empty list', () => {
    for (const entries of [[], [
        { category: 'Retired' },
        { categories: ['Improvement', 'Feature', 'Feature'] }
    ]]) {
        const context = loadTimeline(entries);
        const categories = vm.runInContext('getAvailableCategories()', context);
        assert.deepEqual(Array.from(categories), entries.length ? ['Feature', 'Improvement', 'Retired'] : []);
        vm.runInContext('getEntries = () => { throw new Error("Unexpected recomputation"); }', context);
        assert.equal(vm.runInContext('getAvailableCategories()', context), categories);
    }
});

test('category, keyword and date filters combine without excluding historical entries by default', () => {
    const context = loadTimeline([
        { date: '2026-01-02', title: 'Copilot agent', category: 'Feature' },
        { date: '2026-01-03', title: 'Copilot editor', categories: ['Feature', 'Improvement'] },
        { date: '2026-01-04', title: 'Copilot agent', type: 'Retired' },
        { date: '2025-01-02', title: 'Copilot agent', category: 'Feature' },
        { date: '2026-01-05', title: 'Historical Copilot update' }
    ]);
    context.range = { start: '2026-01-01', end: '2026-12-31' };
    assert.equal(vm.runInContext('filterEntries(range).length', context), 4);
    vm.runInContext("state.category = 'Feature'; state.searchTerm = ' AGENT ';", context);
    assert.equal(vm.runInContext('filterEntries(range).length', context), 1);
    vm.runInContext("state.category = ''; state.searchTerm = 'improvement';", context);
    assert.equal(vm.runInContext('filterEntries(range).length', context), 1);
});

test('category dropdown escapes metadata and preserves selection', () => {
    const context = loadTimeline([{ category: '<img src=x onerror=alert(1)>' }]);
    vm.runInContext(`
        updateControlsVisibility = () => {};
        updateNavButtons = () => {};
        state.category = '<img src=x onerror=alert(1)>';
        renderControls();
    `, context);
    const html = vm.runInContext('elements.categorySelect.innerHTML', context);
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img'));
    assert.equal(vm.runInContext('elements.categorySelect.value', context), '<img src=x onerror=alert(1)>');
});

test('day details escape category badges and omit them for historical entries', () => {
    const context = loadTimeline();
    context.document.createElement = () => ({
        children: [],
        appendChild(child) { this.children.push(child); },
        addEventListener() {}
    });
    vm.runInContext(`
        elements.dayEntryList.children = [];
        elements.dayEntryList.appendChild = function(child) { this.children.push(child); };
        setPreviewEntry = () => {};
        renderDayModalContent('2026-01-02', [
            { title: '<b>Copilot</b>', url: 'https://github.blog/one', category: '<script>alert(1)</script>' },
            { title: 'Historical update', url: 'https://github.blog/two' }
        ]);
    `, context);
    const items = vm.runInContext('elements.dayEntryList.children', context);
    const categorizedHtml = items[0].children[0].innerHTML;
    assert.ok(categorizedHtml.includes('category-badge'));
    assert.ok(categorizedHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(categorizedHtml.includes('&lt;b&gt;Copilot&lt;/b&gt;'));
    assert.ok(!categorizedHtml.includes('<script>'));
    assert.ok(!items[1].children[0].innerHTML.includes('category-badge'));
});

test('scraper normalizes category labels and falls back to slugs for blank labels', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'scrape_changelog.js'), 'utf8');
    const context = vm.createContext({ require: () => ({}), process: { argv: [] } });
    vm.runInContext(source.slice(0, source.indexOf('\nasync function fetchEntryPreview')), context);
    for (const [label, slug, expected] of [
        ['features', 'features', 'Feature'],
        [' Improvements ', 'improvements', 'Improvement'],
        ['deprecations', 'deprecations', 'Retired'],
        [' \n ', 'new-release', 'New release']
    ]) {
        context.scope = {
            find: () => ({
                first: () => ({
                    length: 1,
                    attr: () => `/changelog/type/${slug}/`,
                    text: () => label
                })
            })
        };
        assert.equal(vm.runInContext('extractCategory(null, scope)', context), expected);
    }
    context.scope = { find: () => ({ first: () => ({ length: 0 }) }) };
    assert.equal(vm.runInContext('extractCategory(null, scope)', context), '');
});
