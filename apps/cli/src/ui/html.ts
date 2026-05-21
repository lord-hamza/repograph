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
    --bg: #04070d;
    --panel: #0e1422;
    --panel-2: #131a2b;
    --border: #233149;
    --fg: #e8eef8;
    --muted: #8896ac;
    --accent: #7cb9ff;
    --out: #6cd1a1;
    --in: #ff8fa3;
  }
  html, body { height: 100%; margin: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    font-size: 13px;
    overflow: hidden;
  }
  #app { position: fixed; inset: 0; display: grid; grid-template-columns: 320px 1fr; }

  /* ---------------- Sidebar ---------------- */
  #sidebar {
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
    border-right: 1px solid var(--border);
    padding: 18px 16px; overflow: auto; z-index: 5;
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
    padding: 9px 11px; margin: 4px 0; font: inherit;
    transition: border-color .12s;
  }
  #search:focus { outline: none; border-color: var(--accent); }
  .legend-group { display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--muted); }
  .legend-row { display: flex; align-items: center; gap: 8px; }
  .swatch { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 10px; }
  .tech-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 8px; border-radius: 6px; margin: 2px 0;
    background: rgba(255,255,255,0.02); font-size: 11.5px;
  }
  .tech-row .name { color: var(--fg); font-weight: 500; }
  .tech-row .meta { color: var(--muted); font-size: 10.5px; }
  .tech-row .cat { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-right: 6px; }
  .footer-hint { color: var(--muted); font-size: 10px; line-height: 1.55; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }

  /* ---------------- 3D viewport ---------------- */
  #graph { position: relative; }
  #graph-canvas { position: absolute; inset: 0; }
  #graph-canvas canvas { display: block; cursor: grab; }
  #graph-canvas canvas:active { cursor: grabbing; }
  #err {
    position: absolute; inset: 0;
    display: none; padding: 30px;
    color: #ff8fa3; font-family: ui-monospace, Menlo, monospace;
    font-size: 12px; white-space: pre-wrap; word-break: break-word;
    background: rgba(20,10,15,0.85); overflow: auto;
  }

  /* ---------------- Floating tooltip ---------------- */
  #tooltip {
    position: fixed; pointer-events: none;
    background: rgba(14, 20, 34, 0.96);
    backdrop-filter: blur(10px);
    color: var(--fg);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 9px 13px; font-size: 12px;
    opacity: 0; transition: opacity .12s;
    max-width: 360px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.55);
    z-index: 20; line-height: 1.4;
  }
  #tooltip .label { font-weight: 600; margin-bottom: 2px; word-break: break-all; }
  #tooltip .path { color: var(--muted); font-size: 11px; word-break: break-all; }
  #tooltip .desc { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); color: var(--fg); }

  /* ---------------- Detail panel ---------------- */
  #panel {
    position: fixed; top: 0; right: 0; bottom: 0; width: 380px;
    background: rgba(14, 20, 34, 0.97);
    backdrop-filter: blur(14px);
    border-left: 1px solid var(--border);
    transform: translateX(100%); transition: transform .22s cubic-bezier(.4,0,.2,1);
    z-index: 15; display: flex; flex-direction: column;
    box-shadow: -10px 0 30px rgba(0,0,0,0.5);
  }
  #panel.open { transform: translateX(0); }
  #panel .head {
    padding: 16px 18px 12px; border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
  }
  #panel .head .name { font-size: 15px; font-weight: 600; word-break: break-all; line-height: 1.3; }
  #panel .head .path { color: var(--muted); font-size: 11px; margin-top: 3px; word-break: break-all; }
  #panel .head .close {
    background: transparent; border: 0; color: var(--muted); font-size: 20px; cursor: pointer;
    width: 24px; height: 24px; line-height: 20px; padding: 0; border-radius: 4px;
  }
  #panel .head .close:hover { background: rgba(255,255,255,0.05); color: var(--fg); }
  #panel .desc { padding: 12px 18px; color: var(--fg); font-size: 12.5px; font-style: italic; border-bottom: 1px solid var(--border); }
  #panel .metrics { display: flex; gap: 18px; padding: 12px 18px; font-size: 11px; color: var(--muted); border-bottom: 1px solid var(--border); }
  #panel .metrics b { color: var(--fg); font-weight: 600; }
  #panel .lists { flex: 1; overflow: auto; padding: 0 0 16px; }
  #panel .list-section { padding: 12px 18px 6px; }
  #panel .list-section h4 {
    margin: 0 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--muted); display: flex; justify-content: space-between; align-items: center;
  }
  #panel .list-section h4 .badge {
    background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 10px;
    color: var(--fg); font-weight: 600;
  }
  #panel ul { list-style: none; margin: 0; padding: 0; }
  #panel li {
    display: flex; gap: 8px; align-items: flex-start;
    padding: 8px 10px; border-radius: 6px; cursor: pointer;
    border: 1px solid transparent; transition: background .1s, border-color .1s;
    margin-bottom: 2px;
  }
  #panel li:hover { background: rgba(124,185,255,0.07); border-color: rgba(124,185,255,0.18); }
  #panel li.outgoing .arrow { color: var(--out); }
  #panel li.incoming .arrow { color: var(--in); }
  #panel li .arrow { font-weight: 700; flex: 0 0 14px; }
  #panel li .item-body { flex: 1; min-width: 0; }
  #panel li .item-name { font-size: 12px; font-weight: 500; word-break: break-all; }
  #panel li .item-desc { font-size: 10.5px; color: var(--muted); margin-top: 2px; word-break: break-all; }
  #panel li .item-type {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    background: rgba(255,255,255,0.04); padding: 1px 5px; border-radius: 3px;
    flex: 0 0 auto; margin-top: 1px;
  }
  #panel .empty { color: var(--muted); font-size: 11px; padding: 8px 4px; font-style: italic; }
