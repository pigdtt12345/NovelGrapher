/*
 * Character Atlas — frontend
 * ---------------------------------------------------------------
 * Talks to a Django backend. Only ONE endpoint is assumed to exist
 * today (GET /api/novels/). The other two are the contract this
 * frontend expects you to build next — see README.md. Until they
 * exist, this file transparently falls back to generated mock data
 * so the UI is fully demoable.
 * ---------------------------------------------------------------
 */

const CONFIG = {
    // Point this at your Django server. Leave as '' if the frontend
    // is served from the same origin as Django.
    API_BASE: '',
    ENDPOINTS: {
        novels: () => `${CONFIG.API_BASE}/api/novels/`,
        timeline: (novelId) => `${CONFIG.API_BASE}/api/novels/${novelId}/timeline/`,
        relationships: (novelId, chapter) =>
            `${CONFIG.API_BASE}/api/novels/${novelId}/relationships/?chapter=${chapter}`,
    },
    DEBOUNCE_MS: 200,
};

const state = {
    novels: [],
    currentNovel: null,
    chapterMin: 1,
    chapterMax: 1,
    currentChapter: 1,
    selectedNodeId: null,
    simulation: null,
    viewport: null,     // <g> that holds links/nodes/labels and gets zoomed
    zoom: null,         // d3.zoom behavior
    userZoomed: false,  // true once the user pans/zooms manually; stops auto-fit
    payload: null,      // latest raw API response for the shown chapter (used by the table)
    graph: {nodes: [], edges: []}, // {nodes, edges} built from payload for the shown chapter
    links: [],          // link objects currently bound to the force simulation
    shownChapter: 1,    // chapter the graph/table are currently showing
    query: '',          // current text in the character search box
};

// ---------------------------------------------------------------
// Small fetch helper — returns parsed JSON or throws.
// ---------------------------------------------------------------
async function fetchJSON(url) {
    const res = await fetch(url, {cache: 'no-store'});
    if (!res.ok) throw new Error(`Request to ${url} failed: ${res.status}`);
    return res.json();
}

