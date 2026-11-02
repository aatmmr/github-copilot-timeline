/* Timeline app — references embeddedTimelineData defined inline in copilot-timeline.html */

// --- Theme management ---

const THEME_KEY = 'theme-preference';
const THEME_CYCLE = ['auto', 'dark', 'light'];
const THEME_LABELS = { auto: 'Auto', dark: 'Dark', light: 'Light' };
const THEME_ICONS = { auto: '🖥️', dark: '🌙', light: '☀️' };

function detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    const resolved = theme === 'auto' ? detectSystemTheme() : theme;
    if (resolved === 'dark') {
        delete document.documentElement.dataset.theme;
    } else {
        document.documentElement.dataset.theme = 'light';
    }
}

function getStoredPreference() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}

function storePreference(preference) {
    try {
        localStorage.setItem(THEME_KEY, preference);
    } catch {
        /* localStorage unavailable */
    }
}

function updateThemeToggleUI(preference) {
    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('theme-toggle-label');
    if (icon) { icon.textContent = THEME_ICONS[preference] || THEME_ICONS.auto; }
    if (label) { label.textContent = THEME_LABELS[preference] || THEME_LABELS.auto; }
}

function initTheme() {
    const stored = getStoredPreference();
    const preference = THEME_CYCLE.includes(stored) ? stored : 'auto';
    applyTheme(preference);
    updateThemeToggleUI(preference);
}

function cycleTheme() {
    const current = getStoredPreference() || 'auto';
    const index = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
    storePreference(next);
    applyTheme(next);
    updateThemeToggleUI(next);
}

// Apply theme immediately to avoid flash
initTheme();

// Listen for system theme changes (applies only when preference is 'auto')
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const preference = getStoredPreference() || 'auto';
    if (preference === 'auto') {
        applyTheme('auto');
    }
});

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const state = {
    mode: 'year',
    year: null,
    month: 0,
    customStart: '',
    customEnd: '',
    searchTerm: '',
    selectedDate: null,
    selectedEntryUrl: null
};