</style>
</head>
<body>
<div id="app">
  <aside id="sidebar">
    <h1>${safeTitle}</h1>
    <div class="sub">RepoGraph · 3D dependency globe</div>
    <div id="stats"></div>

    <div class="section-title">Filter</div>
    <input id="search" placeholder="Filter by name or path…" autocomplete="off" />

    <div class="section-title">Tech Stack</div>
    <div id="tech-stack"></div>

    <div class="section-title">Modules</div>
    <div class="legend-group" id="module-legend"></div>

    <div class="footer-hint">
      <div><b>Drag</b> to rotate · <b>scroll</b> to zoom.</div>
      <div><b>Hover</b> a node to preview · <b>click</b> to open details.</div>
      <div>Click a connected node in the side panel to navigate.</div>
      <div style="margin-top:6px;"><span style="color:var(--out)">━</span> outgoing · <span style="color:var(--in)">━</span> incoming</div>
    </div>
  </aside>

  <div id="graph">
    <div id="graph-canvas"></div>
    <div id="err"></div>
  </div>

  <aside id="panel">
    <div class="head">
      <div>
        <div class="name" id="panel-name"></div>
        <div class="path" id="panel-path"></div>
      </div>
      <button class="close" id="panel-close" aria-label="Close">×</button>
    </div>
    <div class="desc" id="panel-desc"></div>
    <div class="metrics" id="panel-metrics"></div>
    <div class="lists">
      <div class="list-section">
        <h4>Outgoing — imports <span class="badge" id="out-count">0</span></h4>
        <ul id="out-list"></ul>
      </div>
      <div class="list-section">
        <h4>Incoming — imported by <span class="badge" id="in-count">0</span></h4>
        <ul id="in-list"></ul>
      </div>
    </div>
  </aside>
</div>
<div id="tooltip"></div>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = 'Renderer error: ' + (e.message || e.error) + (e.filename ? '\\n  at ' + e.filename + ':' + e.lineno : '');
});

const DATA = ${escapedJson};
const meta = DATA.metadata || {};
const techStack = meta.techStack || [];

// =====================================================================
//   Data prep
// =====================================================================
function moduleKey(filePath) {
  if (!filePath) return '(root)';
  const parts = filePath.split('/');
  if (parts.length === 1) return '(root)';
  if ((parts[0] === 'packages' || parts[0] === 'apps') && parts.length > 2) return parts[0] + '/' + parts[1];
  return parts[0];
}