// ---------------------------------------------------------------
// View switching
// ---------------------------------------------------------------
const el = {
    viewList: document.getElementById('view-list'),
    viewGraph: document.getElementById('view-graph'),
    backBtn: document.getElementById('backBtn'),
    novelSubtitle: document.getElementById('novelSubtitle'),
    novelList: document.getElementById('novelList'),
    listStatus: document.getElementById('listStatus'),
    searchInput: document.getElementById('searchInput'),
    svg: d3.select('#graphSvg'),
    sidePanel: document.getElementById('sidePanel'),
    selectedName: document.getElementById('selectedName'),
    selectedRole: document.getElementById('selectedRole'),
    selectedEdges: document.getElementById('selectedEdges'),
    emptyState: document.getElementById('emptyState'),
    slider: document.getElementById('chapterSlider'),
    chapterMinLabel: document.getElementById('chapterMinLabel'),
    chapterMaxLabel: document.getElementById('chapterMaxLabel'),
    chapterNowLabel: document.getElementById('chapterNowLabel'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    zoomFit: document.getElementById('zoomFit'),
    closePanel: document.getElementById('closePanel'),
    charSearch: document.getElementById('characterSearch'),
    charClear: document.getElementById('clearSearch'),
    suggestions: document.getElementById('searchSuggestions'),
    tableBody: document.getElementById('characterTableBody'),
    tableSummary: document.getElementById('tableSummary'),
};

function showListView() {
    el.viewGraph.classList.add('hidden');
    el.viewList.classList.remove('hidden');
    el.backBtn.classList.add('hidden');
    el.novelSubtitle.textContent = '';
    state.currentNovel = null;
}

function showGraphView(novel) {
    el.viewList.classList.add('hidden');
    el.viewGraph.classList.remove('hidden');
    el.backBtn.classList.remove('hidden');
    el.novelSubtitle.textContent = novel.title;
}

el.backBtn.addEventListener('click', showListView);

// ---------------------------------------------------------------
// View 1: novel list
// ---------------------------------------------------------------
async function loadNovels() {
    el.listStatus.textContent = 'Loading novels…';
    try {
        const data = await fetchJSON(CONFIG.ENDPOINTS.novels());
        state.novels = normalizeNovels(data);
        el.listStatus.textContent = '';
    } catch (err) {
        console.warn('Falling back to mock novel list:', err.message);
        state.novels = mockNovels();
        el.listStatus.textContent = 'Showing sample data — API not reachable yet.';
    }
    renderNovelList(state.novels);
}

// Accept a couple of reasonable Django response shapes without
// forcing a particular field naming convention.
function normalizeNovels(raw) {
    const list = Array.isArray(raw) ? raw : raw.results || [];
    return list.map((n, i) => ({
        id: n.novel_id ?? n.pk ?? i,
        title: n.novel_title ?? n.name ?? 'Untitled',
        author: n.novel_author ?? n.author_name ?? '',
        year: n.novel_year ?? n.publication_year ?? '',
        characterCount: n.character_count ?? n.num_characters ?? null,
    }));
}

function renderNovelList(novels) {
    el.novelList.innerHTML = '';
    novels.forEach((novel) => {
        const li = document.createElement('li');
        li.className = 'novel-item';
        li.tabIndex = 0;
        li.setAttribute('role', 'button');

        const heading = document.createElement('div');
        heading.className = 'novel-heading';

        const title = document.createElement('span');
        title.className = 'novel-title';
        title.textContent = novel.title;

        const byline = document.createElement('span');
        byline.className = 'novel-byline';
        byline.textContent = [novel.author, novel.year].filter(Boolean).join(' · ');

        heading.appendChild(title);
        heading.appendChild(byline);

        const count = document.createElement('span');
        count.className = 'novel-count';
        count.textContent = novel.characterCount != null ? `${novel.characterCount} characters` : '';

        li.appendChild(heading);
        li.appendChild(count);

        const open = () => openNovel(novel);
        li.addEventListener('click', open);
        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });

        el.novelList.appendChild(li);
    });
}

el.searchInput.addEventListener('input', () => {
    const q = el.searchInput.value.trim().toLowerCase();
    const filtered = state.novels.filter(
        (n) => n.title.toLowerCase().includes(q) || n.author.toLowerCase().includes(q)
    );
    renderNovelList(filtered);
});

// ---------------------------------------------------------------
// View 2: graph
// ---------------------------------------------------------------
async function openNovel(novel) {
    state.currentNovel = novel;
    showGraphView(novel);
    clearSidePanel();
    resetGraph(); // start the new novel from a clean canvas and a fresh fit
    state.payload = null;
    state.graph = {nodes: [], edges: []};
    clearSearch();

    try {
        const timeline = await fetchJSON(CONFIG.ENDPOINTS.timeline(novel.id));
        state.chapterMin = timeline.min_chapter ?? 1;
        state.chapterMax = timeline.max_chapter ?? 1;
    } catch (err) {
        console.warn('Falling back to mock timeline:', err.message);
        const mock = mockTimeline(novel);
        state.chapterMin = mock.min_chapter;
        state.chapterMax = mock.max_chapter;
    }

    state.currentChapter = state.chapterMin;
    el.slider.min = state.chapterMin;
    el.slider.max = state.chapterMax;
    el.slider.value = state.chapterMin;
    el.chapterMinLabel.textContent = `Ch. ${state.chapterMin}`;
    el.chapterMaxLabel.textContent = `Ch. ${state.chapterMax}`;

    await loadRelationshipsForChapter(novel.id, state.currentChapter);
}

let relationshipsRequestId = 0;