const elements = {
    navPrev: document.getElementById('nav-prev'),
    navNext: document.getElementById('nav-next'),
    viewMode: document.getElementById('view-mode'),
    yearSelect: document.getElementById('year-select'),
    monthSelect: document.getElementById('month-select'),
    monthField: document.getElementById('month-field'),
    customStartField: document.getElementById('custom-start-field'),
    customEndField: document.getElementById('custom-end-field'),
    customStart: document.getElementById('custom-start'),
    customEnd: document.getElementById('custom-end'),
    searchInput: document.getElementById('search-input'),
    timelineTitle: document.getElementById('timeline-title'),
    timelineSubtitle: document.getElementById('timeline-subtitle'),
    statTotalEntries: document.getElementById('stat-total-entries'),
    statActiveDays: document.getElementById('stat-active-days'),
    statAverageWeek: document.getElementById('stat-average-week'),
    statBusiestDay: document.getElementById('stat-busiest-day'),
    monthLabels: document.getElementById('month-labels'),
    heatmap: document.getElementById('heatmap'),
    tooltip: document.getElementById('tooltip'),
    modal: document.getElementById('day-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    modalClose: document.getElementById('modal-close'),
    dayEntryList: document.getElementById('day-entry-list'),
    dayEmptyState: document.getElementById('day-empty-state'),
    previewTitle: document.getElementById('preview-title'),
    previewMeta: document.getElementById('preview-meta'),
    previewStatus: document.getElementById('preview-status'),
    previewOpenLink: document.getElementById('preview-open-link'),
    previewContent: document.getElementById('preview-content')
};

// --- Utilities ---

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseUtcDate(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
    const nextDate = new Date(date.getTime());
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function startOfWeekMonday(date) {
    const monday = new Date(date.getTime());
    const day = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - (day - 1));
    return monday;
}

function endOfWeekSunday(date) {
    return addUtcDays(startOfWeekMonday(date), 6);
}

function daysBetweenInclusive(startIso, endIso) {
    const start = parseUtcDate(startIso);
    const end = parseUtcDate(endIso);
    return Math.floor((end - start) / 86400000) + 1;
}

function formatLongDate(isoDate) {
    return parseUtcDate(isoDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

function formatShortRange(startIso, endIso) {
    const start = parseUtcDate(startIso);
    const end = parseUtcDate(endIso);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} to ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

// --- Data access ---

function getAvailableYears() {
    return embeddedTimelineData.manifest?.years || [];
}

function getEntries() {
    return embeddedTimelineData.entries || [];
}

function getDefaultYear() {
    const availableYears = getAvailableYears();
    const currentYear = new Date().getUTCFullYear();
    if (availableYears.includes(currentYear)) {
        return currentYear;
    }
    return embeddedTimelineData.manifest?.currentYear || availableYears[availableYears.length - 1] || currentYear;
}

function getDefaultCustomRange() {
    const defaultYear = getDefaultYear();
    return {
        start: `${defaultYear}-01-01`,
        end: `${defaultYear}-12-31`
    };
}

function buildEntriesByDate(entries) {
    return entries.reduce((result, entry) => {
        if (!result[entry.date]) {
            result[entry.date] = [];
        }
        result[entry.date].push(entry);
        return result;
    }, {});
}

// --- State → range ---

function getRangeFromState() {
    if (state.mode === 'month') {
        const startDate = new Date(Date.UTC(state.year, state.month, 1));
        const endDate = new Date(Date.UTC(state.year, state.month + 1, 0));
        return {
            start: formatIsoDate(startDate),
            end: formatIsoDate(endDate),
            label: `${MONTH_NAMES[state.month]} ${state.year}`
        };
    }

    if (state.mode === 'custom') {
        const fallback = getDefaultCustomRange();
        let start = state.customStart || fallback.start;
        let end = state.customEnd || fallback.end;
        if (start > end) {
            const swap = start;
            start = end;
            end = swap;
        }
        return {
            start,
            end,
            label: `Custom period · ${formatShortRange(start, end)}`
        };
    }

    return {
        start: `${state.year}-01-01`,
        end: `${state.year}-12-31`,
        label: `${state.year}`
    };
}

// --- Filtering ---

function filterEntries(range) {
    const term = state.searchTerm.trim().toLowerCase();
    return getEntries().filter((entry) => {
        if (entry.date < range.start || entry.date > range.end) {
            return false;
        }
        if (!term) {
            return true;
        }
        const searchable = [
            entry.title || '',
            entry.preview?.excerpt || '',
            entry.source || '',
            entry.url || ''
        ].join(' ').toLowerCase();
        return searchable.includes(term);
    });
}

// --- Heatmap helpers ---

function getLevel(count) {
    if (count >= 5) { return 4; }
    if (count >= 3) { return 3; }
    if (count === 2) { return 2; }
    if (count === 1) { return 1; }
    return 0;
}

// --- Navigation ---

function navigate(direction) {
    const years = getAvailableYears();
    if (state.mode === 'year') {
        const idx = years.indexOf(state.year);
        const nextIdx = idx + direction;
        if (nextIdx >= 0 && nextIdx < years.length) {
            state.year = years[nextIdx];
            render();
        }
    } else if (state.mode === 'month') {
        let month = state.month + direction;
        let year = state.year;
        if (month < 0) {
            year -= 1;
            month = 11;
        } else if (month > 11) {
            year += 1;
            month = 0;
        }
        const minYear = years[0];
        const maxYear = years[years.length - 1];
        if (year >= minYear && year <= maxYear) {
            state.year = year;
            state.month = month;
            render();
        }
    }
}

function updateNavButtons() {
    if (state.mode === 'custom') {
        elements.navPrev.disabled = true;
        elements.navNext.disabled = true;
        return;
    }
    const years = getAvailableYears();
    if (state.mode === 'year') {
        const idx = years.indexOf(state.year);
        elements.navPrev.disabled = idx <= 0;
        elements.navNext.disabled = idx >= years.length - 1;
    } else {
        const minYear = years[0];
        const maxYear = years[years.length - 1];
        elements.navPrev.disabled = state.year === minYear && state.month === 0;
        elements.navNext.disabled = state.year === maxYear && state.month === 11;
    }
}

// --- Rendering: controls ---

function updateControlsVisibility() {
    elements.monthField.classList.toggle('hidden', state.mode !== 'month');
    elements.customStartField.classList.toggle('hidden', state.mode !== 'custom');
    elements.customEndField.classList.toggle('hidden', state.mode !== 'custom');
}

function renderControls() {
    const years = getAvailableYears();
    elements.yearSelect.innerHTML = years
        .map((year) => `<option value="${year}">${year}</option>`)
        .join('');
    elements.monthSelect.innerHTML = MONTH_NAMES
        .map((month, index) => `<option value="${index}">${month}</option>`)
        .join('');

    elements.viewMode.value = state.mode;
    elements.yearSelect.value = String(state.year);
    elements.monthSelect.value = String(state.month);
    elements.customStart.value = state.customStart;
    elements.customEnd.value = state.customEnd;
    elements.searchInput.value = state.searchTerm;
    updateControlsVisibility();
    updateNavButtons();
}

// --- Rendering: stats ---

function renderStats(range, entries) {
    const entriesByDate = buildEntriesByDate(entries);
    const activeDates = Object.keys(entriesByDate).sort();
    const totalEntries = entries.length;
    const activeDays = activeDates.length;
    const weeks = Math.max(daysBetweenInclusive(range.start, range.end) / 7, 1);
    const averagePerWeek = (totalEntries / weeks).toFixed(1);

    let busiestDayLabel = 'None';
    if (activeDates.length > 0) {
        const busiestDay = activeDates.reduce((bestDate, currentDate) => {
            if (!bestDate) { return currentDate; }
            return entriesByDate[currentDate].length > entriesByDate[bestDate].length ? currentDate : bestDate;
        }, null);
        busiestDayLabel = `${formatLongDate(busiestDay)} · ${entriesByDate[busiestDay].length}`;
    }

    elements.statTotalEntries.textContent = String(totalEntries);
    elements.statActiveDays.textContent = String(activeDays);
    elements.statAverageWeek.textContent = averagePerWeek;
    elements.statBusiestDay.textContent = busiestDayLabel;
    elements.timelineTitle.textContent = `GitHub Copilot Changes · ${range.label}`;
    elements.timelineSubtitle.textContent = `${formatShortRange(range.start, range.end)} · ${totalEntries} entries across ${activeDays} active days`;
}

// --- Tooltip ---

function hideTooltip() {
    elements.tooltip.style.display = 'none';
}

function showTooltip(event, text) {
    elements.tooltip.textContent = text;
    elements.tooltip.style.display = 'block';
    elements.tooltip.style.left = `${event.clientX + 14}px`;
    elements.tooltip.style.top = `${event.clientY + 14}px`;
}

// --- Preview panel ---

function setPreviewEntry(entry) {
    if (!entry) {
        state.selectedEntryUrl = null;
        elements.previewTitle.textContent = 'Select an entry';
        elements.previewMeta.textContent = 'Pick an item from the list to inspect its changelog source.';
        elements.previewStatus.textContent = 'Preview content is loaded from the scraped timeline data.';
        elements.previewOpenLink.href = '#';
        elements.previewOpenLink.setAttribute('aria-disabled', 'true');
        elements.previewContent.innerHTML = '<p>Select an entry to see its preview content.</p>';
        return;
    }

    state.selectedEntryUrl = entry.url;
    elements.previewTitle.textContent = entry.title;
    elements.previewMeta.textContent = `${formatLongDate(entry.date)} · Source: ${entry.source || 'Unknown'} · Year ${entry.year}`;
    elements.previewOpenLink.href = entry.url;
    elements.previewOpenLink.removeAttribute('aria-disabled');

    const previewHtml = entry.preview?.html || '';
    const previewExcerpt = entry.preview?.excerpt || '';

    if (previewHtml) {
        elements.previewContent.innerHTML = previewHtml;
        elements.previewStatus.textContent = 'Preview content was captured during scraping.';
    } else if (previewExcerpt) {
        elements.previewContent.innerHTML = `<p>${escapeHtml(previewExcerpt)}</p>`;
        elements.previewStatus.textContent = 'Showing extracted excerpt captured during scraping.';
    } else {
        elements.previewContent.innerHTML = '<p>No preview content was captured for this entry during scraping.</p>';
        elements.previewStatus.textContent = 'No local preview available for this entry. Use the Open original entry button.';
    }
}

// --- Modal ---

function renderDayModalContent(dateString, dayEntries) {
    elements.modalTitle.textContent = formatLongDate(dateString);
    elements.modalSubtitle.textContent = `${dayEntries.length} changelog entr${dayEntries.length === 1 ? 'y' : 'ies'} on this day`;
    elements.dayEntryList.innerHTML = '';

    if (dayEntries.length === 0) {
        elements.dayEmptyState.hidden = false;
        setPreviewEntry(null);
        return;
    }

    elements.dayEmptyState.hidden = true;
    const selectedEntry = dayEntries.find((e) => e.url === state.selectedEntryUrl) || dayEntries[0];
    dayEntries.forEach((entry) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `entry-item${entry.url === selectedEntry.url ? ' active' : ''}`;
        item.innerHTML = `
            <span class="entry-item-title">${entry.title}</span>
            <span class="entry-item-meta">${entry.source || 'Unknown source'} · ${entry.url}</span>
        `;
        item.addEventListener('click', () => {
            document.querySelectorAll('.entry-item').forEach((entryItem) => entryItem.classList.remove('active'));
            item.classList.add('active');
            state.selectedEntryUrl = entry.url;
            setPreviewEntry(entry);
        });
        const listItem = document.createElement('li');
        listItem.appendChild(item);
        elements.dayEntryList.appendChild(listItem);
    });
    setPreviewEntry(selectedEntry);
}

function openDayModal(dateString, dayEntries) {
    state.selectedDate = dateString;
    state.selectedEntryUrl = dayEntries[0]?.url || null;
    elements.modal.classList.add('open');
    elements.modal.setAttribute('aria-hidden', 'false');
    renderDayModalContent(dateString, dayEntries);
}

function closeModal() {
    elements.modal.classList.remove('open');
    elements.modal.setAttribute('aria-hidden', 'true');
}

// --- Rendering: heatmap ---

function renderHeatmap(range, entries) {
    const entriesByDate = buildEntriesByDate(entries);
    const startDate = parseUtcDate(range.start);
    const endDate = parseUtcDate(range.end);
    const gridStart = startOfWeekMonday(startDate);
    const gridEnd = endOfWeekSunday(endDate);
    const totalWeeks = Math.round((gridEnd - gridStart) / 604800000) + 1;
    let previousLabelMonth = null;

    elements.monthLabels.innerHTML = '';
    elements.heatmap.innerHTML = '';

    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
        const weekStart = addUtcDays(gridStart, weekIndex * 7);
        const weekDates = Array.from({ length: 7 }, (_, dayIndex) => addUtcDays(weekStart, dayIndex));
        const labelCandidate = weekDates.find((date) => {
            const isoDate = formatIsoDate(date);
            return isoDate >= range.start && isoDate <= range.end && date.getUTCDate() <= 7;
        }) || weekDates.find((date) => {
            const isoDate = formatIsoDate(date);
            return isoDate >= range.start && isoDate <= range.end;
        });

        const label = document.createElement('div');
        label.className = 'month-label';
        if (labelCandidate) {
            const labelMonth = `${labelCandidate.getUTCFullYear()}-${labelCandidate.getUTCMonth()}`;
            if (labelMonth !== previousLabelMonth) {
                label.textContent = `${MONTH_SHORT[labelCandidate.getUTCMonth()]} ${labelCandidate.getUTCFullYear()}`;
                previousLabelMonth = labelMonth;
            }
        }
        elements.monthLabels.appendChild(label);
    }

    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
        const weekStart = addUtcDays(gridStart, weekIndex * 7);
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            const currentDate = addUtcDays(weekStart, dayIndex);
            const isoDate = formatIsoDate(currentDate);
            const square = document.createElement('button');
            square.type = 'button';
            square.className = 'heatmap-square';

            if (isoDate < range.start || isoDate > range.end) {
                square.classList.add('out-of-range');
                elements.heatmap.appendChild(square);
                continue;
            }

            const dayEntries = entriesByDate[isoDate] || [];
            const count = dayEntries.length;
            square.setAttribute('data-level', String(getLevel(count)));
            square.setAttribute('aria-label', `${count} Copilot changelog entr${count === 1 ? 'y' : 'ies'} on ${formatLongDate(isoDate)}`);
            square.textContent = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
            if (state.selectedDate === isoDate) {
                square.classList.add('selected');
            }

            square.addEventListener('mouseenter', (event) => {
                const label = count === 0
                    ? `No Copilot changes on ${formatLongDate(isoDate)}`
                    : `${count} Copilot changelog entr${count === 1 ? 'y' : 'ies'} on ${formatLongDate(isoDate)}`;
                showTooltip(event, label);
            });
            square.addEventListener('mousemove', (event) => {
                if (elements.tooltip.style.display === 'block') {
                    elements.tooltip.style.left = `${event.clientX + 14}px`;
                    elements.tooltip.style.top = `${event.clientY + 14}px`;
                }
            });
            square.addEventListener('mouseleave', hideTooltip);
            square.addEventListener('click', () => openDayModal(isoDate, dayEntries));

            elements.heatmap.appendChild(square);
        }
    }
}