const TABLEAU = ['#4e79a7','#f28e2c','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab'];
const SET3 = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
const PAIRED = ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928'];
const PALETTE = TABLEAU.concat(SET3).concat(PAIRED);

const moduleList = [...new Set(DATA.nodes.map((n) => moduleKey(n.filePath)))].sort();
const moduleColorMap = new Map();
moduleList.forEach((m, i) => moduleColorMap.set(m, PALETTE[i % PALETTE.length]));
function moduleColor(m) { return moduleColorMap.get(m) || '#888'; }
function colorFor(n) { return moduleColor(moduleKey(n.filePath)); }

function nodeSize(n) {
  if (n.type === 'file') return 3.8 + Math.min(7, Math.log2(1 + (n.inDegree || 0)) * 1.8);
  if (n.type === 'class') return 2.4;
  return 2.0;
}

const nodes = DATA.nodes.map((n) => ({ ...n, _mod: moduleKey(n.filePath), neighbors: [], inLinks: [], outLinks: [] }));
const nodeById = new Map(nodes.map((n) => [n.id, n]));
const links = DATA.links.map((l) => ({ ...l }));
for (const l of links) {
  const src = nodeById.get(l.source);
  const tgt = nodeById.get(l.target);
  if (src && tgt) {
    src.neighbors.push(tgt);
    tgt.neighbors.push(src);
    src.outLinks.push(l);
    tgt.inLinks.push(l);
  }
}

// =====================================================================
//   Sphere-surface positioning
// =====================================================================
const SPHERE_R = 240;

function fibSphereDir(i, n) {
  if (n <= 1) return { x: 0, y: 0, z: 1 };
  const phi = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = phi * i;
  return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
}
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function len3(v) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
function norm3(v) { const m = len3(v) || 1; return { x: v.x / m, y: v.y / m, z: v.z / m }; }

const nodesByModule = new Map();
for (const n of nodes) (nodesByModule.get(n._mod) || nodesByModule.set(n._mod, []).get(n._mod)).push(n);

const moduleDir = new Map();
moduleList.forEach((m, i) => moduleDir.set(m, fibSphereDir(i, moduleList.length)));

function setPos(node, dx, dy, dz) {
  node.x = dx; node.y = dy; node.z = dz;
}