async function loadRelationshipsForChapter(novelId, chapter) {
    const requestId = ++relationshipsRequestId;
    el.chapterNowLabel.textContent = `Ch. ${chapter}`;
    let data;
    try {
        data = await fetchJSON(CONFIG.ENDPOINTS.relationships(novelId, chapter));
    } catch (err) {
        console.warn('Falling back to mock relationships:', err.message);
        data = mockRelationships(state.currentNovel, chapter);
    }
    // A newer chapter was requested while this one was loading: drop this
    // response so a slow, older reply can't overwrite the latest graph.
    if (requestId !== relationshipsRequestId) return;
    const graph = toGraphData(data, chapter ?? 1);
    state.payload = data;
    state.graph = graph;
    state.shownChapter = chapter ?? 1;
    renderGraph(graph);
    renderTable();
    // keep the dropdown in sync if the user is still typing while scrubbing
    if (el.charSearch && document.activeElement === el.charSearch) updateSuggestions();
}

let debounceTimer = null;
el.slider.addEventListener('input', () => {
    const chapter = Number(el.slider.value);
    state.currentChapter = chapter;
    el.chapterNowLabel.textContent = `Ch. ${chapter}`;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadRelationshipsForChapter(state.currentNovel.id, chapter);
    }, CONFIG.DEBOUNCE_MS);
});

// Converts the API payload ({characters, relationship_events}) into
// the {nodes, edges} shape that renderGraph expects, for one chapter.
function toGraphData(payload, chapter) {
    const nodes = (payload.characters || [])
        .filter((c) => c.min_chapter <= chapter && chapter <= c.max_chapter)
        .map((c) => ({
            id: c.character_id,        // "elizabeth", used by forceLink().id()
            name: c.character_name,
            role: c.character_role,
        }));

    const visible = new Set(nodes.map((n) => n.id));

    // Keep only the latest event per unordered pair up to this chapter,
    // so a later "rupture" replaces an earlier "bond" instead of stacking.
    const latest = new Map();
    (payload.relationship_events || [])
        .filter((e) => e.chapter <= chapter && visible.has(e.source) && visible.has(e.target))
        .sort((a, b) => a.chapter - b.chapter || a.id - b.id)
        .forEach((e) => {
            const key = [e.source, e.target].sort().join('|');
            latest.set(key, e);
        });

    const edges = [...latest.values()].map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        label: e.label,
    }));

    return {nodes, edges};
}

// ---------------------------------------------------------------
// Force-directed graph (D3), redrawn with a smooth join on each
// chapter change instead of a full teardown/rebuild.
// ---------------------------------------------------------------
const EDGE_COLOR = {bond: '#3E8878', rupture: '#B5433D'};

