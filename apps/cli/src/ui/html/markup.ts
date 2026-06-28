export function markup(safeTitle: string): string {
  return `
<div id="app">
  <aside id="sidebar">
    <h1>${safeTitle}</h1>
    <div class="sub">RepoGraph · interactive code atlas</div>
    <div id="stats"></div>

    <div id="graph-sidebar" class="sidebar-section">
      <div class="section-title">Filter</div>
      <input id="search" placeholder="Filter by name or path…" autocomplete="off" />

      <div class="section-title">Tech Stack</div>
      <div id="tech-stack"></div>

      <div class="section-title">Modules</div>
      <div class="legend-group" id="module-legend"></div>

      <div class="footer-hint">
        <div><b>Drag</b> to rotate · <b>scroll</b> to zoom.</div>
        <div><b>Hover</b> a node to preview · <b>click</b> to open details.</div>
        <div>Switch views: Globe · Map · Web · Brain · Roadmap.</div>
        <div style="margin-top:6px;"><span style="color:var(--out)">━</span> outgoing · <span style="color:var(--in)">━</span> incoming</div>
      </div>
    </div>

    <div id="roadmap-progress">
      <div class="section-title">Your Progress</div>
      <div class="progress-label"><span id="rm-progress-text">0 / 0 skills</span><span id="rm-progress-pct">0%</span></div>
      <div class="progress-meter"><span id="rm-progress-bar"></span></div>
      <div class="section-title">By Stage</div>
      <div id="rm-stage-progress"></div>
      <button id="roadmap-reset">Reset progress</button>
      <div class="footer-hint">Tick off skills as you learn them. Progress is saved in this browser.</div>
    </div>
  </aside>

  <div id="graph">
    <div id="view-toggle">
      <button data-view="globe" class="active"><span class="ic globe"></span>Globe</button>
      <button data-view="flat"><span class="ic flat"></span>Map</button>
      <button data-view="web"><span class="ic web"></span>Web</button>
      <button data-view="brain"><span class="ic brain"></span>Brain</button>
      <button data-view="roadmap"><span class="ic roadmap"></span>Roadmap</button>
    </div>
    <div id="graph-canvas"></div>
    <svg id="graph-2d" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><g id="zoom-group"><g id="links-2d"></g><g id="nodes-2d"></g></g></svg>
    <div id="roadmap-view"></div>
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
<div id="tooltip"></div>`;
}
