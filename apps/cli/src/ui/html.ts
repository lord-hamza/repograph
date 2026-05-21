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
    --edge: rgba(140, 160, 200, 0.20);
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
  #app { position: fixed; inset: 0; display: grid; grid-template-columns: 320px 1fr; }
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
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 18px 0 8px; }
  #search {
    width: 100%; box-sizing: border-box;
    background: #0a1224; color: var(--fg);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; margin: 4px 0 4px;
    font: inherit;
    transition: border-color .12s;
  }
  #search:focus { outline: none; border-color: var(--accent); }
  .legend-group { display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--muted); }
  .legend-row { display: flex; align-items: center; gap: 8px; }
  .swatch { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 10px; }
  .tech-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 8px; border-radius: 6px; margin: 2px 0;
    background: rgba(255,255,255,0.02);
    border: 1px solid transparent;
    font-size: 11.5px;
  }
  .tech-row .name { color: var(--fg); font-weight: 500; }
  .tech-row .meta { color: var(--muted); font-size: 10.5px; }
  .tech-row .cat {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); margin-right: 6px;
  }
  #graph { background: transparent; cursor: grab; }
  #graph:active { cursor: grabbing; }
  #tooltip {
    position: fixed; pointer-events: none;
    background: rgba(19, 26, 43, 0.96);
    backdrop-filter: blur(8px);
    color: var(--fg);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 13px; font-size: 12px;
    opacity: 0; transition: opacity .12s;
    max-width: 380px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    z-index: 10;
    line-height: 1.4;
  }
  #tooltip .label { font-weight: 600; margin-bottom: 2px; word-break: break-all; }
  #tooltip .path { color: var(--muted); font-size: 11px; word-break: break-all; }
  #tooltip .desc {
    margin-top: 6px; padding-top: 6px;
    border-top: 1px solid var(--border);
    color: var(--fg);
  }
  #tooltip .deg { color: var(--muted); font-size: 11px; margin-top: 3px; }
  .node circle, .node rect { stroke-width: 1.4px; cursor: pointer; transition: opacity .18s, stroke-width .15s; }
  .node.dim circle, .node.dim rect { opacity: 0.08; }
  .node.focus circle, .node.focus rect { stroke-width: 3px; }
  .node.neighbor circle, .node.neighbor rect { stroke-width: 2px; opacity: 1 !important; }
  .node text {
    fill: var(--fg); font-size: 10.5px; pointer-events: none; font-weight: 500;
    text-shadow: 0 0 6px var(--bg), 0 0 6px var(--bg), 0 0 6px var(--bg);
    opacity: 0; transition: opacity .15s;
  }
  .node.focus text, .node.label-visible text { opacity: 1; }
  .link { stroke: var(--edge); stroke-width: 0.9px; transition: stroke .15s, stroke-width .15s, opacity .15s; }
  .link.dim { opacity: 0.03; }
  .link.hi-out { stroke: var(--edge-out); stroke-width: 1.7px; opacity: 0.95; }
  .link.hi-in { stroke: var(--edge-in); stroke-width: 1.7px; opacity: 0.95; }
  .footer-hint { color: var(--muted); font-size: 10px; line-height: 1.55; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
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

    <div class="section-title">Tech Stack</div>
    <div id="tech-stack"></div>

    <div class="section-title">Modules</div>
    <div class="legend-group" id="module-legend"></div>

    <div class="footer-hint">
      <div><b>Hover</b> a node to focus its neighborhood.</div>
      <div><b>Click</b> to pin · click empty to clear.</div>
      <div><b>Scroll</b> to zoom · <b>drag</b> to pan.</div>
      <div style="margin-top:6px;"><span style="color:var(--edge-out)">━</span> outgoing · <span style="color:var(--edge-in)">━</span> incoming</div>
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
const techStack = meta.techStack || [];

const stats = [
  ['Files', meta.repo?.fileCount ?? '—'],
  ['Nodes', DATA.nodes.length],
  ['Edges', DATA.links.length],
  ['Entry points', (meta.entryPoints || []).length],
  ['Orphans', (meta.orphanFiles || []).length],
  ['Cycles', (meta.circularDependencies || []).length],
];
statsEl.innerHTML = stats.map(([k, v]) => '<div class="stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>').join('');

// ---------- Module key (group nodes by top directory / workspace) ----------
function moduleKey(filePath) {
  if (!filePath) return '(root)';
  const parts = filePath.split('/');
  if (parts.length === 1) return '(root)';
  if ((parts[0] === 'packages' || parts[0] === 'apps') && parts.length > 2) {
    return parts[0] + '/' + parts[1];
  }
  return parts[0];
}

// ---------- Color (multicolor by module) ----------
const moduleSet = new Set(DATA.nodes.map((n) => moduleKey(n.filePath)));
const moduleList = [...moduleSet].sort();
const palette = d3.schemeTableau10.concat(d3.schemeSet3).concat(d3.schemePaired);
const moduleColor = d3.scaleOrdinal().domain(moduleList).range(palette);
function colorFor(n) { return moduleColor(moduleKey(n.filePath)); }

function radiusFor(n) {
  if (n.type === 'file') return 6 + Math.min(10, Math.log2(1 + (n.inDegree || 0)) * 2);
  if (n.type === 'class') return 4;
  return 3;
}

// ---------- SVG + zoom ----------
const width = window.innerWidth - 320;
const height = window.innerHeight;
svg.attr('viewBox', [0, 0, width, height]);
const root = svg.append('g');
const linkLayer = root.append('g').attr('class', 'links');
const nodeLayer = root.append('g').attr('class', 'nodes');
svg.call(d3.zoom().scaleExtent([0.08, 10]).on('zoom', (e) => root.attr('transform', e.transform)));

// ---------- Data + per-module centroids ----------
const linkData = DATA.links.map((l) => ({ ...l }));
const nodeData = DATA.nodes.map((n) => ({ ...n, _mod: moduleKey(n.filePath) }));

const centroids = new Map();
if (moduleList.length === 1) {
  centroids.set(moduleList[0], { x: width / 2, y: height / 2 });
} else {
  const ringR = Math.min(width, height) * 0.32;
  moduleList.forEach((m, i) => {
    const theta = (i / moduleList.length) * Math.PI * 2 - Math.PI / 2;
    centroids.set(m, {
      x: width / 2 + ringR * Math.cos(theta),
      y: height / 2 + ringR * Math.sin(theta),
    });
  });
}

const link = linkLayer.selectAll('line').data(linkData).join('line').attr('class', 'link');

const node = nodeLayer.selectAll('g.node').data(nodeData).join('g').attr('class', 'node');

// Shapes: class = square (rounded), file/function = circle
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

// Labels only for files (function/class labels would create the "mesh" on click)
node.filter((d) => d.type === 'file')
  .append('text')
  .attr('dx', 9)
  .attr('dy', 3.5)
  .text((d) => d.label || d.id);

// ---------- Drag ----------
const drag = d3.drag()
  .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
  .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
  .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
node.call(drag);

// ---------- Cluster-aware force simulation ----------
function modOf(end) {
  if (typeof end === 'object') return end._mod;
  const n = nodeData.find((x) => x.id === end);
  return n ? n._mod : null;
}

const sim = d3.forceSimulation(nodeData)
  .force('link', d3.forceLink(linkData).id((d) => d.id)
    .distance((l) => modOf(l.source) === modOf(l.target) ? 20 : 95)
    .strength((l) => modOf(l.source) === modOf(l.target) ? 0.75 : 0.12))
  .force('charge', d3.forceManyBody().strength(-55))
  .force('collide', d3.forceCollide().radius((d) => radiusFor(d) + 4).strength(1))
  .force('cx', d3.forceX((d) => centroids.get(d._mod).x).strength(0.18))
  .force('cy', d3.forceY((d) => centroids.get(d._mod).y).strength(0.18))
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
    const desc = d.description ? '<div class="desc">' + d.description + '</div>' : '';
    const path = d.filePath && d.filePath !== d.label ? '<div class="path">' + d.filePath + '</div>' : '';
    tooltip.style('opacity', 1)
      .html(
        '<div class="label">' + (d.label || d.id) + '</div>' +
        path +
        '<div class="deg">' + d.type + ' · ↑ ' + ins + ' incoming · ↓ ' + outs + ' outgoing</div>' +
        desc
      );
  })
  .on('mousemove', (event) => {
    tooltip
      .style('left', Math.min(event.clientX + 14, window.innerWidth - 400) + 'px')
      .style('top', Math.min(event.clientY + 14, window.innerHeight - 160) + 'px');
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

svg.on('click', () => { pinnedId = null; applyFocus(); });

// ---------- Module legend ----------
const legendEl = document.getElementById('module-legend');
legendEl.innerHTML = moduleList.map((m) =>
  '<div class="legend-row"><span class="swatch" style="background:' + moduleColor(m) + '"></span>' + m + '</div>'
).join('');

// ---------- Tech stack ----------
const techEl = document.getElementById('tech-stack');
if (techStack.length === 0) {
  techEl.innerHTML = '<div class="legend-row" style="font-style:italic;">No tech detected</div>';
} else {
  techEl.innerHTML = techStack.slice(0, 14).map((t) => {
    const v = t.version ? ' · v' + t.version.replace(/^[\\^~>=<]+/, '') : '';
    return '<div class="tech-row">' +
      '<span><span class="cat">' + t.category + '</span><span class="name">' + t.name + '</span></span>' +
      '<span class="meta">' + t.fileCount + ' file' + (t.fileCount === 1 ? '' : 's') + v + '</span>' +
    '</div>';
  }).join('');
}

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
  node.classed('label-visible', (d) => hits.has(d.id) && d.type === 'file');
  link.classed('dim', (l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return !hits.has(s) && !hits.has(t);
  });
});

// ---------- Resize ----------
window.addEventListener('resize', () => {
  const w = window.innerWidth - 320;
  const h = window.innerHeight;
  svg.attr('viewBox', [0, 0, w, h]);
  // Recompute centroids on resize
  if (moduleList.length === 1) {
    centroids.set(moduleList[0], { x: w / 2, y: h / 2 });
  } else {
    const ringR = Math.min(w, h) * 0.32;
    moduleList.forEach((m, i) => {
      const theta = (i / moduleList.length) * Math.PI * 2 - Math.PI / 2;
      centroids.set(m, { x: w / 2 + ringR * Math.cos(theta), y: h / 2 + ringR * Math.sin(theta) });
    });
  }
  sim.force('cx', d3.forceX((d) => centroids.get(d._mod).x).strength(0.18))
     .force('cy', d3.forceY((d) => centroids.get(d._mod).y).strength(0.18))
     .alpha(0.5).restart();
});
</script>
</body>
</html>
`;
}