function renderGraph(data) {
    const nodes = data.nodes || [];
    const links = (data.edges || []).map((e) => ({...e}));
    state.links = links;

    el.emptyState.classList.toggle('hidden', nodes.length > 0);
    if (nodes.length === 0) {
        // nothing to show at this chapter: clear whatever was drawn before
        if (state.simulation) {
            state.simulation.nodes([]);
            state.simulation.force('link').links([]);
        }
        if (state.viewport) {
            state.viewport.selectAll('.links > *, .nodes > *, .labels > *').remove();
        }
        return;
    }

    const svg = el.svg;
    const bounds = svg.node().getBoundingClientRect();
    const width = bounds.width || 800;
    const height = bounds.height || 480;

    svg.attr('viewBox', [0, 0, width, height]);

    if (!state.simulation) {
        svg.selectAll('*').remove();

        // All three layers live inside one <g> so d3.zoom can transform them together.
        state.viewport = svg.append('g').attr('class', 'viewport');
        state.viewport.append('g').attr('class', 'links');
        state.viewport.append('g').attr('class', 'nodes');
        state.viewport.append('g').attr('class', 'labels');

        state.userZoomed = false;
        state.zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                state.viewport.attr('transform', event.transform);
                // sourceEvent is only set for real mouse/touch input, not programmatic fits
                if (event.sourceEvent) state.userZoomed = true;
            });
        svg.call(state.zoom).on('dblclick.zoom', null); // keep double-click free

        state.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id((d) => d.id).distance(90))
            .force('charge', d3.forceManyBody().strength(-220))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide(28))
            // gentle pull toward the center keeps disconnected nodes from drifting away
            .force('x', d3.forceX(width / 2).strength(0.06))
            .force('y', d3.forceY(height / 2).strength(0.06))
            .on('end', () => {
                if (!state.userZoomed) fitToView();
            });

        // Refit when the window or panel is resized
        new ResizeObserver(() => {
            const b = svg.node().getBoundingClientRect();
            if (!b.width || !b.height) return; // graph view is hidden
            svg.attr('viewBox', [0, 0, b.width, b.height]);
            state.simulation.force('center', d3.forceCenter(b.width / 2, b.height / 2));
            state.simulation.force('x', d3.forceX(b.width / 2).strength(0.06));
            state.simulation.force('y', d3.forceY(b.height / 2).strength(0.06));
            if (!state.userZoomed) fitToView(false);
        }).observe(svg.node());
    }

    const sim = state.simulation;

    // Preserve existing node positions across chapter changes by id.
    const oldPositions = new Map(sim.nodes().map((d) => [d.id, d]));
    const mergedNodes = nodes.map((n) => Object.assign({}, oldPositions.get(n.id), n));

    sim.nodes(mergedNodes);
    sim.force('link').links(links);
    sim.alpha(0.6).restart();

    // NOTE: select from state.viewport (not svg) — that's where the layers live now.
    const linkSel = state.viewport.select('.links').selectAll('line')
        .data(links, (d) => `${d.source.id ?? d.source}-${d.target.id ?? d.target}`);

    // Remove stale edges immediately (no fade-out). A pending exit transition
    // could be interrupted by the next render and leave the old edge behind.
    linkSel.exit().interrupt().remove();

    const linkEnter = linkSel.enter().append('line')
        .attr('stroke-opacity', 0)
        .attr('stroke-width', 2);

    const linkMerge = linkEnter.merge(linkSel)
        .attr('stroke', (d) => EDGE_COLOR[d.type] || EDGE_COLOR.bond);

    linkMerge.transition().duration(300).attr('stroke-opacity', 0.8);

    const nodeSel = state.viewport.select('.nodes').selectAll('circle')
        .data(mergedNodes, (d) => d.id);

    nodeSel.exit().transition().duration(200).attr('r', 0).remove();

    const nodeEnter = nodeSel.enter().append('circle')
        .attr('r', 0)
        .attr('fill', '#B8925A')
        .style('cursor', 'pointer')
        .call(drag(sim))
        .on('click', (event, d) => selectNode(d, links));

    nodeEnter.merge(nodeSel)
        .transition().duration(300)
        .attr('r', 14)
        .attr('fill', (d) => (d.id === state.selectedNodeId ? '#E8E1CF' : '#B8925A'))
        .attr('stroke', '#12141C')
        .attr('stroke-width', 2);

    const labelSel = state.viewport.select('.labels').selectAll('text')
        .data(mergedNodes, (d) => d.id);

    labelSel.exit().remove();

    const labelEnter = labelSel.enter().append('text')
        .attr('class', 'node-label')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .attr('dx', 0)
        .style('opacity', 0);

    labelEnter.merge(labelSel)
        .text((d) => d.name)
        .attr('y', -18)
        .transition().duration(300).style('opacity', 1);

    // Fit early (after ~40 ticks) so the view settles quickly instead of
    // waiting for the simulation to fully cool down.
    let ticks = 0;
    sim.on('tick', () => {
        state.viewport.select('.links').selectAll('line')
            .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
            .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
        state.viewport.select('.nodes').selectAll('circle')
            .attr('cx', (d) => d.x).attr('cy', (d) => d.y);
        state.viewport.select('.labels').selectAll('text')
            .attr('x', (d) => d.x).attr('y', (d) => d.y - 18);

        if (++ticks === 40 && !state.userZoomed) fitToView();
    });

    applySearchHighlight();

    // Keep the side panel in sync if the selected character is still present.
    if (state.selectedNodeId) {
        const stillThere = mergedNodes.find((n) => n.id === state.selectedNodeId);
        if (stillThere) selectNode(stillThere, links);
        else clearSidePanel();
    }
}

