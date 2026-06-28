// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CLIENT_SCRIPT } from "./client.js";
import { markup } from "./markup.js";
import { renderGraphHtml } from "./index.js";

// --------------------------------------------------------------------------
//  Minimal THREE.js + OrbitControls stubs (headless — no WebGL/canvas needed)
// --------------------------------------------------------------------------
class Color {
  r = 1; g = 1; b = 1;
  constructor(c?: unknown) { if (c !== undefined) this.set(c); }
  set(c: unknown) {
    let n = -1;
    if (typeof c === "number") n = c;
    else if (typeof c === "string" && c[0] === "#") n = parseInt(c.slice(1), 16);
    if (n >= 0) { this.r = ((n >> 16) & 255) / 255; this.g = ((n >> 8) & 255) / 255; this.b = (n & 255) / 255; }
    return this;
  }
  copy(o: Color) { this.r = o.r; this.g = o.g; this.b = o.b; return this; }
  clone() { return new Color().copy(this); }
}
class Vector3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
  multiplyScalar(s: number) { this.x *= s; this.y *= s; this.z *= s; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(o: Vector3) { this.x = o.x; this.y = o.y; this.z = o.z; return this; }
  lerpVectors(a: Vector3, b: Vector3, t: number) { this.x = a.x + (b.x - a.x) * t; this.y = a.y + (b.y - a.y) * t; this.z = a.z + (b.z - a.z) * t; return this; }
}
class Group { children: unknown[] = []; visible = true; add(o: unknown) { this.children.push(o); return this; } }
class Scene extends Group { background: unknown = null; fog: unknown = null; }
class BufferAttribute { needsUpdate = false; constructor(public array: Float32Array, public itemSize: number) {} }
class BufferGeometry {
  attributes: Record<string, { array: Float32Array; needsUpdate: boolean }> = {};
  setFromPoints(pts: Vector3[]) {
    const a = new Float32Array([pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z]);
    this.attributes.position = { array: a, needsUpdate: false };
    return this;
  }
  setAttribute(name: string, attr: BufferAttribute) { this.attributes[name] = { array: attr.array, needsUpdate: false }; return this; }
}
const mat = (o: Record<string, unknown> = {}) => {
  const color = o.color instanceof Color ? o.color : new Color(o.color);
  const m: Record<string, unknown> = { ...o, color, opacity: o.opacity != null ? o.opacity : 1 };
  m.clone = () => mat({ ...m, color: (m.color as Color).clone() });
  return m;
};
class Mesh { position = new Vector3(); rotation = { x: 0, y: 0, z: 0 }; scale = { setScalar() {} }; userData: Record<string, unknown> = {}; constructor(public geometry: unknown, public material: { color: Color; opacity: number }) {} }
class Line { constructor(public geometry: BufferGeometry, public material: { color: Color; opacity: number }) {} }
class Points { visible = true; constructor(public geometry: unknown, public material: { opacity: number }) {} }
class PerspectiveCamera { position = new Vector3(); aspect = 1; updateProjectionMatrix() {} }
class WebGLRenderer { domElement = document.createElement("canvas"); setSize() {} setPixelRatio() {} render() {} }
class Raycaster { setFromCamera() {} intersectObjects() { return [] as unknown[]; } }

const THREE = {
  Scene, Group, Color, Vector3, Vector2: class { x = 0; y = 0; },
  FogExp2: class {}, AmbientLight: class {},
  PerspectiveCamera, WebGLRenderer, Raycaster,
  SphereGeometry: class {}, TorusGeometry: class {},
  BufferGeometry, BufferAttribute,
  MeshBasicMaterial: function (o: Record<string, unknown>) { return mat(o); } as unknown as new () => unknown,
  LineBasicMaterial: function (o: Record<string, unknown>) { return mat(o); } as unknown as new () => unknown,
  PointsMaterial: function (o: Record<string, unknown>) { return mat(o); } as unknown as new () => unknown,
  Mesh, Line, Points,
  CanvasTexture: class { constructor(public image: unknown) {} },
  AdditiveBlending: 2, BackSide: 1,
};
class OrbitControls {
  enableDamping = false; dampingFactor = 0; rotateSpeed = 0; zoomSpeed = 0;
  minDistance = 0; maxDistance = 0; autoRotate = false; autoRotateSpeed = 0;
  constructor(_c: unknown, _d: unknown) {}
  update() {}
}

