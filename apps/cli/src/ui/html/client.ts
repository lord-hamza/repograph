/**
 * The browser-side application embedded into the generated HTML. It is emitted
 * verbatim inside a <script type="module">, AFTER a `const DATA = {...}` and a
 * `const INITIAL_VIEW = "..."` have been declared. To stay safe inside a JS
 * template literal it uses NO backticks and NO `${` — strings are concatenated.
 */
export const CLIENT_SCRIPT = `
const meta = DATA.metadata || {};
const techStack = meta.techStack || [];
const roadmap = meta.roadmap || null;

const VALID_VIEWS = ['globe','flat','web','brain','roadmap'];
let viewMode = VALID_VIEWS.indexOf(INITIAL_VIEW) >= 0 ? INITIAL_VIEW : 'globe';

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

const moduleList = [...new Set((DATA.nodes||[]).map((n) => moduleKey(n.filePath)))].sort();
const moduleColorMap = new Map();
moduleList.forEach((m, i) => moduleColorMap.set(m, PALETTE[i % PALETTE.length]));
function moduleColor(m) { return moduleColorMap.get(m) || '#888'; }
function colorFor(n) { return moduleColor(moduleKey(n.filePath)); }

function nodeSize(n) {
  if (n.type === 'file') return 3.8 + Math.min(7, Math.log2(1 + (n.inDegree || 0)) * 1.8);
  if (n.type === 'class') return 2.4;
  return 2.0;
}

const nodes = (DATA.nodes||[]).map((n) => ({ ...n, _mod: moduleKey(n.filePath), neighbors: [], inLinks: [], outLinks: [], x:0, y:0, z:0 }));
const nodeById = new Map(nodes.map((n) => [n.id, n]));
function srcId(l){ return typeof l.source === 'object' ? l.source.id : l.source; }
function tgtId(l){ return typeof l.target === 'object' ? l.target.id : l.target; }
const links = (DATA.links||[]).map((l) => ({ ...l })).filter((l) => nodeById.has(srcId(l)) && nodeById.has(tgtId(l)));
for (const l of links) {
  const src = nodeById.get(srcId(l));
  const tgt = nodeById.get(tgtId(l));
  src.neighbors.push(tgt); tgt.neighbors.push(src);
  src.outLinks.push(l); tgt.inLinks.push(l);
}
const degreeOf = (n) => (n.inLinks.length + n.outLinks.length);

const SPHERE_R = 240;
const nodesByModule = new Map();
for (const n of nodes) {
  if (!nodesByModule.has(n._mod)) nodesByModule.set(n._mod, []);
  nodesByModule.get(n._mod).push(n);
}

// =====================================================================
//   Layout helpers
// =====================================================================
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

// ---- Globe: nodes pinned to a sphere surface, clustered by module ----
function layoutGlobe() {
  const map = new Map();
  const moduleDir = new Map();
  moduleList.forEach((m, i) => moduleDir.set(m, fibSphereDir(i, moduleList.length)));
  if (moduleList.length <= 1) {
    const all = nodesByModule.get(moduleList[0]) || nodes;
    all.forEach((n, i) => {
      const d = fibSphereDir(i, all.length);
      map.set(n.id, { x: d.x * SPHERE_R, y: d.y * SPHERE_R, z: d.z * SPHERE_R });
    });
    return map;
  }
  for (const [mod, mods] of nodesByModule.entries()) {
    const c = moduleDir.get(mod);
    if (!c || mods.length === 0) continue;
    if (mods.length === 1) { map.set(mods[0].id, { x: c.x * SPHERE_R, y: c.y * SPHERE_R, z: c.z * SPHERE_R }); continue; }
    const up = Math.abs(c.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const t1 = norm3(cross(up, c));
    const t2 = norm3(cross(c, t1));
    const spread = Math.min(0.55, 0.18 + 0.05 * Math.sqrt(mods.length));
    const phi = Math.PI * (3 - Math.sqrt(5));
    mods.forEach((node, i) => {
      const ratio = i / (mods.length - 1);
      const r = Math.sqrt(ratio) * spread;
      const a = i * phi;
      const dx = t1.x * Math.cos(a) * r + t2.x * Math.sin(a) * r;
      const dy = t1.y * Math.cos(a) * r + t2.y * Math.sin(a) * r;
      const dz = t1.z * Math.cos(a) * r + t2.z * Math.sin(a) * r;
      let px = c.x + dx, py = c.y + dy, pz = c.z + dz;
      const m = Math.sqrt(px * px + py * py + pz * pz) || 1;
      map.set(node.id, { x: (px / m) * SPHERE_R, y: (py / m) * SPHERE_R, z: (pz / m) * SPHERE_R });
    });
  }
  // any node missed (shouldn't happen) → origin shell
  nodes.forEach((n, i) => { if (!map.has(n.id)) { const d = fibSphereDir(i, nodes.length); map.set(n.id, { x: d.x*SPHERE_R, y: d.y*SPHERE_R, z: d.z*SPHERE_R }); } });
  return map;
}

// ---- Radial shell by degree (fast, deterministic) — used as the web
//      fallback for very large graphs and as the force-sim seed. ----
function layoutShell() {
  const map = new Map();
  const sorted = [...nodes].sort((a, b) => degreeOf(b) - degreeOf(a));
  const N = sorted.length || 1;
  sorted.forEach((n, i) => {
    const rank = i / N;                       // 0 (hub) → ~1 (leaf)
    const radius = 40 + rank * (SPHERE_R - 20);
    const d = fibSphereDir(i, N);
    map.set(n.id, { x: d.x * radius, y: d.y * radius, z: d.z * radius });
  });
  return map;
}

// ---- Web: 3D force-directed "spider web". Repulsion + import-springs,
//      seeded from the shell layout, with a hard size/iteration budget. ----
function layoutWeb() {
  const N = nodes.length;
  if (N === 0) return new Map();
  if (N > 900) return layoutShell();          // too big for O(n^2) — shell it

  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const seed = layoutShell();
  const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
  nodes.forEach((n, i) => { const p = seed.get(n.id); px[i] = p.x; py[i] = p.y; pz[i] = p.z; });
  const edges = links.map((l) => [idx.get(srcId(l)), idx.get(tgtId(l))]).filter((e) => e[0] != null && e[1] != null);

  const iters = N > 500 ? 90 : N > 200 ? 160 : 260;
  const REPEL = 5200, SPRING = 0.02, GRAVITY = 0.012, SPRING_LEN = 42;
  const dx = new Float64Array(N), dy = new Float64Array(N), dz = new Float64Array(N);
  for (let it = 0; it < iters; it++) {
    dx.fill(0); dy.fill(0); dz.fill(0);
    const cool = 1 - it / iters;
    for (let a = 0; a < N; a++) {
      for (let b = a + 1; b < N; b++) {
        let vx = px[a] - px[b], vy = py[a] - py[b], vz = pz[a] - pz[b];
        let d2 = vx*vx + vy*vy + vz*vz + 0.1;
        const f = REPEL / d2;
        const d = Math.sqrt(d2); vx /= d; vy /= d; vz /= d;
        dx[a] += vx*f; dy[a] += vy*f; dz[a] += vz*f;
        dx[b] -= vx*f; dy[b] -= vy*f; dz[b] -= vz*f;
      }
    }
    for (const [a, b] of edges) {
      let vx = px[b] - px[a], vy = py[b] - py[a], vz = pz[b] - pz[a];
      const d = Math.sqrt(vx*vx + vy*vy + vz*vz) + 0.01;
      const f = SPRING * (d - SPRING_LEN);
      vx = vx/d*f; vy = vy/d*f; vz = vz/d*f;
      dx[a] += vx; dy[a] += vy; dz[a] += vz;
      dx[b] -= vx; dy[b] -= vy; dz[b] -= vz;
    }
    for (let i = 0; i < N; i++) {
      dx[i] -= px[i]*GRAVITY; dy[i] -= py[i]*GRAVITY; dz[i] -= pz[i]*GRAVITY;
      const step = 8 * cool;
      const dl = Math.sqrt(dx[i]*dx[i] + dy[i]*dy[i] + dz[i]*dz[i]) || 1;
      const s = Math.min(step, dl) / dl;
      px[i] += dx[i]*s; py[i] += dy[i]*s; pz[i] += dz[i]*s;
    }
  }
  // normalize to ~SPHERE_R extent
  let maxR = 1;
  for (let i = 0; i < N; i++) { const r = Math.sqrt(px[i]*px[i] + py[i]*py[i] + pz[i]*pz[i]); if (r > maxR) maxR = r; }
  const scale = (SPHERE_R * 1.15) / maxR;
  const map = new Map();
  nodes.forEach((n, i) => map.set(n.id, { x: px[i]*scale, y: py[i]*scale, z: pz[i]*scale }));
  return map;
}

// ---- Brain: two hemispheres, modules split left/right, neuron clusters ----
function layoutBrain() {
  const map = new Map();
  const mods = moduleList.length ? moduleList : ['(root)'];
  const half = Math.ceil(mods.length / 2);
  mods.forEach((mod, mi) => {
    const side = mi < half ? -1 : 1;          // left / right hemisphere
    const inSide = side < 0 ? mi : mi - half;
    const sideCount = side < 0 ? half : (mods.length - half);
    const list = nodesByModule.get(mod) || [];
    // hemisphere center, distributed front-to-back and top-to-bottom
    const t = sideCount > 1 ? inSide / (sideCount - 1) : 0.5;
    const cx = side * (95 + 35 * Math.cos(t * Math.PI));
    const cy = (t - 0.5) * 150;
    const cz = Math.sin(t * Math.PI * 2) * 70;
    list.forEach((n, i) => {
      const d = fibSphereDir(i, list.length);
      const r = 30 + Math.sqrt(list.length) * 4;
      // squash into an ellipsoid for a more brain-like lobe
      map.set(n.id, { x: cx + d.x * r * 0.85, y: cy + d.y * r * 1.05, z: cz + d.z * r * 0.9 });
    });
  });
  nodes.forEach((n, i) => { if (!map.has(n.id)) { const d = fibSphereDir(i, nodes.length); map.set(n.id, { x: d.x*120, y: d.y*120, z: d.z*120 }); } });
  return map;
}

const layoutCache = {};
function getLayout(name) {
  const key = (name === 'web' || name === 'brain') ? name : 'globe';
  if (!layoutCache[key]) {
    layoutCache[key] = key === 'web' ? layoutWeb() : key === 'brain' ? layoutBrain() : layoutGlobe();
  }
  return layoutCache[key];
}

// seed initial positions
(function seedPositions() {
  const L = getLayout(viewMode === 'web' || viewMode === 'brain' ? viewMode : 'globe');
  for (const n of nodes) { const p = L.get(n.id) || { x: 0, y: 0, z: 0 }; n.x = p.x; n.y = p.y; n.z = p.z; }
})();

// =====================================================================
//   Sidebar UI
// =====================================================================
const stats = [
  ['Files', meta.repo && meta.repo.fileCount != null ? meta.repo.fileCount : '—'],
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
  '<div class="legend-row"><span class="swatch" style="background:' + moduleColor(m) + '"></span>' + escapeHtml(m) + '</div>'
).join('');
const techEl = document.getElementById('tech-stack');
if (techStack.length === 0) {
  techEl.innerHTML = '<div class="legend-row" style="font-style:italic;">No tech detected</div>';
} else {
  techEl.innerHTML = techStack.slice(0, 14).map((t) => {
    const v = t.version ? ' · v' + escapeHtml(String(t.version).replace(/^[\\^~>=<]+/, '')) : '';
    return '<div class="tech-row">' +
      '<span><span class="cat">' + escapeHtml(t.category) + '</span><span class="name">' + escapeHtml(t.name) + '</span></span>' +
      '<span class="meta">' + t.fileCount + ' file' + (t.fileCount === 1 ? '' : 's') + v + '</span>' +
    '</div>';
  }).join('');
}

// =====================================================================
//   Three.js scene
// =====================================================================
const container = document.getElementById('graph-canvas');
const scene = new THREE.Scene();
const BG_GRAPH = new THREE.Color(0x04070d);
const BG_BRAIN = new THREE.Color(0x070512);
scene.background = BG_GRAPH;
scene.fog = new THREE.FogExp2(0x04070d, 0.0009);

let w = Math.max(1, window.innerWidth - 320);
let h = Math.max(1, window.innerHeight);
const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 5000);
camera.position.set(0, 0, SPHERE_R * 2.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(w, h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// --- Globe decoration (wireframe sphere + meridians + atmosphere) ---
const globeDecor = new THREE.Group();
scene.add(globeDecor);
const wireGeo = new THREE.SphereGeometry(SPHERE_R, 48, 32);
const wireMat = new THREE.MeshBasicMaterial({ color: 0x6a8db0, wireframe: true, transparent: true, opacity: 0.08, depthWrite: false });
globeDecor.add(new THREE.Mesh(wireGeo, wireMat));
const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fa6cf, transparent: true, opacity: 0.22, depthWrite: false });
const torusGeo = new THREE.TorusGeometry(SPHERE_R, 0.45, 12, 128);
const eq = new THREE.Mesh(torusGeo, ringMat); eq.rotation.x = Math.PI / 2; globeDecor.add(eq);
globeDecor.add(new THREE.Mesh(torusGeo, ringMat));
const m45 = new THREE.Mesh(torusGeo, ringMat.clone()); m45.material.opacity = 0.10; m45.rotation.y = Math.PI / 4; globeDecor.add(m45);
const atmosGeo = new THREE.SphereGeometry(SPHERE_R * 1.10, 48, 32);
const atmosMat = new THREE.MeshBasicMaterial({ color: 0x2a4870, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false });
globeDecor.add(new THREE.Mesh(atmosGeo, atmosMat));

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
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorFor(node)), transparent: true, opacity: NODE_BASE_OPACITY });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(node.x, node.y, node.z);
  mesh.userData.node = node;
  nodeGroup.add(mesh);
  nodeMeshes.set(node.id, mesh);
}

// --- Brain glow layer (additive Points), lazy-built, brain-only ---
let glowPoints = null;
function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function buildGlowPoints() {
  if (glowPoints) return;
  const L = getLayout('brain');
  const pos = new Float32Array(nodes.length * 3);
  const col = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => {
    const p = L.get(n.id) || { x: 0, y: 0, z: 0 };
    pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z;
    const c = new THREE.Color(colorFor(n));
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 18, map: makeGlowTexture(), transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8, sizeAttenuation: true });
  glowPoints = new THREE.Points(geo, mat);
  glowPoints.visible = false;
  scene.add(glowPoints);
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
  const src = nodeById.get(srcId(link));
  const tgt = nodeById.get(tgtId(link));
  if (!src || !tgt) continue;
  const geo = new THREE.BufferGeometry().setFromPoints([ new THREE.Vector3(src.x, src.y, src.z), new THREE.Vector3(tgt.x, tgt.y, tgt.z) ]);
  const mat = new THREE.LineBasicMaterial({ color: BASE_LINE_COLOR.clone(), transparent: true, opacity: 0.20 });
  const line = new THREE.Line(geo, mat);
  linkGroup.add(line);
  lineMeshes.set(link, line);
}
function updateLinePositions() {
  for (const [link, line] of lineMeshes.entries()) {
    const src = nodeById.get(srcId(link));
    const tgt = nodeById.get(tgtId(link));
    if (!src || !tgt) continue;
    const arr = line.geometry.attributes.position.array;
    arr[0] = src.x; arr[1] = src.y; arr[2] = src.z;
    arr[3] = tgt.x; arr[4] = tgt.y; arr[5] = tgt.z;
    line.geometry.attributes.position.needsUpdate = true;
  }
}

// =====================================================================
//   Layout switching (tweened)
// =====================================================================
let layoutAnim = null;
function applyLayout(name, animate) {
  const L = getLayout(name);
  for (const n of nodes) { const p = L.get(n.id) || { x: 0, y: 0, z: 0 }; n._from = { x: n.x, y: n.y, z: n.z }; n._to = p; }
  if (layoutAnim) cancelAnimationFrame(layoutAnim);
  const heavy = links.length > 3000 || nodes.length > 1500;
  if (!animate || heavy) {
    for (const n of nodes) { n.x = n._to.x; n.y = n._to.y; n.z = n._to.z; const m = nodeMeshes.get(n.id); if (m) m.position.set(n.x, n.y, n.z); }
    updateLinePositions();
    return;
  }
  const t0 = performance.now(); const DUR = 650;
  function step() {
    const t = Math.min(1, (performance.now() - t0) / DUR);
    const e = 1 - Math.pow(1 - t, 3);
    for (const n of nodes) {
      n.x = n._from.x + (n._to.x - n._from.x) * e;
      n.y = n._from.y + (n._to.y - n._from.y) * e;
      n.z = n._from.z + (n._to.z - n._from.z) * e;
      const m = nodeMeshes.get(n.id); if (m) m.position.set(n.x, n.y, n.z);
    }
    updateLinePositions();
    if (t < 1) layoutAnim = requestAnimationFrame(step); else layoutAnim = null;
  }
  step();
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
function applyHighlight3D() {
  const brain = viewMode === 'brain';
  for (const mesh of nodeMeshes.values()) {
    const node = mesh.userData.node;
    let dim = false;
    if (searchHits && !searchHits.has(node.id)) dim = true;
    if (hl.focus && !hl.nodes.has(node)) dim = true;
    if (dim) { mesh.material.color.set(0x404a5c); mesh.material.opacity = DIM_OPACITY; mesh.scale.setScalar(1); }
    else { mesh.material.color.set(colorFor(node)); mesh.material.opacity = brain ? 0.7 : NODE_BASE_OPACITY; mesh.scale.setScalar(node === hl.focus ? 1.4 : 1); }
  }
  for (const [link, line] of lineMeshes.entries()) {
    if (hl.out.has(link)) { line.material.color.copy(OUT_LINE_COLOR); line.material.opacity = 0.90; }
    else if (hl.in.has(link)) { line.material.color.copy(IN_LINE_COLOR); line.material.opacity = 0.90; }
    else if (hl.focus && !hl.links.has(link)) { line.material.color.copy(DIM_LINE_COLOR); line.material.opacity = 0.04; }
    else { line.material.color.copy(BASE_LINE_COLOR); line.material.opacity = brain ? 0.10 : 0.20; }
  }
}
let applyHighlight2D = () => {};
function applyHighlight() { applyHighlight3D(); applyHighlight2D(); }

// =====================================================================
//   OrbitControls + camera fly-to
// =====================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.minDistance = SPHERE_R * 0.5;
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
  const dir = new THREE.Vector3(node.x, node.y, node.z);
  if (dir.length() < 1) dir.set(0, 0, 1);
  dir.normalize();
  const dst = dir.multiplyScalar(targetDist);
  const src = camera.position.clone();
  const t0 = performance.now(); const DUR = 750;
  if (flyAnim) cancelAnimationFrame(flyAnim);
  function step() {
    const t = Math.min(1, (performance.now() - t0) / DUR);
    const e = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(src, dst, e);
    controls.update();
    if (t < 1) flyAnim = requestAnimationFrame(step); else flyAnim = null;
  }
  step();
}
let panToNode2D = () => {};
function focusNode(node) {
  if (viewMode === 'flat') panToNode2D(node);
  else if (viewMode === 'globe' || viewMode === 'web' || viewMode === 'brain') flyToNode(node);
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
  return hits[0] ? hits[0].object : null;
}
renderer.domElement.addEventListener('mousemove', (e) => {
  eventToPointer(e);
  const mesh = pickNode();
  if (mesh !== hoveredMesh) {
    hoveredMesh = mesh;
    renderer.domElement.style.cursor = mesh ? 'pointer' : '';
    if (!panelPinned) {
      const node = mesh ? mesh.userData.node : null;
      setHighlight(node); applyHighlight();
      if (node) showTooltipForNode(node); else hideTooltip();
    }
  }
});
renderer.domElement.addEventListener('click', (e) => {
  eventToPointer(e);
  const mesh = pickNode();
  if (mesh) { openPanel(mesh.userData.node); focusNode(mesh.userData.node); } else { closePanel(); }
});

// =====================================================================
//   Tooltip
// =====================================================================
const tooltipEl = document.getElementById('tooltip');
function showTooltipForNode(node) {
  const ins = node.inLinks.length, outs = node.outLinks.length;
  const desc = node.description ? '<div class="desc">' + escapeHtml(node.description) + '</div>' : '';
  const path = node.filePath && node.filePath !== node.label ? '<div class="path">' + escapeHtml(node.filePath) + '</div>' : '';
  tooltipEl.innerHTML =
    '<div class="label">' + escapeHtml(node.label || node.id) + '</div>' + path +
    '<div class="path">' + escapeHtml(node.type) + ' · ↑ ' + ins + ' in · ↓ ' + outs + ' out</div>' + desc;
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
  setHighlight(node); applyHighlight(); hideTooltip();
  panelEl.classList.add('open');
  document.getElementById('panel-name').textContent = node.label || node.id;
  document.getElementById('panel-path').textContent = node.filePath && node.filePath !== node.label ? node.filePath : '';
  document.getElementById('panel-desc').textContent = node.description || '—';
  document.getElementById('panel-metrics').innerHTML =
    '<div><b>' + node.inLinks.length + '</b> incoming</div>' +
    '<div><b>' + node.outLinks.length + '</b> outgoing</div>' +
    '<div>' + escapeHtml(node.type) + '</div>';
  renderConnectedList('out-list', node.outLinks.map((l) => endpointNode(l, 'target')), 'outgoing');
  renderConnectedList('in-list', node.inLinks.map((l) => endpointNode(l, 'source')), 'incoming');
  document.getElementById('out-count').textContent = String(node.outLinks.length);
  document.getElementById('in-count').textContent = String(node.inLinks.length);
}
function endpointNode(link, end) { const ref = link[end]; return typeof ref === 'object' ? ref : nodeById.get(ref); }
function renderConnectedList(elId, items, dirClass) {
  const el = document.getElementById(elId);
  if (items.length === 0) { el.innerHTML = '<li class="empty"><span style="font-style:italic">none</span></li>'; return; }
  el.innerHTML = items.filter(Boolean).map((n) =>
    '<li class="' + dirClass + '" data-id="' + escapeAttr(n.id) + '">' +
      '<span class="arrow">' + (dirClass === 'outgoing' ? '→' : '←') + '</span>' +
      '<div class="item-body">' +
        '<div class="item-name">' + escapeHtml(n.label || n.id) + '</div>' +
        (n.filePath && n.filePath !== n.label ? '<div class="item-desc" style="color:var(--muted)">' + escapeHtml(n.filePath) + '</div>' : '') +
        (n.description ? '<div class="item-desc">' + escapeHtml(n.description) + '</div>' : '') +
      '</div>' +
      '<span class="item-type">' + escapeHtml(n.type) + '</span>' +
    '</li>'
  ).join('');
  el.querySelectorAll('li[data-id]').forEach((li) => {
    const id = li.getAttribute('data-id');
    const n = nodeById.get(id); if (!n) return;
    li.addEventListener('mouseenter', () => {
      setHighlight(n); applyHighlight();
      const rect = li.getBoundingClientRect();
      showTooltipForNode(n);
      tooltipEl.style.left = Math.max(20, rect.left - 16 - 380) + 'px';
      tooltipEl.style.top = rect.top + 'px';
    });
    li.addEventListener('click', () => { openPanel(n); focusNode(n); });
  });
}
function closePanel() { panelPinned = false; setHighlight(null); applyHighlight(); hideTooltip(); panelEl.classList.remove('open'); }
document.getElementById('panel-close').addEventListener('click', closePanel);
document.getElementById('search').addEventListener('input', (e) => applySearch(e.target.value.trim()));

// =====================================================================
//   2D layout (SVG renderer — "Map" view)
// =====================================================================
const RING_R_2D = 280;
const positions2D = new Map();
function nodeSize2D(n) {
  if (n.type === 'file') return 4 + Math.min(7, Math.log2(1 + (n.inDegree || 0)) * 1.6);
  if (n.type === 'class') return 2.6;
  return 2.2;
}
function compute2DPositions() {
  positions2D.clear();
  if (moduleList.length <= 1) {
    const all = nodesByModule.get(moduleList[0]) || nodes;
    const innerR = Math.min(220, 30 + Math.sqrt(all.length) * 18);
    const phi = Math.PI * (3 - Math.sqrt(5));
    all.forEach((n, i) => {
      const ratio = all.length <= 1 ? 0 : i / (all.length - 1);
      const r = Math.sqrt(ratio) * innerR; const theta = i * phi;
      positions2D.set(n.id, { x: r * Math.cos(theta), y: r * Math.sin(theta) });
    });
    return;
  }
  moduleList.forEach((mod, mi) => {
    const angle = (mi / moduleList.length) * Math.PI * 2 - Math.PI / 2;
    const cx = RING_R_2D * Math.cos(angle), cy = RING_R_2D * Math.sin(angle);
    const mods = nodesByModule.get(mod);
    if (!mods || mods.length === 0) return;
    if (mods.length === 1) { positions2D.set(mods[0].id, { x: cx, y: cy }); return; }
    const moduleR = Math.min(130, 22 + Math.sqrt(mods.length) * 14);
    const phi = Math.PI * (3 - Math.sqrt(5));
    mods.forEach((n, i) => {
      const ratio = i / (mods.length - 1);
      const r = Math.sqrt(ratio) * moduleR; const theta = i * phi;
      positions2D.set(n.id, { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
    });
  });
}
compute2DPositions();
const svg2dEl = document.getElementById('graph-2d');
const zoomGroupEl = document.getElementById('zoom-group');
const linksLayer2D = document.getElementById('links-2d');
const nodesLayer2D = document.getElementById('nodes-2d');
const SVG_NS = 'http://www.w3.org/2000/svg';
const nodeCircles2D = new Map();
const lineEls2D = new Map();
function build2D() {
  const lineFrag = document.createDocumentFragment();
  for (const link of links) {
    const s = positions2D.get(srcId(link)); const t = positions2D.get(tgtId(link));
    if (!s || !t) continue;
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('x1', String(s.x)); ln.setAttribute('y1', String(s.y));
    ln.setAttribute('x2', String(t.x)); ln.setAttribute('y2', String(t.y));
    ln.setAttribute('stroke', 'rgba(140,170,210,0.22)'); ln.setAttribute('stroke-width', '0.7');
    lineFrag.appendChild(ln); lineEls2D.set(link, ln);
  }
  linksLayer2D.appendChild(lineFrag);
  const nodeFrag = document.createDocumentFragment();
  for (const n of nodes) {
    const p = positions2D.get(n.id); if (!p) continue;
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('class', 'node-2d'); c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y));
    c.setAttribute('r', String(nodeSize2D(n))); c.setAttribute('fill', colorFor(n));
    c.setAttribute('stroke', '#0a0e17'); c.setAttribute('stroke-width', '1'); c.setAttribute('data-node-id', n.id);
    nodeFrag.appendChild(c); nodeCircles2D.set(n.id, c);
  }
  nodesLayer2D.appendChild(nodeFrag);
}
build2D();
let zoom2D = 1, panX2D = 0, panY2D = 0;
let svgCenterX = w / 2, svgCenterY = h / 2;
function updateTransform2D() {
  zoomGroupEl.setAttribute('transform', 'translate(' + (svgCenterX + panX2D) + ',' + (svgCenterY + panY2D) + ') scale(' + zoom2D + ')');
}
updateTransform2D();
let dragging2D = false, dragStart = null;
svg2dEl.addEventListener('mousedown', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('node-2d')) return;
  dragging2D = true; svg2dEl.classList.add('panning');
  dragStart = { x: e.clientX, y: e.clientY, px: panX2D, py: panY2D };
});
window.addEventListener('mousemove', (e) => {
  if (!dragging2D || !dragStart) return;
  panX2D = dragStart.px + (e.clientX - dragStart.x); panY2D = dragStart.py + (e.clientY - dragStart.y);
  updateTransform2D();
});
window.addEventListener('mouseup', () => { if (!dragging2D) return; dragging2D = false; svg2dEl.classList.remove('panning'); });
svg2dEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = svg2dEl.getBoundingClientRect();
  const mx = e.clientX - rect.left - svgCenterX - panX2D;
  const my = e.clientY - rect.top - svgCenterY - panY2D;
  const factor = Math.exp(-e.deltaY * 0.0015);
  const newZoom = Math.max(0.25, Math.min(6, zoom2D * factor));
  const ratio = newZoom / zoom2D;
  panX2D -= mx * (ratio - 1); panY2D -= my * (ratio - 1); zoom2D = newZoom;
  updateTransform2D();
}, { passive: false });
function measure2D() {
  const rect = svg2dEl.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) { svgCenterX = rect.width / 2; svgCenterY = rect.height / 2; }
  else { svgCenterX = Math.max(1, window.innerWidth - 320) / 2; svgCenterY = window.innerHeight / 2; }
}
function resetView2D() { measure2D(); zoom2D = 1; panX2D = 0; panY2D = 0; updateTransform2D(); }
nodesLayer2D.addEventListener('mouseover', (e) => {
  const t = e.target; if (!(t instanceof SVGCircleElement)) return;
  const node = nodeById.get(t.getAttribute('data-node-id')); if (!node) return;
  if (!panelPinned) { setHighlight(node); applyHighlight(); showTooltipForNode(node); }
});
nodesLayer2D.addEventListener('mouseout', (e) => {
  const t = e.target; if (!(t instanceof SVGCircleElement)) return;
  if (!panelPinned) { setHighlight(null); applyHighlight(); hideTooltip(); }
});
nodesLayer2D.addEventListener('click', (e) => {
  const t = e.target; if (!(t instanceof SVGCircleElement)) return;
  const node = nodeById.get(t.getAttribute('data-node-id')); if (!node) return;
  openPanel(node); focusNode(node); e.stopPropagation();
});
svg2dEl.addEventListener('click', (e) => {
  if (e.target === svg2dEl || e.target === zoomGroupEl || e.target === linksLayer2D || e.target === nodesLayer2D) closePanel();
});
let panAnim = null;
panToNode2D = function (node) {
  const p = positions2D.get(node.id); if (!p) return;
  const targetPx = -p.x * zoom2D, targetPy = -p.y * zoom2D;
  const startPx = panX2D, startPy = panY2D;
  const t0 = performance.now(); const DUR = 550;
  if (panAnim) cancelAnimationFrame(panAnim);
  function step() {
    const tt = Math.min(1, (performance.now() - t0) / DUR);
    const ee = 1 - Math.pow(1 - tt, 3);
    panX2D = startPx + (targetPx - startPx) * ee; panY2D = startPy + (targetPy - startPy) * ee;
    updateTransform2D();
    if (tt < 1) panAnim = requestAnimationFrame(step); else panAnim = null;
  }
  step();
};
applyHighlight2D = function () {
  for (const [id, c] of nodeCircles2D.entries()) {
    const node = nodeById.get(id); if (!node) continue;
    let dim = false;
    if (searchHits && !searchHits.has(node.id)) dim = true;
    if (hl.focus && !hl.nodes.has(node)) dim = true;
    if (dim) { c.setAttribute('fill', '#404a5c'); c.setAttribute('fill-opacity', '0.18'); c.setAttribute('stroke-opacity', '0.4'); }
    else {
      c.setAttribute('fill', colorFor(node)); c.setAttribute('fill-opacity', '1'); c.setAttribute('stroke-opacity', '1');
      if (node === hl.focus) { c.setAttribute('stroke', '#ffd866'); c.setAttribute('stroke-width', '2.2'); }
      else { c.setAttribute('stroke', '#0a0e17'); c.setAttribute('stroke-width', '1'); }
    }
  }
  for (const [link, line] of lineEls2D.entries()) {
    if (hl.out.has(link)) { line.setAttribute('stroke', '#6cd1a1'); line.setAttribute('stroke-opacity', '0.95'); line.setAttribute('stroke-width', '1.6'); }
    else if (hl.in.has(link)) { line.setAttribute('stroke', '#ff8fa3'); line.setAttribute('stroke-opacity', '0.95'); line.setAttribute('stroke-width', '1.6'); }
    else if (hl.focus && !hl.links.has(link)) { line.setAttribute('stroke', 'rgba(64,74,92,0.06)'); line.setAttribute('stroke-width', '0.5'); }
    else { line.setAttribute('stroke', 'rgba(140,170,210,0.22)'); line.setAttribute('stroke-width', '0.7'); }
  }
};

// =====================================================================
//   Roadmap view
// =====================================================================
const roadmapEl = document.getElementById('roadmap-view');
const repoKey = (roadmap && roadmap.repoName) || (meta.repo && (meta.repo.owner && meta.repo.name ? meta.repo.owner + '/' + meta.repo.name : meta.repo.target)) || 'repo';
function skillStorageKey(stageId, skillName) { return 'repograph:rm:' + repoKey + ':' + stageId + ':' + skillName; }
let roadmapBuilt = false;
function isSkillDone(stageId, skillName) { try { return localStorage.getItem(skillStorageKey(stageId, skillName)) === '1'; } catch (e) { return false; } }
function setSkillDone(stageId, skillName, done) { try { if (done) localStorage.setItem(skillStorageKey(stageId, skillName), '1'); else localStorage.removeItem(skillStorageKey(stageId, skillName)); } catch (e) {} }

function buildRoadmapView() {
  if (roadmapBuilt) return; roadmapBuilt = true;
  if (!roadmap || !roadmap.stages || roadmap.stages.length === 0) {
    roadmapEl.innerHTML = '<div class="rm-empty">No roadmap was generated for this repository.</div>';
    return;
  }
  let html = '<div class="rm-header"><h2>Learning Roadmap</h2><p>' + escapeHtml(roadmap.summary || '') +
    ' Tick off skills as you master them — your progress is saved in this browser.</p></div><div class="rm-track">';
  roadmap.stages.forEach((stage, si) => {
    html += '<div class="rm-stage" data-stage="' + escapeAttr(stage.id) + '">';
    html += '<div class="rm-stage-head">' +
      '<div class="rm-badge">' + (si + 1) + '</div>' +
      '<div class="rm-stage-meta"><div class="t">' + escapeHtml(stage.title) + '</div><div class="s">' + escapeHtml(stage.subtitle || '') + '</div></div>' +
      '<div class="rm-stage-count" data-count="' + escapeAttr(stage.id) + '">0/' + stage.skills.length + '</div>' +
      '<div class="rm-stage-chev">▾</div></div>';
    html += '<div class="rm-skills">';
    stage.skills.forEach((skill) => {
      const safeDoc = skill.doc && /^https?:\\/\\//i.test(skill.doc) ? skill.doc : null;
      const doc = safeDoc ? '<div class="rm-skill-doc"><a href="' + escapeAttr(safeDoc) + '" target="_blank" rel="noopener noreferrer">Open docs ↗</a></div>' : '';
      html += '<div class="rm-skill" data-stage="' + escapeAttr(stage.id) + '" data-skill="' + escapeAttr(skill.name) + '">' +
        '<div class="rm-check">✓</div>' +
        '<div class="rm-skill-body">' +
          '<div class="rm-skill-name">' + escapeHtml(skill.name) + '<span class="rm-level ' + escapeAttr(skill.level || 'recommended') + '">' + escapeHtml(skill.level || 'recommended') + '</span></div>' +
          '<div class="rm-skill-why">' + escapeHtml(skill.why || '') + '</div>' + doc +
        '</div></div>';
    });
    html += '</div></div>';
    if (si < roadmap.stages.length - 1) html += '<div class="rm-connector"></div>';
  });
  html += '</div>';
  roadmapEl.innerHTML = html;

  roadmapEl.querySelectorAll('.rm-stage-head').forEach((head) => {
    head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
  });
  roadmapEl.querySelectorAll('.rm-skill').forEach((el) => {
    const stageId = el.getAttribute('data-stage'); const skillName = el.getAttribute('data-skill');
    if (isSkillDone(stageId, skillName)) el.classList.add('done');
    const toggle = (e) => {
      e.stopPropagation();
      const done = !el.classList.contains('done');
      el.classList.toggle('done', done);
      setSkillDone(stageId, skillName, done);
      refreshRoadmapProgress();
    };
    el.querySelector('.rm-check').addEventListener('click', toggle);
  });
  refreshRoadmapProgress();
}
function refreshRoadmapProgress() {
  if (!roadmap || !roadmap.stages) return;
  let total = 0, done = 0;
  const stageRows = [];
  roadmap.stages.forEach((stage) => {
    let sDone = 0;
    stage.skills.forEach((skill) => { total++; if (isSkillDone(stage.id, skill.name)) { done++; sDone++; } });
    stageRows.push([stage.title, sDone, stage.skills.length]);
    const countEl = roadmapEl.querySelector('[data-count="' + cssEscape(stage.id) + '"]');
    if (countEl) countEl.textContent = sDone + '/' + stage.skills.length;
  });
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('rm-progress-bar'); if (bar) bar.style.width = pct + '%';
  const txt = document.getElementById('rm-progress-text'); if (txt) txt.textContent = done + ' / ' + total + ' skills';
  const pctEl = document.getElementById('rm-progress-pct'); if (pctEl) pctEl.textContent = pct + '%';
  const sp = document.getElementById('rm-stage-progress');
  if (sp) sp.innerHTML = stageRows.map((r) => '<div class="stage-progress-row"><span>' + escapeHtml(r[0]) + '</span><b>' + r[1] + '/' + r[2] + '</b></div>').join('');
}
const resetBtn = document.getElementById('roadmap-reset');
if (resetBtn) resetBtn.addEventListener('click', () => {
  if (!roadmap || !roadmap.stages) return;
  roadmap.stages.forEach((stage) => stage.skills.forEach((skill) => setSkillDone(stage.id, skill.name, false)));
  roadmapEl.querySelectorAll('.rm-skill.done').forEach((el) => el.classList.remove('done'));
  refreshRoadmapProgress();
});

// =====================================================================
//   View toggle
// =====================================================================
const graphSidebar = document.getElementById('graph-sidebar');
const roadmapSidebar = document.getElementById('roadmap-progress');
function setViewMode(mode, fromHash) {
  if (VALID_VIEWS.indexOf(mode) < 0) mode = 'globe';
  viewMode = mode;
  document.querySelectorAll('#view-toggle button').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === mode);
  });
  const is3D = mode === 'globe' || mode === 'web' || mode === 'brain';
  container.style.display = is3D ? '' : 'none';
  svg2dEl.style.display = mode === 'flat' ? 'block' : 'none';
  roadmapEl.classList.toggle('show', mode === 'roadmap');
  graphSidebar.classList.toggle('hidden', mode === 'roadmap');
  roadmapSidebar.classList.toggle('show', mode === 'roadmap');

  if (mode === 'roadmap') { buildRoadmapView(); }
  else if (mode === 'flat') { resetView2D(); applyHighlight2D(); }
  else {
    // 3D modes
    globeDecor.visible = mode === 'globe';
    scene.background = mode === 'brain' ? BG_BRAIN : BG_GRAPH;
    controls.autoRotate = mode !== 'brain';
    if (mode === 'brain') { buildGlowPoints(); }
    if (glowPoints) glowPoints.visible = mode === 'brain';
    applyLayout(mode, !fromHash);
    applyHighlight3D();
  }
  if (!fromHash) { try { history.replaceState(null, '', '#' + mode); } catch (e) {} }
  if (panelPinned && hl.focus && mode !== 'roadmap') focusNode(hl.focus);
}
document.querySelectorAll('#view-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => setViewMode(btn.getAttribute('data-view'), false));
});
window.addEventListener('hashchange', () => {
  const m = (location.hash || '').replace('#', '');
  if (VALID_VIEWS.indexOf(m) >= 0 && m !== viewMode) setViewMode(m, true);
});

// =====================================================================
//   Animation loop + resize
// =====================================================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (viewMode === 'brain' && glowPoints) {
    glowPoints.material.opacity = 0.6 + 0.25 * Math.sin(performance.now() * 0.0016);
  }
  renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => {
  w = Math.max(1, window.innerWidth - 320); h = Math.max(1, window.innerHeight);
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  if (viewMode === 'flat') measure2D(); else { svgCenterX = w / 2; svgCenterY = h / 2; }
  updateTransform2D();
});

// =====================================================================
//   Helpers
// =====================================================================
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function cssEscape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'); }

// =====================================================================
//   Boot
// =====================================================================
const bootHashView = (location.hash || '').replace('#', '');
setViewMode(VALID_VIEWS.indexOf(bootHashView) >= 0 ? bootHashView : viewMode, true);
applyHighlight();
`;