// ---------------------------------------------------------------
// Zoom / fit helpers
// ---------------------------------------------------------------
function fitToView(animate = true) {
    if (!state.simulation || !state.zoom) return;
    const svg = el.svg;
    const {width, height} = svg.node().getBoundingClientRect();
    const pts = state.simulation.nodes().filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
    if (!pts.length || !width || !height) return;

    const padX = 50, padTop = 60, padBottom = 40; // top is larger to leave room for labels
    const x0 = d3.min(pts, (d) => d.x), x1 = d3.max(pts, (d) => d.x);
    const y0 = d3.min(pts, (d) => d.y), y1 = d3.max(pts, (d) => d.y);
    const bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1);

    const scale = Math.max(0.2, Math.min(
        (width - 2 * padX) / bw,
        (height - padTop - padBottom) / bh,
        1.5                       // don't blow up small graphs
    ));

    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const t = d3.zoomIdentity
        .translate(width / 2 - scale * cx, (padTop + height - padBottom) / 2 - scale * cy)
        .scale(scale);

    (animate ? svg.transition().duration(500) : svg).call(state.zoom.transform, t);
}

function zoomBy(k) {
    if (!state.zoom) return;
    state.userZoomed = true;
    el.svg.transition().duration(250).call(state.zoom.scaleBy, k);
}

function resetView() {
    state.userZoomed = false;
    fitToView();
}

// Clears the canvas and view state; called when a different novel is opened.
function resetGraph() {
    state.userZoomed = false;
    if (state.simulation) {
        state.simulation.stop();
        state.simulation.nodes([]);
        state.simulation.force('link').links([]);
    }
    if (state.viewport) {
        state.viewport.selectAll('.links > *, .nodes > *, .labels > *').remove();
    }
    if (state.zoom) {
        el.svg.call(state.zoom.transform, d3.zoomIdentity);
    }
}

el.zoomIn?.addEventListener('click', () => zoomBy(1.4));
el.zoomOut?.addEventListener('click', () => zoomBy(1 / 1.4));
el.zoomFit?.addEventListener('click', resetView);

// Three ways to dismiss the side panel: the × button, clicking empty
// canvas, or pressing Escape.
el.closePanel?.addEventListener('click', clearSidePanel);
el.svg.on('click', (event) => {
    // node clicks have a <circle> target; only the bare <svg> counts as background
    if (event.target === el.svg.node()) clearSidePanel();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSidePanel();
});