if (moduleList.length === 1) {
  const all = nodesByModule.get(moduleList[0]);
  all.forEach((n, i) => {
    const d = fibSphereDir(i, all.length);
    setPos(n, d.x * SPHERE_R, d.y * SPHERE_R, d.z * SPHERE_R);
  });
} else {
  for (const [mod, mods] of nodesByModule.entries()) {
    const c = moduleDir.get(mod);
    if (!c || mods.length === 0) continue;
    const up = Math.abs(c.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const t1 = norm3(cross(up, c));
    const t2 = norm3(cross(c, t1));
    const spread = Math.min(0.55, 0.18 + 0.05 * Math.sqrt(mods.length));
    const phi = Math.PI * (3 - Math.sqrt(5));
    if (mods.length === 1) {
      setPos(mods[0], c.x * SPHERE_R, c.y * SPHERE_R, c.z * SPHERE_R);
      continue;
    }
    mods.forEach((node, i) => {
      const ratio = i / (mods.length - 1);
      const r = Math.sqrt(ratio) * spread;
      const a = i * phi;
      const dx = t1.x * Math.cos(a) * r + t2.x * Math.sin(a) * r;
      const dy = t1.y * Math.cos(a) * r + t2.y * Math.sin(a) * r;
      const dz = t1.z * Math.cos(a) * r + t2.z * Math.sin(a) * r;
      let px = c.x + dx, py = c.y + dy, pz = c.z + dz;
      const m = Math.sqrt(px * px + py * py + pz * pz) || 1;
      setPos(node, (px / m) * SPHERE_R, (py / m) * SPHERE_R, (pz / m) * SPHERE_R);
    });
  }
}

// =====================================================================
//   Sidebar UI
// =====================================================================
const stats = [
  ['Files', meta.repo?.fileCount ?? '—'],
  ['Nodes', nodes.length],
  ['Edges', links.length],
  ['Entry points', (meta.entryPoints || []).length],
  ['Orphans', (meta.orphanFiles || []).length],
  ['Cycles', (meta.circularDependencies || []).length],
];
document.getElementById('stats').innerHTML = stats.map(([k, v]) =>
  '<div class="stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'
).join('');
document.getElementById('module-legend').innerHTML = moduleList.map((m) =>
  '<div class="legend-row"><span class="swatch" style="background:' + moduleColor(m) + '"></span>' + m + '</div>'
).join('');
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

// =====================================================================
//   Three.js scene
// =====================================================================
const container = document.getElementById('graph-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070d);
scene.fog = new THREE.FogExp2(0x04070d, 0.0009);

let w = window.innerWidth - 320;
let h = window.innerHeight;
const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 5000);
camera.position.set(0, 0, SPHERE_R * 2.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(w, h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// --- Wireframe globe ---
const wireGeo = new THREE.SphereGeometry(SPHERE_R, 48, 32);
const wireMat = new THREE.MeshBasicMaterial({
  color: 0x6a8db0, wireframe: true, transparent: true, opacity: 0.08, depthWrite: false,
});
scene.add(new THREE.Mesh(wireGeo, wireMat));

// Equator + prime meridian as tori (much cleaner than rings on a sphere)
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x7fa6cf, transparent: true, opacity: 0.22, depthWrite: false,
});
const torusGeo = new THREE.TorusGeometry(SPHERE_R, 0.45, 12, 128);
const eq = new THREE.Mesh(torusGeo, ringMat);
eq.rotation.x = Math.PI / 2;
scene.add(eq);
const pm = new THREE.Mesh(torusGeo, ringMat);
scene.add(pm);
// Add a 45° meridian for extra globe-feel
const m45 = new THREE.Mesh(torusGeo, ringMat.clone());
m45.material.opacity = 0.10;
m45.rotation.y = Math.PI / 4;
scene.add(m45);

// Atmosphere (back-side glow shell)
const atmosGeo = new THREE.SphereGeometry(SPHERE_R * 1.10, 48, 32);
const atmosMat = new THREE.MeshBasicMaterial({
  color: 0x2a4870, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false,
});
scene.add(new THREE.Mesh(atmosGeo, atmosMat));

// =====================================================================
//   Node meshes
// =====================================================================
const nodeGroup = new THREE.Group();
scene.add(nodeGroup);

const nodeMeshes = new Map();
const NODE_BASE_OPACITY = 0.95;
const DIM_OPACITY = 0.13;

for (const node of nodes) {
  const geo = new THREE.SphereGeometry(nodeSize(node), 14, 10);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorFor(node)),
    transparent: true,
    opacity: NODE_BASE_OPACITY,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(node.x, node.y, node.z);
  mesh.userData.node = node;
  nodeGroup.add(mesh);
  nodeMeshes.set(node.id, mesh);
}

// =====================================================================
//   Link lines
// =====================================================================
const linkGroup = new THREE.Group();
scene.add(linkGroup);

const lineMeshes = new Map();
const BASE_LINE_COLOR = new THREE.Color(0x6a87b0);
const OUT_LINE_COLOR = new THREE.Color(0x6cd1a1);
const IN_LINE_COLOR = new THREE.Color(0xff8fa3);
const DIM_LINE_COLOR = new THREE.Color(0x2a3850);

for (const link of links) {
  const src = nodeById.get(typeof link.source === 'object' ? link.source.id : link.source);
  const tgt = nodeById.get(typeof link.target === 'object' ? link.target.id : link.target);
  if (!src || !tgt) continue;
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(src.x, src.y, src.z),
    new THREE.Vector3(tgt.x, tgt.y, tgt.z),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: BASE_LINE_COLOR.clone(),
    transparent: true,
    opacity: 0.20,
  });
  const line = new THREE.Line(geo, mat);
  linkGroup.add(line);
  lineMeshes.set(link, line);
}

// =====================================================================
//   Highlight state
// =====================================================================
const hl = { nodes: new Set(), links: new Set(), out: new Set(), in: new Set(), focus: null };
function setHighlight(node) {
  hl.nodes.clear(); hl.links.clear(); hl.out.clear(); hl.in.clear(); hl.focus = node || null;
  if (!node) return;
  hl.nodes.add(node);
  for (const n of node.neighbors) hl.nodes.add(n);
  for (const l of node.outLinks) { hl.links.add(l); hl.out.add(l); }
  for (const l of node.inLinks) { hl.links.add(l); hl.in.add(l); }
}

