import { randomBytes } from "node:crypto";
import { CLIENT_SCRIPT } from "./client.js";
import { markup } from "./markup.js";
import { STYLES } from "./styles.js";

const THREE_CDN = "https://unpkg.com";
const THREE_VERSION = "0.160.0";
const THREE_MODULE_URL = `${THREE_CDN}/three@${THREE_VERSION}/build/three.module.js`;
const THREE_ADDONS_URL = `${THREE_CDN}/three@${THREE_VERSION}/examples/jsm/`;
const ORBIT_URL = `${THREE_ADDONS_URL}controls/OrbitControls.js`;
// Subresource Integrity for the pinned CDN modules. Enforced by browsers that
// support import-map integrity (Chrome 127+), ignored gracefully by others —
// CSP still restricts the origin and the version is pinned. Recompute these if
// THREE_VERSION changes.
const THREE_SRI = "sha384-61S/Nu32S3E5+n+KpCOTb2eRYps6fVKm+9Gz1QBvSePFthb46f063Aa/qe/lykFZ";
const ORBIT_SRI = "sha384-qlO/ZugKPxAQUAvTlQoo0QECzxJIJySZmCF/DHdb2Xn/hHndFwX/vfUAC9Hbk6LP";

/**
 * Render the self-contained interactive HTML page. Everything (styles, markup,
 * data, and the full client app) is inlined so the output is a single portable
 * file that runs from file:// with no server and no build step. The only
 * external dependency is Three.js, loaded from a pinned CDN via an import map.
 *
 * Security:
 *  - A per-file CSP nonce gates the inline scripts. Even if untrusted repo data
 *    ever escaped HTML-escaping, an injected `<script>` without the nonce will
 *    not execute (defense-in-depth on top of escapeHtml/escapeAttr in client.ts).
 *  - `default-src 'none'` + `connect-src 'none'` means the page can't exfiltrate
 *    data; scripts may only come from this file (nonce) or the pinned CDN origin.
 *  - Any `</script` inside the embedded JSON is neutralized so it can't break out.
 */
export function renderGraphHtml(graphJson: string, title: string): string {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const escapedJson = graphJson.replace(/<\/script/gi, "<\\/script");
  const nonce = randomBytes(16).toString("base64");

  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${THREE_CDN}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="referrer" content="no-referrer" />
<title>${safeTitle} — RepoGraph</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${STYLES}
</style>
</head>
<body>
${markup(safeTitle)}

<script type="importmap" nonce="${nonce}">
{
  "imports": {
    "three": "${THREE_MODULE_URL}",
    "three/addons/": "${THREE_ADDONS_URL}"
  },
  "integrity": {
    "${THREE_MODULE_URL}": "${THREE_SRI}",
    "${ORBIT_URL}": "${ORBIT_SRI}"
  }
}
</script>

<script type="module" nonce="${nonce}">
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