// ---------------------------------------------------------------
// Dragging, selection, side panel
// ---------------------------------------------------------------
function drag(sim) {
    function started(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function ended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag().on('start', started).on('drag', dragged).on('end', ended);
}

function selectNode(node, links) {
    state.selectedNodeId = node.id;
    el.sidePanel.classList.add('open');
    el.selectedName.textContent = node.name;
    el.selectedRole.textContent = node.role || '';

    const connected = links.filter(
        (l) => (l.source.id ?? l.source) === node.id || (l.target.id ?? l.target) === node.id
    );

    el.selectedEdges.innerHTML = '';
    if (connected.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No connections at this point in the story.';
        el.selectedEdges.appendChild(li);
    }
    connected.forEach((l) => {
        const otherId = (l.source.id ?? l.source) === node.id ? (l.target.id ?? l.target) : (l.source.id ?? l.source);
        const other = (state.simulation.nodes() || []).find((n) => n.id === otherId);
        const li = document.createElement('li');
        const dot = document.createElement('span');
        dot.className = 'edge-type';
        dot.style.background = EDGE_COLOR[l.type] || EDGE_COLOR.bond;
        li.appendChild(dot);
        li.appendChild(document.createTextNode(`${other ? other.name : otherId} — ${l.label || l.type}`));
        el.selectedEdges.appendChild(li);
    });

    d3.select(el.svg.node()).selectAll('.nodes circle')
        .attr('fill', (d) => (d.id === state.selectedNodeId ? '#E8E1CF' : '#B8925A'));
}

function clearSidePanel() {
    state.selectedNodeId = null;
    el.sidePanel.classList.remove('open');
    // un-highlight any previously selected node
    if (state.viewport) {
        state.viewport.selectAll('.nodes circle').attr('fill', '#B8925A');
    }
    el.selectedName.textContent = 'Tap a character';
    el.selectedRole.textContent = '';
    el.selectedEdges.innerHTML = '';
}

// ---------------------------------------------------------------
// Character search (with autocomplete) and the characters table.
// Both read the same state: chapter (state.shownChapter) + query.
// ---------------------------------------------------------------

// lowercase + strip accents so "garcia" finds "García"
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function isSubsequence(needle, hay) {
    let i = 0;
    for (const ch of hay) {
        if (ch === needle[i]) i++;
        if (i === needle.length) return true;
    }
    return false;
}

function queryTokens() {
    return norm(state.query).split(/\s+/).filter(Boolean);
}

// 0 = no match. Every token must match something, so "mr dar" finds Mr. Darcy.
// Ranking: word-start in name > anywhere in name > in role > loose letters-in-order.
function scoreNode(node, tokens) {
    const nameWords = norm(node.name).split(/\s+/);
    const name = nameWords.join(' ');
    const role = norm(node.role);
    let score = 0;
    for (const t of tokens) {
        if (nameWords.some((w) => w.startsWith(t))) score += 3;
        else if (name.includes(t)) score += 2;
        else if (role.includes(t)) score += 1;
        else if (t.length >= 4 && isSubsequence(t, name)) score += 0.5;
        else return 0;
    }
    return score;
}

// Set of character ids matching the query, or null when the query is empty.
function matchedIds() {
    const tokens = queryTokens();
    if (!tokens.length) return null;
    return new Set(state.graph.nodes.filter((n) => scoreNode(n, tokens) > 0).map((n) => n.id));
}

// Dim everything except the matches, their direct neighbours and the edges touching a match.
function applySearchHighlight() {
    if (!state.viewport) return;
    const matches = matchedIds();
    const keep = new Set(matches || []);
    if (matches) {
        state.graph.edges.forEach((e) => {
            if (matches.has(e.source)) keep.add(e.target);
            if (matches.has(e.target)) keep.add(e.source);
        });
    }
    const dimmed = (id) => !!matches && !keep.has(id);
    const endId = (x) => x.id ?? x;

    state.viewport.selectAll('.nodes circle')
        .classed('is-match', (d) => !!matches && matches.has(d.id))
        .classed('is-dim', (d) => dimmed(d.id));
    state.viewport.selectAll('.labels text')
        .classed('is-dim', (d) => dimmed(d.id));
    state.viewport.selectAll('.links line')
        .classed('is-dim', (d) => !!matches && !(matches.has(endId(d.source)) || matches.has(endId(d.target))));
}

// --- autocomplete dropdown ---------------------------------------
let suggestionNodes = [];
let activeSuggestion = -1;

function appendHighlighted(parent, text, tokens) {
    const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!pattern) {
        parent.textContent = text;
        return;
    }
    text.split(new RegExp(`(${pattern})`, 'gi')).forEach((part, i) => {
        if (!part) return;
        if (i % 2 === 1) {
            const mark = document.createElement('mark');
            mark.textContent = part;
            parent.appendChild(mark);
        } else {
            parent.appendChild(document.createTextNode(part));
        }
    });
}

function hideSuggestions() {
    if (!el.suggestions) return;
    el.suggestions.classList.add('hidden');
    el.charSearch.setAttribute('aria-expanded', 'false');
    el.charSearch.removeAttribute('aria-activedescendant');
    activeSuggestion = -1;
}

function setActiveSuggestion(i) {
    activeSuggestion = i;
    [...el.suggestions.querySelectorAll('.suggestion')].forEach((li, idx) => {
        li.classList.toggle('active', idx === i);
        if (idx === i) {
            el.charSearch.setAttribute('aria-activedescendant', li.id);
            li.scrollIntoView({block: 'nearest'});
        }
    });
}