let searchHits = null;
function applySearch(q) {
  if (!q) { searchHits = null; applyHighlight(); return; }
  const qLower = q.toLowerCase();
  searchHits = new Set(nodes.filter((n) =>
    (n.label || '').toLowerCase().includes(qLower) || (n.filePath || '').toLowerCase().includes(qLower)
  ).map((n) => n.id));
  applyHighlight();
}

function applyHighlight() {
  for (const mesh of nodeMeshes.values()) {
    const node = mesh.userData.node;
    let dim = false;
    if (searchHits && !searchHits.has(node.id)) dim = true;
    if (hl.focus && !hl.nodes.has(node)) dim = true;
    if (dim) {
      mesh.material.color.set(0x404a5c);
      mesh.material.opacity = DIM_OPACITY;
      mesh.scale.setScalar(1);
    } else {
      mesh.material.color.set(colorFor(node));
      mesh.material.opacity = NODE_BASE_OPACITY;
      mesh.scale.setScalar(node === hl.focus ? 1.4 : 1);
    }
  }
  for (const [link, line] of lineMeshes.entries()) {
    if (hl.out.has(link)) {
      line.material.color.copy(OUT_LINE_COLOR);
      line.material.opacity = 0.90;
    } else if (hl.in.has(link)) {
      line.material.color.copy(IN_LINE_COLOR);
      line.material.opacity = 0.90;
    } else if (hl.focus && !hl.links.has(link)) {
      line.material.color.copy(DIM_LINE_COLOR);
      line.material.opacity = 0.04;
    } else {
      line.material.color.copy(BASE_LINE_COLOR);
      line.material.opacity = 0.20;
    }
  }
}

// =====================================================================
//   OrbitControls + camera fly-to
// =====================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.minDistance = SPHERE_R * 1.2;
controls.maxDistance = SPHERE_R * 6;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

function stopAutoRotate() { controls.autoRotate = false; }
container.addEventListener('mousedown', stopAutoRotate);
container.addEventListener('wheel', stopAutoRotate, { passive: true });
container.addEventListener('touchstart', stopAutoRotate, { passive: true });

let flyAnim = null;
function flyToNode(node) {
  stopAutoRotate();
  const targetDist = SPHERE_R * 1.6;
  const dir = new THREE.Vector3(node.x, node.y, node.z).normalize();
  const dst = dir.multiplyScalar(targetDist);
  const src = camera.position.clone();
  const t0 = performance.now();
  const DUR = 750;
  if (flyAnim) cancelAnimationFrame(flyAnim);
  function step() {
    const t = Math.min(1, (performance.now() - t0) / DUR);
    const e = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(src, dst, e);
    controls.update();
    if (t < 1) flyAnim = requestAnimationFrame(step);
    else flyAnim = null;
  }
  step();
}

// =====================================================================
//   Raycasting (hover + click)
// =====================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredMesh = null;
let panelPinned = false;

function eventToPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickNode() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(nodeGroup.children, false);
  return hits[0]?.object || null;
}

renderer.domElement.addEventListener('mousemove', (e) => {
  eventToPointer(e);
  const mesh = pickNode();
  if (mesh !== hoveredMesh) {
    hoveredMesh = mesh;
    renderer.domElement.style.cursor = mesh ? 'pointer' : '';
    if (!panelPinned) {
      const node = mesh?.userData.node;
      setHighlight(node);
      applyHighlight();
      if (node) showTooltipForNode(node);
      else hideTooltip();
    }
  }
});

renderer.domElement.addEventListener('click', (e) => {
  eventToPointer(e);
  const mesh = pickNode();
  if (mesh) {
    openPanel(mesh.userData.node);
    flyToNode(mesh.userData.node);
  } else {
    closePanel();
  }
});

