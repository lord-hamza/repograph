export const STYLES = `
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
  .sidebar-section { display: block; }
  .sidebar-section.hidden { display: none; }

  /* ---------------- Roadmap progress (sidebar, roadmap view) ---------------- */
  #roadmap-progress { display: none; }
  #roadmap-progress.show { display: block; }
  .progress-meter { background: #0a1224; border: 1px solid var(--border); border-radius: 8px; height: 12px; overflow: hidden; margin: 6px 0; }
  .progress-meter > span { display: block; height: 100%; background: linear-gradient(90deg, var(--out), var(--accent)); width: 0%; transition: width .3s; }
  .progress-label { font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }
  .stage-progress-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); padding: 4px 0; border-bottom: 1px solid var(--border); }
  .stage-progress-row b { color: var(--fg); font-weight: 600; }
  #roadmap-reset {
    margin-top: 12px; width: 100%; box-sizing: border-box;
    background: #0a1224; color: var(--muted); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px; font: inherit; cursor: pointer; transition: border-color .12s, color .12s;
  }
  #roadmap-reset:hover { color: var(--fg); border-color: var(--accent); }

  /* ---------------- Viewport ---------------- */
  #graph { position: relative; }
  #graph-canvas { position: absolute; inset: 0; }
  #graph-canvas canvas { display: block; cursor: grab; }
  #graph-canvas canvas:active { cursor: grabbing; }
  #graph-2d {
    position: absolute; inset: 0; display: none;
    width: 100%; height: 100%;
    cursor: grab; user-select: none;
  }
  #graph-2d.panning { cursor: grabbing; }
  #graph-2d circle.node-2d { cursor: pointer; }
  #err {
    position: absolute; inset: 0;
    display: none; padding: 30px;
    color: #ff8fa3; font-family: ui-monospace, Menlo, monospace;
    font-size: 12px; white-space: pre-wrap; word-break: break-word;
    background: rgba(20,10,15,0.85); overflow: auto;
  }

  /* ---------------- View toggle (top-center of graph area) ---------------- */
  #view-toggle {
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    background: rgba(14, 20, 34, 0.92);
    border: 1px solid var(--border); border-radius: 999px;
    padding: 4px; display: flex; gap: 2px;
    backdrop-filter: blur(8px);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
    z-index: 25;
  }
  #view-toggle button {
    background: transparent; border: 0; color: var(--muted);
    font: inherit; font-size: 11.5px;
    padding: 6px 13px; border-radius: 999px;
    cursor: pointer; transition: background .12s, color .12s;
    display: flex; align-items: center; gap: 7px;
  }
  #view-toggle button:hover { color: var(--fg); }
  #view-toggle button.active {
    background: var(--accent); color: #061224; font-weight: 600;
  }
  #view-toggle button.active:hover { color: #061224; }
  #view-toggle .ic {
    display: inline-block; width: 11px; height: 11px;
    border: 1.5px solid currentColor; box-sizing: border-box;
  }
  #view-toggle .ic.globe { border-radius: 50%; }
  #view-toggle .ic.flat { border-radius: 1px; }
  #view-toggle .ic.web { border-radius: 50%; border-style: dashed; }
  #view-toggle .ic.brain { border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; }
  #view-toggle .ic.roadmap { border-radius: 0; border-width: 0; position: relative; }
  #view-toggle .ic.roadmap::before {
    content: ""; position: absolute; left: 4px; top: -1px; bottom: -1px;
    border-left: 1.5px dashed currentColor;
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

  /* ---------------- Roadmap view ---------------- */
  #roadmap-view {
    position: absolute; inset: 0; display: none;
    overflow: auto; padding: 70px 32px 48px;
    background:
      radial-gradient(1200px 600px at 50% -10%, rgba(124,185,255,0.10), transparent 60%),
      var(--bg);
  }
  #roadmap-view.show { display: block; }
  .rm-header { max-width: 920px; margin: 0 auto 26px; text-align: center; }
  .rm-header h2 { font-size: 22px; margin: 0 0 8px; letter-spacing: -0.01em; }
  .rm-header p { color: var(--muted); font-size: 13px; margin: 0 auto; max-width: 640px; line-height: 1.5; }
  .rm-track { max-width: 860px; margin: 0 auto; position: relative; }
  .rm-stage { position: relative; padding: 0 0 8px 0; margin: 0 0 10px; }
  .rm-stage-head { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px 14px; border-radius: 12px; transition: background .12s; }
  .rm-stage-head:hover { background: rgba(255,255,255,0.025); }
  .rm-badge {
    flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px; color: #061224;
    background: linear-gradient(135deg, var(--accent), var(--out));
    box-shadow: 0 4px 14px rgba(124,185,255,0.25);
  }
  .rm-stage-meta { flex: 1; min-width: 0; }
  .rm-stage-meta .t { font-size: 15px; font-weight: 600; }
  .rm-stage-meta .s { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
  .rm-stage-count { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .rm-stage-chev { color: var(--muted); transition: transform .18s; font-size: 12px; }
  .rm-stage.collapsed .rm-stage-chev { transform: rotate(-90deg); }
  .rm-connector { width: 2px; height: 14px; background: linear-gradient(var(--border), transparent); margin-left: 31px; }
  .rm-skills { padding: 4px 0 4px 48px; display: grid; gap: 8px; }
  .rm-stage.collapsed .rm-skills { display: none; }
  .rm-skill {
    display: flex; gap: 11px; align-items: flex-start;
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    padding: 11px 13px; transition: border-color .12s, background .12s;
  }
  .rm-skill:hover { border-color: rgba(124,185,255,0.4); }
  .rm-skill.done { opacity: 0.62; }
  .rm-skill.done .rm-skill-name { text-decoration: line-through; }
  .rm-check {
    flex: 0 0 18px; width: 18px; height: 18px; margin-top: 1px;
    border: 1.5px solid var(--border); border-radius: 6px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: transparent; font-size: 12px; transition: all .12s; background: #0a1224;
  }
  .rm-skill.done .rm-check { background: var(--out); border-color: var(--out); color: #061224; }
  .rm-skill-body { flex: 1; min-width: 0; }
  .rm-skill-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rm-level { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.08em; padding: 1px 6px; border-radius: 10px; font-weight: 700; }
  .rm-level.core { background: rgba(108,209,161,0.16); color: var(--out); }
  .rm-level.recommended { background: rgba(124,185,255,0.16); color: var(--accent); }
  .rm-level.advanced { background: rgba(255,143,163,0.16); color: var(--in); }
  .rm-skill-why { font-size: 11.5px; color: var(--muted); margin-top: 4px; line-height: 1.45; }
  .rm-skill-doc { font-size: 11px; margin-top: 6px; }
  .rm-skill-doc a { color: var(--accent); text-decoration: none; }
  .rm-skill-doc a:hover { text-decoration: underline; }
  .rm-empty { text-align: center; color: var(--muted); padding: 60px 20px; font-style: italic; }
`;