function updateSuggestions() {
    if (!el.suggestions) return;
    const tokens = queryTokens();
    el.suggestions.innerHTML = '';
    activeSuggestion = -1;
    if (!tokens.length) {
        suggestionNodes = [];
        hideSuggestions();
        return;
    }

    suggestionNodes = state.graph.nodes
        .map((n) => ({n, s: scoreNode(n, tokens)}))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || a.n.name.localeCompare(b.n.name))
        .slice(0, 6)
        .map((x) => x.n);

    if (!suggestionNodes.length) {
        const li = document.createElement('li');
        li.className = 'suggestion-empty';
        li.textContent = 'No matching character at this chapter';
        el.suggestions.appendChild(li);
    }

    suggestionNodes.forEach((n, i) => {
        const li = document.createElement('li');
        li.className = 'suggestion';
        li.id = `suggestion-${i}`;
        li.setAttribute('role', 'option');

        const name = document.createElement('span');
        name.className = 'suggestion-name';
        appendHighlighted(name, n.name, tokens);

        const role = document.createElement('span');
        role.className = 'suggestion-role';
        role.textContent = n.role || '';

        li.appendChild(name);
        li.appendChild(role);
        // mousedown (not click) so the input doesn't blur and close the list first
        li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            pickSuggestion(n);
        });
        el.suggestions.appendChild(li);
    });

    el.suggestions.classList.remove('hidden');
    el.charSearch.setAttribute('aria-expanded', 'true');
}

function pickSuggestion(node) {
    state.query = node.name;
    el.charSearch.value = node.name;
    el.charClear.classList.remove('hidden');
    hideSuggestions();
    applySearchHighlight();
    renderTable();
    selectCharacter(node.id);
}

function selectCharacter(id) {
    const simNode = state.simulation && state.simulation.nodes().find((n) => n.id === id);
    if (simNode) selectNode(simNode, state.links);
}

function clearSearch() {
    state.query = '';
    if (el.charSearch) el.charSearch.value = '';
    if (el.charClear) el.charClear.classList.add('hidden');
    hideSuggestions();
    applySearchHighlight();
    renderTable();
}

if (el.charSearch) {
    el.charSearch.addEventListener('input', () => {
        state.query = el.charSearch.value;
        el.charClear.classList.toggle('hidden', !state.query);
        applySearchHighlight();
        renderTable();
        updateSuggestions();
    });

    el.charSearch.addEventListener('focus', () => {
        if (state.query) updateSuggestions();
    });
    el.charSearch.addEventListener('blur', hideSuggestions);

    el.charSearch.addEventListener('keydown', (e) => {
        const open = !el.suggestions.classList.contains('hidden');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) updateSuggestions();
            if (!suggestionNodes.length) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActiveSuggestion((activeSuggestion + step + suggestionNodes.length) % suggestionNodes.length);
        } else if (e.key === 'Enter') {
            if (open && suggestionNodes.length) {
                e.preventDefault();
                pickSuggestion(suggestionNodes[activeSuggestion >= 0 ? activeSuggestion : 0]);
            }
        } else if (e.key === 'Escape') {
            // first Esc closes the list, second clears the text; don't also close the side panel
            if (open) {
                hideSuggestions();
                e.stopPropagation();
            } else if (state.query) {
                clearSearch();
                e.stopPropagation();
            }
        }
    });
}

if (el.charClear) {
    el.charClear.addEventListener('click', () => {
        clearSearch();
        el.charSearch.focus();
    });
}