// --------------------------------------------------------------------------
//  Harness: boot the real client script in a fresh DOM
// --------------------------------------------------------------------------
function setupGlobals() {
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1;
  (globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};
  if (!globalThis.performance) (globalThis as Record<string, unknown>).performance = { now: () => 0 };
  // jsdom canvas getContext returns null without the canvas package — stub a 2d ctx
  (window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ({
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    set fillStyle(_v: unknown) {},
  });
}

function boot(data: unknown, initialView = "globe") {
  localStorage.clear();
  document.body.innerHTML = markup("demo");
  setupGlobals();
  const errors: string[] = [];
  window.addEventListener("error", (e) => errors.push((e as ErrorEvent).message || "error"));
  const fn = new Function("THREE", "OrbitControls", "DATA", "INITIAL_VIEW", CLIENT_SCRIPT);
  fn(THREE, OrbitControls, data, initialView);
  return { errors };
}

const FIXTURE = {
  metadata: {
    repo: { fileCount: 3, source: "local", target: "/tmp/demo", scannedAt: "2026-01-01T00:00:00Z" },
    languageStats: { typescript: 3, javascript: 0, python: 0, unknown: 0 },
    techStack: [{ name: "React", category: "framework", confidence: 0.9, fileCount: 2, files: [], interactsWith: [], version: "^18.0.0" }],
    entryPoints: ["file:a"],
    orphanFiles: ["file:c"],
    circularDependencies: [],
    roadmap: {
      repoName: "demo", summary: "To build a project like demo, follow this 3-skill path.", skillCount: 3,
      stages: [
        { id: "foundations", title: "Foundations", subtitle: "Basics", skills: [
          { name: "TypeScript", why: "Primary language.", doc: "https://www.typescriptlang.org/docs/", level: "core" },
          { name: "Git", why: "Version control.", level: "core" },
        ] },
        { id: "ship", title: "Ship It", subtitle: "Release", skills: [
          { name: "npm publish", why: "Release it.", doc: "https://docs.npmjs.com", level: "recommended" },
        ] },
      ],
    },
  },
  nodes: [
    { id: "file:a", type: "file", label: "a.ts", filePath: "src/a.ts", inDegree: 0, outDegree: 1, description: "entry" },
    { id: "file:b", type: "file", label: "b.ts", filePath: "src/b.ts", inDegree: 1, outDegree: 0, description: "lib" },
    { id: "file:c", type: "file", label: "c.ts", filePath: "lib/c.ts", inDegree: 0, outDegree: 0, description: "orphan" },
  ],
  links: [{ source: "file:a", target: "file:b", type: "import", weight: 1 }],
};

function clickView(view: string) {
  const btn = document.querySelector('#view-toggle [data-view="' + view + '"]') as HTMLElement;
  btn.click();
}

beforeEach(() => { localStorage.clear(); });

describe("renderGraphHtml output", () => {
  const html = renderGraphHtml(JSON.stringify(FIXTURE), "demo");
  it("is a single self-contained document with all five views", () => {
    expect(html).toContain("<!doctype html>");
    for (const v of ["globe", "flat", "web", "brain", "roadmap"]) {
      expect(html).toContain('data-view="' + v + '"');
    }
    expect(html).toContain("importmap");
    expect(html).toContain("three@0.160.0");
  });
  it("escapes a </script> inside the embedded JSON", () => {
    const evil = { ...FIXTURE, nodes: [{ ...FIXTURE.nodes[0], description: "</script><script>alert(1)</script>" }] };
    const out = renderGraphHtml(JSON.stringify(evil), "x");
    expect(out).not.toContain("</script><script>alert(1)");
    expect(out).toContain("<\\/script");
  });
  it("escapes HTML in the title", () => {
    expect(renderGraphHtml("{}", "<img src=x>")).toContain("&lt;img src=x&gt;");
  });
});

describe("client app boots and switches views", () => {
  it("boots on the globe view with stats and tech rendered, no errors", () => {
    const { errors } = boot(FIXTURE);
    expect(errors).toEqual([]);
    expect(document.getElementById("stats")!.children.length).toBeGreaterThan(0);
    expect(document.getElementById("tech-stack")!.textContent).toContain("React");
    expect(document.querySelector('#view-toggle [data-view="globe"]')!.classList.contains("active")).toBe(true);
  });

  it("switches through web, brain, map, and back to globe without errors", () => {
    const { errors } = boot(FIXTURE);
    for (const v of ["web", "brain", "flat", "globe"]) clickView(v);
    expect(errors).toEqual([]);
  });

  it("renders the roadmap with stages and tracks progress in localStorage", () => {
    const { errors } = boot(FIXTURE);
    clickView("roadmap");
    expect(errors).toEqual([]);
    const view = document.getElementById("roadmap-view")!;
    expect(view.classList.contains("show")).toBe(true);
    const stages = view.querySelectorAll(".rm-stage");
    expect(stages.length).toBe(2);
    const skills = view.querySelectorAll(".rm-skill");
    expect(skills.length).toBe(3);

    // sidebar swaps to progress
    expect(document.getElementById("roadmap-progress")!.classList.contains("show")).toBe(true);
    expect(document.getElementById("graph-sidebar")!.classList.contains("hidden")).toBe(true);

    // check off a skill → persisted + progress updates
    (view.querySelector(".rm-skill .rm-check") as HTMLElement).click();
    expect(view.querySelector(".rm-skill")!.classList.contains("done")).toBe(true);
    expect(document.getElementById("rm-progress-text")!.textContent).toContain("1 / 3");
    const stored = Object.keys(localStorage).filter((k) => k.startsWith("repograph:rm:"));
    expect(stored.length).toBe(1);
  });

  it("boots directly into the roadmap view via INITIAL_VIEW (deep-link)", () => {
    const { errors } = boot(FIXTURE, "roadmap");
    expect(errors).toEqual([]);
    expect(document.getElementById("roadmap-view")!.classList.contains("show")).toBe(true);
  });
});

describe("client app edge cases", () => {
  it("handles an empty graph (no nodes, no roadmap) without errors", () => {
    const empty = {
      metadata: { repo: { fileCount: 0, source: "local", target: "/tmp/empty", scannedAt: "x" }, languageStats: { typescript: 0, javascript: 0, python: 0, unknown: 0 }, techStack: [], entryPoints: [], orphanFiles: [], circularDependencies: [] },
      nodes: [], links: [],
    };
    const { errors } = boot(empty);
    for (const v of ["web", "brain", "flat", "roadmap", "globe"]) clickView(v);
    expect(errors).toEqual([]);
    // roadmap view shows a graceful empty message
    clickView("roadmap");
    expect(document.getElementById("roadmap-view")!.textContent).toContain("No roadmap");
  });

  it("handles missing optional fields (no description, no techStack) without errors", () => {
    const minimal = {
      metadata: { repo: { fileCount: 1 }, languageStats: {}, techStack: [], entryPoints: [], orphanFiles: [], circularDependencies: [] },
      nodes: [{ id: "x", type: "file", label: "x", filePath: "x.ts", inDegree: 0, outDegree: 0 }],
      links: [],
    };
    const { errors } = boot(minimal);
    expect(errors).toEqual([]);
    expect(document.getElementById("tech-stack")!.textContent).toContain("No tech detected");
  });
});
