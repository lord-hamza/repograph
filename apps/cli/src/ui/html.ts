export function renderGraphHtml(graphJson: string, title: string): string {
  const safeTitle = title.replace(/</g, "&lt;");
  const escapedJson = graphJson.replace(/<\/script/g, "<\\/script");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle} — RepoGraph</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    color-scheme: dark;
    --bg: #0a0e17;
    --bg-2: #0e1422;
    --panel: #131a2b;
    --panel-2: #1a2237;
    --border: #233149;
    --fg: #e8eef8;
    --muted: #8896ac;
    --accent: #7cb9ff;
    --edge: rgba(140, 160, 200, 0.22);
    --edge-hi: #ffd866;
    --edge-out: #6cd1a1;
    --edge-in: #ff8fa3;
  }
  html, body { height: 100%; margin: 0; }
  body {
    background:
      radial-gradient(1200px 800px at 20% -10%, rgba(124, 185, 255, 0.07), transparent 60%),
      radial-gradient(900px 700px at 110% 110%, rgba(199, 146, 234, 0.05), transparent 60%),
      var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    font-size: 13px;
    overflow: hidden;
  }
  #app { position: fixed; inset: 0; display: grid; grid-template-columns: 300px 1fr; }
  #sidebar {
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
    border-right: 1px solid var(--border);
    padding: 18px 16px;
    overflow: auto;
  }
  h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 11px; margin-bottom: 16px; }
  .stat { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .stat:last-child { border-bottom: 0; }
  .stat .k { color: var(--muted); }
  .stat .v { font-variant-numeric: tabular-nums; font-weight: 500; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 18px 0 6px; }
  #search {
    width: 100%; box-sizing: border-box;
    background: #0a1224; color: var(--fg);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; margin: 6px 0 4px;
    font: inherit;
    transition: border-color .12s;
  }
  #search:focus { outline: none; border-color: var(--accent); }
  .legend-group { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--muted); }
  .legend-row { display: flex; align-items: center; gap: 8px; }
  .swatch { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 10px; }
  .swatch.square { border-radius: 2px; }
  .swatch.ring { background: transparent !important; border: 2px solid currentColor; }
  .toggle { display: inline-flex; background: #0a1224; border: 1px solid var(--border); border-radius: 8px; padding: 2px; gap: 2px; margin-top: 4px; }
  .toggle button {
    background: transparent; border: 0; color: var(--muted); font: inherit;
    padding: 5px 9px; border-radius: 6px; cursor: pointer; font-size: 11px;
  }
  .toggle button.active { background: var(--accent); color: #061224; font-weight: 600; }
  #graph { background: transparent; cursor: grab; }
  #graph:active { cursor: grabbing; }
  #tooltip {
    position: fixed; pointer-events: none;
    background: rgba(19, 26, 43, 0.96);
    backdrop-filter: blur(8px);
    color: var(--fg);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 12px; font-size: 12px;
    opacity: 0; transition: opacity .12s;
    max-width: 360px; word-break: break-all;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 10;
  }
  #tooltip .label { font-weight: 600; margin-bottom: 2px; }
  #tooltip .meta { color: var(--muted); font-size: 11px; }
  .node circle, .node rect { stroke-width: 1.4px; cursor: pointer; transition: opacity .15s, stroke-width .15s; }
  .node.dim circle, .node.dim rect { opacity: 0.12; }
  .node.focus circle, .node.focus rect { stroke-width: 3px; }
  .node.neighbor circle, .node.neighbor rect { stroke-width: 2px; }
  .node text {
    fill: var(--fg); font-size: 10px; pointer-events: none;
    text-shadow: 0 0 4px var(--bg), 0 0 4px var(--bg);
    opacity: 0; transition: opacity .15s;
  }
  .node.label-visible text, .node.focus text, .node.neighbor text { opacity: 1; }
  .link { stroke: var(--edge); stroke-width: 0.9px; transition: stroke .15s, stroke-width .15s, opacity .15s; }
  .link.dim { opacity: 0.04; }
  .link.hi-out { stroke: var(--edge-out); stroke-width: 1.6px; opacity: 0.95; }
  .link.hi-in { stroke: var(--edge-in); stroke-width: 1.6px; opacity: 0.95; }
  .footer-hint { color: var(--muted); font-size: 10px; line-height: 1.5; margin-top: 14px; }
  kbd { background: #0a1224; border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-size: 10px; }
</style>
</head>
<body>
<div id="app">
  <aside id="sidebar">
    <h1>${safeTitle}</h1>
    <div class="sub">RepoGraph · interactive dependency map</div>
    <div id="stats"></div>

    <div class="section-title">Filter</div>
    <input id="search" placeholder="Filter by name or path…" autocomplete="off" />

    <div class="section-title">Color by</div>
    <div class="toggle" id="color-toggle">
      <button data-mode="module" class="active">Module</button>
      <button data-mode="type">Type</button>
    </div>

    <div class="section-title">Shape</div>
    <div class="legend-group">
      <div class="legend-row"><span class="swatch" style="background:#fff"></span>File (large)</div>
      <div class="legend-row"><span class="swatch square" style="background:#fff"></span>Class</div>
      <div class="legend-row"><span class="swatch" style="background:#fff;transform:scale(0.6)"></span>Function</div>
    </div>

    <div class="section-title">Modules</div>
    <div class="legend-group" id="module-legend"></div>

    <div class="footer-hint">
      <div>Hover a node to focus.</div>
      <div>Click to pin · Click empty to clear.</div>
      <div>Scroll to zoom · Drag to pan.</div>
      <div><span style="color:var(--edge-out)">━</span> outgoing · <span style="color:var(--edge-in)">━</span> incoming</div>
    </div>
  </aside>
  <svg id="graph"></svg>
</div>
<div id="tooltip"></div>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script>
const DATA = ${escapedJson};
const svg = d3.select('#graph');
const tooltip = d3.select('#tooltip');
const statsEl = document.getElementById('stats');

const meta = DATA.metadata || {};
const stats = [
  ['Files', meta.repo?.fileCount ?? '—'],
  ['Nodes', DATA.nodes.length],
  ['Edges', DATA.links.length],
  ['Entry points', (meta.entryPoints || []).length],
  ['Orphans', (meta.orphanFiles || []).length],
  ['Cycles', (meta.circularDependencies || []).length],
];
statsEl.innerHTML = stats.map(([k, v]) => '<div class="stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>').join('');

// ---------- Module detection (group nodes by top directory / workspace) ----------
function moduleKey(filePath) {
  if (!filePath) return '(root)';
  const parts = filePath.split('/');
  if (parts.length === 1) return '(root)';
  // Detect monorepo: packages/<x>/... or apps/<x>/...
  if ((parts[0] === 'packages' || parts[0] === 'apps') && parts.length > 2) {
    return parts[0] + '/' + parts[1];
  }
  return parts[0];
}

const TYPE_COLORS = {
  file: '#7cb9ff',
  class: '#ffb86b',
  function: '#a8e6a3',
};
const TYPE_DEFAULT = '#c792ea';

const moduleSet = new Set(DATA.nodes.map((n) => moduleKey(n.filePath)));
const moduleList = [...moduleSet].sort();
const palette = d3.schemeTableau10.concat(d3.schemeSet3);
const moduleColor = d3.scaleOrdinal().domain(moduleList).range(palette);

let colorMode = 'module';
function colorFor(n) {
  if (colorMode === 'type') return TYPE_COLORS[n.type] || TYPE_DEFAULT;
  return moduleColor(moduleKey(n.filePath));
}

function radiusFor(n) {
  if (n.type === 'file') return 6 + Math.min(9, Math.log2(1 + (n.inDegree || 0)) * 1.7);
  if (n.type === 'class') return 4.5;
  return 3.2;
}

// ---------- SVG setup + zoom ----------
const width = window.innerWidth - 300;
const height = window.innerHeight;
svg.attr('viewBox', [0, 0, width, height]);

const root = svg.append('g');
const linkLayer = root.append('g').attr('class', 'links');
const nodeLayer = root.append('g').attr('class', 'nodes');

svg.call(d3.zoom().scaleExtent([0.08, 8]).on('zoom', (e) => root.attr('transform', e.transform)));

// ---------- Data ----------
const linkData = DATA.links.map((l) => ({ ...l }));
const nodeData = DATA.nodes.map((n) => ({ ...n, _mod: moduleKey(n.filePath) }));

const link = linkLayer.selectAll('line').data(linkData).join('line').attr('class', 'link');

const node = nodeLayer.selectAll('g.node').data(nodeData).join('g').attr('class', 'node');

// Mix shape: square for class, circle for file/function
node.each(function (d) {
  const sel = d3.select(this);
  if (d.type === 'class') {
    const r = radiusFor(d) * 1.05;
    sel.append('rect')
      .attr('x', -r).attr('y', -r).attr('width', r * 2).attr('height', r * 2)
      .attr('rx', 1.5)
      .attr('fill', colorFor(d))
      .attr('stroke', '#0a0e17');
  } else {
    sel.append('circle')
      .attr('r', radiusFor(d))
      .attr('fill', colorFor(d))
      .attr('stroke', '#0a0e17');
  }
});

node.append('text').attr('dx', 8).attr('dy', 3).text((d) => d.label || d.id);

// ---------- Drag ----------
const drag = d3.drag()
  .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
  .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
  .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
node.call(drag);

// ---------- Force simulation ----------
const sim = d3.forceSimulation(nodeData)
  .force('link', d3.forceLink(linkData).id((d) => d.id).distance((l) => {
    // Pull intra-module nodes closer
    const sm = typeof l.source === 'object' ? l.source._mod : moduleKey(nodeData.find((n) => n.id === l.source)?.filePath);
    const tm = typeof l.target === 'object' ? l.target._mod : moduleKey(nodeData.find((n) => n.id === l.target)?.filePath);
    return sm === tm ? 28 : 70;
  }).strength(0.5))
  .force('charge', d3.forceManyBody().strength(-110))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collide', d3.forceCollide().radius((d) => radiusFor(d) + 3))
  .force('x', d3.forceX(width / 2).strength(0.03))
  .force('y', d3.forceY(height / 2).strength(0.03))
  .on('tick', () => {
    link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    node.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')');
  });

// ---------- Adjacency for focus ----------
const outAdj = new Map();
const inAdj = new Map();
for (const l of linkData) {
  const s = typeof l.source === 'object' ? l.source.id : l.source;
  const t = typeof l.target === 'object' ? l.target.id : l.target;
  (outAdj.get(s) || outAdj.set(s, new Set()).get(s)).add(t);
  (inAdj.get(t) || inAdj.set(t, new Set()).get(t)).add(s);
}

let pinnedId = null;
let hoverId = null;

function activeId() { return pinnedId || hoverId; }

function applyFocus() {
  const id = activeId();
  if (!id) {
    node.classed('dim', false).classed('focus', false).classed('neighbor', false);
    link.classed('dim', false).classed('hi-in', false).classed('hi-out', false);
    return;
  }
  const outs = outAdj.get(id) || new Set();
  const ins = inAdj.get(id) || new Set();
  const neighbors = new Set([...outs, ...ins]);
  node.classed('focus', (d) => d.id === id);
  node.classed('neighbor', (d) => neighbors.has(d.id));
  node.classed('dim', (d) => d.id !== id && !neighbors.has(d.id));
  link.classed('hi-out', (l) => (typeof l.source === 'object' ? l.source.id : l.source) === id);
  link.classed('hi-in', (l) => (typeof l.target === 'object' ? l.target.id : l.target) === id);
  link.classed('dim', (l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return s !== id && t !== id;
  });
}

node
  .on('mouseenter', (event, d) => {
    hoverId = d.id;
    if (!pinnedId) applyFocus();
    const ins = (inAdj.get(d.id) || new Set()).size;
    const outs = (outAdj.get(d.id) || new Set()).size;
    tooltip.style('opacity', 1)
      .html(
        '<div class="label">' + (d.label || d.id) + '</div>' +
        '<div class="meta">' + d.type + (d.filePath ? ' · ' + d.filePath : '') + '</div>' +
        '<div class="meta">↑ ' + ins + ' incoming · ↓ ' + outs + ' outgoing</div>'
      );
  })
  .on('mousemove', (event) => {
    tooltip
      .style('left', (event.clientX + 14) + 'px')
      .style('top', (event.clientY + 14) + 'px');
  })
  .on('mouseleave', () => {
    hoverId = null;
    tooltip.style('opacity', 0);
    if (!pinnedId) applyFocus();
  })
  .on('click', (event, d) => {
    pinnedId = pinnedId === d.id ? null : d.id;
    applyFocus();
    event.stopPropagation();
  });

svg.on('click', () => {
  pinnedId = null;
  applyFocus();
});

// ---------- Color mode toggle ----------
function recolor() {
  node.selectAll('circle').attr('fill', (d) => colorFor(d));
  node.selectAll('rect').attr('fill', (d) => colorFor(d));
}
document.querySelectorAll('#color-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#color-toggle button').forEach((b) => b.classList.toggle('active', b === btn));
    colorMode = btn.dataset.mode;
    recolor();
  });
});

// ---------- Module legend ----------
const legendEl = document.getElementById('module-legend');
legendEl.innerHTML = moduleList.map((m) => {
  const c = moduleColor(m);
  return '<div class="legend-row"><span class="swatch" style="background:' + c + '"></span>' + m + '</div>';
}).join('');

// ---------- Search ----------
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    if (!activeId()) {
      node.classed('dim', false).classed('label-visible', false);
      link.classed('dim', false);
    }
    return;
  }
  const hits = new Set(nodeData.filter((d) =>
    (d.label || '').toLowerCase().includes(q) || (d.filePath || '').toLowerCase().includes(q)
  ).map((d) => d.id));
  node.classed('dim', (d) => !hits.has(d.id));
  node.classed('label-visible', (d) => hits.has(d.id));
  link.classed('dim', (l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return !hits.has(s) && !hits.has(t);
  });
});

// ---------- Resize ----------
window.addEventListener('resize', () => {
  const w = window.innerWidth - 300;
  const h = window.innerHeight;
  svg.attr('viewBox', [0, 0, w, h]);
  sim.force('center', d3.forceCenter(w / 2, h / 2)).alpha(0.3).restart();
});
</script>
</body>
</html>
`;
}