// --- characters table --------------------------------------------
// One row per character present at the shown chapter (filtered by the search),
// listing every relationship event involving them up to that chapter.
function renderTable() {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = '';

    const payload = state.payload;
    if (!payload) {
        el.tableSummary.textContent = '';
        return;
    }

    const chapter = state.shownChapter;
    const names = new Map((payload.characters || []).map((c) => [c.character_id, c.character_name]));
    const events = (payload.relationship_events || [])
        .filter((e) => e.chapter <= chapter)
        .sort((a, b) => a.chapter - b.chapter || a.id - b.id);

    const matches = matchedIds();
    const all = state.graph.nodes;
    const rows = matches ? all.filter((n) => matches.has(n.id)) : all;
    el.tableSummary.textContent = `${rows.length} of ${all.length} shown · events up to Ch. ${chapter}`;

    if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.className = 'table-muted';
        td.textContent = 'No characters match your search.';
        tr.appendChild(td);
        el.tableBody.appendChild(tr);
        return;
    }

    rows.forEach((n) => {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;

        const nameTd = document.createElement('td');
        nameTd.className = 'table-name';
        nameTd.textContent = n.name;

        const roleTd = document.createElement('td');
        roleTd.textContent = n.role || '';

        const eventsTd = document.createElement('td');
        const mine = events.filter((e) => e.source === n.id || e.target === n.id);
        if (!mine.length) {
            const none = document.createElement('span');
            none.className = 'table-muted';
            none.textContent = 'No recorded events yet';
            eventsTd.appendChild(none);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'table-events';
            mine.forEach((e) => {
                const otherId = e.source === n.id ? e.target : e.source;
                const li = document.createElement('li');

                const chip = document.createElement('span');
                chip.className = 'chapter-chip';
                chip.textContent = `Ch. ${e.chapter}`;

                const dot = document.createElement('span');
                dot.className = 'edge-type';
                dot.style.background = EDGE_COLOR[e.type] || EDGE_COLOR.bond;

                li.appendChild(chip);
                li.appendChild(dot);
                li.appendChild(document.createTextNode(
                    `${names.get(otherId) || otherId} — ${e.label || e.type}`
                ));
                ul.appendChild(li);
            });
            eventsTd.appendChild(ul);
        }

        tr.appendChild(nameTd);
        tr.appendChild(roleTd);
        tr.appendChild(eventsTd);

        const open = () => selectCharacter(n.id);
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') open();
        });
        el.tableBody.appendChild(tr);
    });
}

// ---------------------------------------------------------------
// Mock data — used only when the real endpoints aren't reachable,
// so the UI is demoable before the backend contract is finished.
// Returned in the SAME shape as the real API ({characters,
// relationship_events}) so toGraphData works for both.
// ---------------------------------------------------------------
function mockNovels() {
    return [
        {id: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, characterCount: 8},
        {id: 'anna', title: 'Anna Karenina', author: 'Leo Tolstoy', year: 1878, characterCount: 10},
        {
            id: 'solitude',
            title: 'One Hundred Years of Solitude',
            author: 'Gabriel García Márquez',
            year: 1967,
            characterCount: 12
        },
    ];
}

function mockTimeline() {
    return {min_chapter: 1, max_chapter: 40};
}

function mockRelationships() {
    const ch = (id, name, role) => ({
        character_id: id, character_name: name, character_role: role,
        min_chapter: 1, max_chapter: 40,
    });
    return {
        characters: [
            ch('a', 'Elena', 'Protagonist'),
            ch('b', 'Marcus', 'Her husband'),
            ch('c', 'Sofia', 'Her sister'),
            ch('d', 'Julian', 'Family friend'),
            ch('e', 'Renata', 'Rival'),
        ],
        relationship_events: [
            {id: 1, chapter: 1, source: 'a', target: 'b', type: 'bond', label: 'married'},
            {id: 2, chapter: 20, source: 'a', target: 'b', type: 'rupture', label: 'divorced'},
            {id: 3, chapter: 1, source: 'a', target: 'c', type: 'bond', label: 'sisters'},
            {id: 4, chapter: 1, source: 'b', target: 'e', type: 'rupture', label: 'estranged'},
            {id: 5, chapter: 16, source: 'b', target: 'e', type: 'bond', label: 'affair'},
            {id: 6, chapter: 1, source: 'c', target: 'd', type: 'bond', label: 'engaged'},
            {id: 7, chapter: 1, source: 'd', target: 'e', type: 'rupture', label: 'rivals'},
        ],
    };
}

// ---------------------------------------------------------------
init();

function init() {
    showListView();
    loadNovels();
}