// --- Main render loop ---

function render() {
    const range = getRangeFromState();
    const filteredEntries = filterEntries(range);
    renderControls();
    renderStats(range, filteredEntries);
    renderHeatmap(range, filteredEntries);
    if (elements.modal.classList.contains('open') && state.selectedDate) {
        const entriesByDate = buildEntriesByDate(filteredEntries);
        renderDayModalContent(state.selectedDate, entriesByDate[state.selectedDate] || []);
    }
}

// --- Initialization ---

function initializeState() {
    const defaultYear = getDefaultYear();
    const defaultRange = getDefaultCustomRange();
    state.year = defaultYear;
    state.month = new Date().getUTCMonth();
    state.customStart = defaultRange.start;
    state.customEnd = defaultRange.end;
}

function attachEvents() {
    elements.viewMode.addEventListener('change', (event) => {
        state.mode = event.target.value;
        render();
    });
    elements.yearSelect.addEventListener('change', (event) => {
        state.year = Number(event.target.value);
        render();
    });
    elements.monthSelect.addEventListener('change', (event) => {
        state.month = Number(event.target.value);
        render();
    });
    elements.customStart.addEventListener('change', (event) => {
        state.customStart = event.target.value;
        render();
    });
    elements.customEnd.addEventListener('change', (event) => {
        state.customEnd = event.target.value;
        render();
    });
    elements.searchInput.addEventListener('input', (event) => {
        state.searchTerm = event.target.value;
        render();
    });
    elements.navPrev.addEventListener('click', () => navigate(-1));
    elements.navNext.addEventListener('click', () => navigate(1));
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.closeModal === 'true') {
            closeModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.modal.classList.contains('open')) {
            closeModal();
        }
    });

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', cycleTheme);
    }
}

initializeState();
attachEvents();
render();
