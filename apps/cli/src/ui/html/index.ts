import { CLIENT_SCRIPT } from "./client.js";
import { markup } from "./markup.js";
import { STYLES } from "./styles.js";

/**
 * Render the self-contained interactive HTML page. Everything (styles, markup,
 * data, and the full client app) is inlined so the output is a single portable
 * file that runs from file:// with no server and no build step. The only
 * external dependency is Three.js, loaded from a CDN via an import map.
 */
export function renderGraphHtml(graphJson: string, title: string): string {
  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Neutralize any "</script" inside the embedded JSON so it can't break out
  // of the <script> block.
  const escapedJson = graphJson.replace(/<\/script/gi, "<\\/script");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle} — RepoGraph</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${STYLES}
</style>
</head>
<body>
${markup(safeTitle)}

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
const INITIAL_VIEW = 'globe';
${CLIENT_SCRIPT}
</script>
</body>
</html>
`;
}