// =====================================================================
//   Tooltip
// =====================================================================
const tooltipEl = document.getElementById('tooltip');
function showTooltipForNode(node) {
  const ins = node.inLinks.length;
  const outs = node.outLinks.length;
  const desc = node.description ? '<div class="desc">' + escapeHtml(node.description) + '</div>' : '';
  const path = node.filePath && node.filePath !== node.label
    ? '<div class="path">' + escapeHtml(node.filePath) + '</div>' : '';
  tooltipEl.innerHTML =
    '<div class="label">' + escapeHtml(node.label || node.id) + '</div>' + path +
    '<div class="path">' + node.type + ' · ↑ ' + ins + ' in · ↓ ' + outs + ' out</div>' + desc;
  tooltipEl.style.opacity = '1';
}
function hideTooltip() { tooltipEl.style.opacity = '0'; }
document.addEventListener('mousemove', (e) => {
  tooltipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 380) + 'px';
  tooltipEl.style.top = Math.min(e.clientY + 14, window.innerHeight - 160) + 'px';
});

// =====================================================================
//   Detail panel (cascade nav)
// =====================================================================
const panelEl = document.getElementById('panel');

function openPanel(node) {
  panelPinned = true;
  setHighlight(node);
  applyHighlight();
  hideTooltip();
  panelEl.classList.add('open');

  document.getElementById('panel-name').textContent = node.label || node.id;
  document.getElementById('panel-path').textContent =
    node.filePath && node.filePath !== node.label ? node.filePath : '';
  document.getElementById('panel-desc').textContent = node.description || '—';
  document.getElementById('panel-metrics').innerHTML =
    '<div><b>' + node.inLinks.length + '</b> incoming</div>' +
    '<div><b>' + node.outLinks.length + '</b> outgoing</div>' +
    '<div>' + node.type + '</div>';

  renderConnectedList('out-list', node.outLinks.map((l) => endpointNode(l, 'target')), 'outgoing');
  renderConnectedList('in-list', node.inLinks.map((l) => endpointNode(l, 'source')), 'incoming');
  document.getElementById('out-count').textContent = String(node.outLinks.length);
  document.getElementById('in-count').textContent = String(node.inLinks.length);
}

function endpointNode(link, end) {
  const ref = link[end];
  return typeof ref === 'object' ? ref : nodeById.get(ref);
}

function renderConnectedList(elId, items, dirClass) {
  const el = document.getElementById(elId);
  if (items.length === 0) {
    el.innerHTML = '<li class="empty"><span style="font-style:italic">none</span></li>';
    return;
  }
  el.innerHTML = items.map((n) => {
    return '<li class="' + dirClass + '" data-id="' + escapeAttr(n.id) + '">' +
      '<span class="arrow">' + (dirClass === 'outgoing' ? '→' : '←') + '</span>' +
      '<div class="item-body">' +
        '<div class="item-name">' + escapeHtml(n.label || n.id) + '</div>' +
        (n.filePath && n.filePath !== n.label ? '<div class="item-desc" style="color:var(--muted)">' + escapeHtml(n.filePath) + '</div>' : '') +
        (n.description ? '<div class="item-desc">' + escapeHtml(n.description) + '</div>' : '') +
      '</div>' +
      '<span class="item-type">' + n.type + '</span>' +
    '</li>';
  }).join('');

  el.querySelectorAll('li[data-id]').forEach((li) => {
    const id = li.getAttribute('data-id');
    const n = nodeById.get(id);
    if (!n) return;
    li.addEventListener('mouseenter', () => {
      setHighlight(n);
      applyHighlight();
      const rect = li.getBoundingClientRect();
      showTooltipForNode(n);
      tooltipEl.style.left = Math.max(20, rect.left - 16 - 380) + 'px';
      tooltipEl.style.top = rect.top + 'px';
    });
    li.addEventListener('click', () => {
      openPanel(n);
      flyToNode(n);
    });
  });
}

function closePanel() {
  panelPinned = false;
  setHighlight(null);
  applyHighlight();
  hideTooltip();
  panelEl.classList.remove('open');
}
document.getElementById('panel-close').addEventListener('click', closePanel);

document.getElementById('search').addEventListener('input', (e) => applySearch(e.target.value.trim()));

// =====================================================================
//   Animation loop + resize
// =====================================================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  w = window.innerWidth - 320;
  h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// =====================================================================
//   Helpers
// =====================================================================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
</script>
</body>
</html>
`;
}
