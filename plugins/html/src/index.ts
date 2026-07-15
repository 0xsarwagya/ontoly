import type {
  JsonObject,
  NodeType,
  OntolyPlugin,
  PluginArtifact,
  RelationshipType,
  SoftwareGraph,
  SourceSpan,
} from "@0xsarwagya/ontoly-core";

export interface InteractiveHtmlGraphOptions {
  readonly title?: string | undefined;
  readonly relationships?: readonly RelationshipType[] | undefined;
  readonly nodeTypes?: readonly NodeType[] | undefined;
  readonly maxNodes?: number | undefined;
  readonly maxEdges?: number | undefined;
  readonly includeIsolatedNodes?: boolean | undefined;
}

interface HtmlGraphNode {
  readonly id: string;
  readonly type: NodeType;
  readonly name: string;
  readonly file?: string | undefined;
  readonly package?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

interface HtmlGraphEdge {
  readonly id: string;
  readonly type: RelationshipType;
  readonly from: string;
  readonly to: string;
  readonly confidence?: string | undefined;
  readonly metadata?: JsonObject | undefined;
}

interface HtmlGraphPayload {
  readonly title: string;
  readonly repository: {
    readonly name: string;
    readonly root: string;
  };
  readonly hash: string;
  readonly nodes: readonly HtmlGraphNode[];
  readonly edges: readonly HtmlGraphEdge[];
  readonly stats: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly nodeTypes: Record<string, number>;
    readonly relationships: Record<string, number>;
  };
  readonly filters: {
    readonly nodeTypes: readonly string[];
    readonly relationships: readonly string[];
  };
}

export function createInteractiveHtmlGraph(
  graph: SoftwareGraph,
  options: InteractiveHtmlGraphOptions = {},
): string {
  const payload = createHtmlGraphPayload(graph, options);
  return renderHtml(payload);
}

export function createInteractiveHtmlArtifact(
  graph: SoftwareGraph,
  options: InteractiveHtmlGraphOptions = {},
): PluginArtifact {
  return {
    path: "graph.html",
    mediaType: "text/html",
    contents: createInteractiveHtmlGraph(graph, options),
  };
}

export function createInteractiveHtmlPlugin(
  options: InteractiveHtmlGraphOptions = {},
): OntolyPlugin {
  return {
    name: "@0xsarwagya/ontoly-plugin-html",
    version: "0.1.0-alpha.18",
    run: ({ graph }) => ({
      artifacts: [createInteractiveHtmlArtifact(graph, options)],
    }),
  };
}

function createHtmlGraphPayload(
  graph: SoftwareGraph,
  options: InteractiveHtmlGraphOptions,
): HtmlGraphPayload {
  const relationshipSet = options.relationships ? new Set(options.relationships) : undefined;
  const nodeTypeSet = options.nodeTypes ? new Set(options.nodeTypes) : undefined;
  const maxNodes = normalizeLimit(options.maxNodes);
  const maxEdges = normalizeLimit(options.maxEdges);

  const selectedNodes = graph.nodes
    .filter((node) => !nodeTypeSet || nodeTypeSet.has(node.type))
    .slice(0, maxNodes ?? graph.nodes.length);
  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
  const selectedEdges = graph.edges
    .filter((edge) => !relationshipSet || relationshipSet.has(edge.type))
    .filter((edge) => selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to))
    .slice(0, maxEdges ?? graph.edges.length);
  const connectedNodeIds = new Set(selectedEdges.flatMap((edge) => [edge.from, edge.to]));
  const visibleNodes = options.includeIsolatedNodes === false
    ? selectedNodes.filter((node) => connectedNodeIds.has(node.id))
    : selectedNodes;
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = selectedEdges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));

  const nodes = visibleNodes.map((node): HtmlGraphNode => ({
    id: node.id,
    type: node.type,
    name: node.name,
    file: node.file,
    package: node.package,
    span: node.span,
    metadata: node.metadata,
  }));
  const edges = visibleEdges.map((edge): HtmlGraphEdge => ({
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
    confidence: edge.evidence?.[0]?.confidence,
    metadata: edge.metadata,
  }));

  return {
    title: options.title ?? `${graph.repository.name} Software Graph Explorer`,
    repository: {
      name: graph.repository.name,
      root: graph.repository.root,
    },
    hash: graph.metadata.deterministicHash,
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: countBy(nodes.map((node) => node.type)),
      relationships: countBy(edges.map((edge) => edge.type)),
    },
    filters: {
      nodeTypes: Object.keys(countBy(nodes.map((node) => node.type))).sort(),
      relationships: Object.keys(countBy(edges.map((edge) => edge.type))).sort(),
    },
  };
}

function renderHtml(payload: HtmlGraphPayload): string {
  const title = escapeHtml(payload.title);
  const data = escapeScriptJson(JSON.stringify(payload));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fb;
      --panel: #ffffff;
      --ink: #172033;
      --muted: #667085;
      --line: #d7dce7;
      --accent: #0f766e;
      --accent-soft: #d9f6f2;
      --danger: #b42318;
      --focus: #2563eb;
      --warning: #ca8a04;
      --shadow: 0 18px 45px rgba(23, 32, 51, 0.12);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--bg);
    }

    .shell {
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr) minmax(280px, 360px);
      height: 100vh;
      overflow: hidden;
    }

    .panel {
      min-width: 0;
      overflow: auto;
      background: var(--panel);
      border-right: 1px solid var(--line);
    }

    .details {
      border-right: 0;
      border-left: 1px solid var(--line);
    }

    .panel-inner {
      display: grid;
      gap: 18px;
      padding: 18px;
    }

    .brand {
      display: grid;
      gap: 6px;
    }

    h1,
    h2 {
      margin: 0;
      letter-spacing: 0;
    }

    h1 {
      font-size: 18px;
      line-height: 1.25;
    }

    h2 {
      font-size: 13px;
      text-transform: uppercase;
      color: var(--muted);
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .stat {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfe;
    }

    .stat strong {
      display: block;
      font-size: 20px;
    }

    .stat span {
      color: var(--muted);
      font-size: 12px;
    }

    .summary {
      display: grid;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
    }

    .summary strong {
      font-size: 13px;
    }

    .summary-list {
      display: grid;
      gap: 5px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .mode-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .mode-button {
      min-height: 42px;
      text-align: left;
    }

    .mode-button.active {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-soft);
      font-weight: 700;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }

    input[type="search"] {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 11px;
      color: var(--ink);
      background: #fff;
      font: inherit;
    }

    .checks {
      display: grid;
      gap: 8px;
    }

    .filter-group {
      display: grid;
      gap: 7px;
      padding: 10px 0 0;
    }

    .filter-group-title {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .check {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      background: #fff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 500;
    }

    .check input {
      margin: 0;
      accent-color: var(--accent);
    }

    .graph-wrap {
      position: relative;
      min-width: 0;
      background:
        linear-gradient(rgba(23, 32, 51, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(23, 32, 51, 0.045) 1px, transparent 1px);
      background-size: 32px 32px;
    }

    .toolbar {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 2;
      display: flex;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }

    button {
      border: 1px solid var(--line);
      border-radius: 7px;
      padding: 8px 10px;
      color: var(--ink);
      background: #fff;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: transform 120ms ease-out, border-color 120ms ease-out, background 120ms ease-out;
    }

    button:hover {
      border-color: var(--accent);
    }

    button:active {
      transform: scale(0.97);
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    svg:active {
      cursor: grabbing;
    }

    .edge {
      stroke: #111827;
      stroke-opacity: 0.42;
      stroke-width: 1.25;
      marker-end: url(#arrow);
    }

    .edge.dimmed {
      stroke-opacity: 0.08;
    }

    .edge.highlighted {
      stroke: var(--focus);
      stroke-opacity: 0.9;
      stroke-width: 2.25;
    }

    .edge-label {
      fill: #475467;
      paint-order: stroke;
      stroke: #f7f8fb;
      stroke-width: 4px;
      font-size: 10px;
      pointer-events: none;
    }

    .node circle {
      stroke: rgba(17, 24, 39, 0.35);
      stroke-width: 1.5;
      filter: drop-shadow(0 3px 6px rgba(23, 32, 51, 0.18));
    }

    .node text {
      fill: #172033;
      paint-order: stroke;
      stroke: #ffffff;
      stroke-width: 4px;
      font-size: 11px;
      font-weight: 650;
      pointer-events: none;
    }

    .node.selected circle {
      stroke: var(--accent);
      stroke-width: 4;
    }

    .node.match circle {
      stroke: var(--focus);
      stroke-width: 4;
    }

    .node.related circle {
      stroke: var(--warning);
      stroke-width: 3;
    }

    .node.dimmed {
      opacity: 0.2;
    }

    .mini-map {
      position: absolute;
      right: 14px;
      bottom: 14px;
      z-index: 2;
      width: 180px;
      height: 124px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .mini-map svg {
      min-height: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      background: #fbfcfe;
    }

    .mini-edge {
      stroke: #98a2b3;
      stroke-width: 0.7;
      stroke-opacity: 0.45;
    }

    .mini-node {
      fill: #172033;
      fill-opacity: 0.8;
    }

    .mini-viewport {
      fill: none;
      stroke: var(--accent);
      stroke-width: 1.25;
      stroke-dasharray: 3 2;
    }

    .empty {
      position: absolute;
      inset: 0;
      display: none;
      place-items: center;
      color: var(--muted);
      text-align: center;
      pointer-events: none;
    }

    .detail-card {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
      overflow-wrap: anywhere;
    }

    .detail-card strong {
      font-size: 14px;
    }

    .detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .relationship-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .relationship-list li {
      display: grid;
      gap: 2px;
      border-top: 1px solid var(--line);
      padding-top: 6px;
      font-size: 12px;
    }

    .relationship-list b {
      font-size: 12px;
    }

    .kv {
      display: grid;
      gap: 4px;
      font-size: 13px;
    }

    .kv span {
      color: var(--muted);
      font-size: 12px;
    }

    code,
    pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    pre {
      overflow: auto;
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      white-space: pre-wrap;
    }

    @media (max-width: 980px) {
      .shell {
        grid-template-columns: 1fr;
        grid-template-rows: auto 70vh auto;
        height: auto;
        overflow: visible;
      }

      .panel,
      .details {
        border: 0;
        border-bottom: 1px solid var(--line);
      }

      svg {
        min-height: 70vh;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="panel">
      <div class="panel-inner">
        <div class="brand">
          <h1>Software Graph Explorer</h1>
          <p id="graph-title">${title}</p>
          <p id="repository"></p>
          <p id="hash"></p>
        </div>
        <div class="stat-grid">
          <div class="stat"><strong id="total-nodes">0</strong><span>graph nodes</span></div>
          <div class="stat"><strong id="total-edges">0</strong><span>graph edges</span></div>
          <div class="stat"><strong id="visible-nodes">0</strong><span>visible nodes</span></div>
          <div class="stat"><strong id="visible-edges">0</strong><span>visible edges</span></div>
        </div>
        <section>
          <div class="section-title">
            <h2>Mode</h2>
          </div>
          <div id="view-modes" class="mode-grid"></div>
        </section>
        <label>
          Search
          <input id="search" type="search" placeholder="Jump to AuthService, POST /login, JWT_SECRET">
        </label>
        <section>
          <div class="section-title">
            <h2>Explain</h2>
            <button id="explain" type="button">Explain Graph</button>
          </div>
          <div id="summary" class="summary"></div>
        </section>
        <section>
          <div class="section-title">
            <h2>Node Types</h2>
          </div>
          <div id="node-type-filters" class="checks"></div>
        </section>
        <section>
          <div class="section-title">
            <h2>Relationships</h2>
          </div>
          <div id="relationship-filters" class="checks"></div>
        </section>
      </div>
    </aside>
    <main class="graph-wrap">
      <div class="toolbar">
        <button id="zoom-in" type="button">Zoom In</button>
        <button id="zoom-out" type="button">Zoom Out</button>
        <button id="reset" type="button">Reset</button>
      </div>
      <svg id="graph" role="img" aria-label="Interactive Software Graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#98a2b3"></path>
          </marker>
        </defs>
        <g id="viewport">
          <g id="edges"></g>
          <g id="edge-labels"></g>
          <g id="nodes"></g>
        </g>
      </svg>
      <div class="mini-map" aria-hidden="true">
        <svg id="mini-map" viewBox="0 0 180 124">
          <g id="mini-edges"></g>
          <g id="mini-nodes"></g>
          <rect id="mini-viewport" class="mini-viewport" x="0" y="0" width="0" height="0"></rect>
        </svg>
      </div>
      <div id="empty" class="empty">No graph elements match the active filters.</div>
    </main>
    <aside class="panel details">
      <div class="panel-inner">
        <h2>Selection</h2>
        <div id="selection" class="detail-card">
          <p>Select a node to inspect its graph identity, file, metadata, and adjacent relationships.</p>
        </div>
      </div>
    </aside>
  </div>
  <script id="graph-data" type="application/json">${data}</script>
  <script>
    (function () {
      "use strict";

      var palette = ["#111827", "#0f766e", "#2563eb", "#db2777", "#ca8a04", "#7c3aed", "#dc2626", "#0891b2", "#16a34a", "#ea580c", "#475569"];
      var payload = JSON.parse(document.getElementById("graph-data").textContent);
      var viewModes = [
        { id: "architecture", label: "Architecture" },
        { id: "dependency", label: "Dependency" },
        { id: "call", label: "Call Graph" },
        { id: "full", label: "Full Graph" }
      ];
      var viewMode = hasArchitectureNodes(payload.nodes) ? "architecture" : "full";
      var nodes = [];
      var nodeById = new Map();
      var edges = [];
      var enabledTypes = new Set(payload.filters.nodeTypes);
      var enabledRelationships = new Set(payload.filters.relationships);
      var selectedNodeId = null;
      var traceRootId = null;
      var search = "";
      var searchMatchIds = new Set();
      var relatedNodeIds = new Set();
      var highlightedEdgeIds = new Set();
      var transform = { x: 0, y: 0, scale: 1 };
      var draggingNode = null;
      var draggingCanvas = null;
      var lastPointer = null;
      var lastVisibleNodes = [];
      var lastVisibleEdges = [];

      var svg = document.getElementById("graph");
      var viewport = document.getElementById("viewport");
      var edgeLayer = document.getElementById("edges");
      var edgeLabelLayer = document.getElementById("edge-labels");
      var nodeLayer = document.getElementById("nodes");
      var empty = document.getElementById("empty");
      var miniEdgeLayer = document.getElementById("mini-edges");
      var miniNodeLayer = document.getElementById("mini-nodes");
      var miniViewport = document.getElementById("mini-viewport");

      document.getElementById("repository").textContent = payload.repository.name + " - " + payload.repository.root;
      document.getElementById("hash").textContent = "Graph hash: " + payload.hash;
      document.getElementById("total-nodes").textContent = formatNumber(payload.nodes.length);
      document.getElementById("total-edges").textContent = formatNumber(payload.edges.length);
      document.getElementById("search").addEventListener("input", function (event) {
        search = event.target.value.trim().toLowerCase();
        traceRootId = null;
        selectFirstSearchMatch();
        render();
      });
      document.getElementById("zoom-in").addEventListener("click", function () { zoom(1.18); });
      document.getElementById("zoom-out").addEventListener("click", function () { zoom(1 / 1.18); });
      document.getElementById("reset").addEventListener("click", resetView);
      document.getElementById("explain").addEventListener("click", renderSummary);

      createModeButtons();
      createGroupedChecks("node-type-filters", payload.filters.nodeTypes, enabledTypes, render, nodeTypeGroup);
      createChecks("relationship-filters", payload.filters.relationships, enabledRelationships, render);
      svg.addEventListener("wheel", onWheel, { passive: false });
      svg.addEventListener("pointerdown", onPointerDown);
      svg.addEventListener("pointermove", onPointerMove);
      svg.addEventListener("pointerup", onPointerUp);
      svg.addEventListener("pointercancel", onPointerUp);
      relayout();
      renderSummary();
      resetView();
      render();

      function createChecks(containerId, values, enabled, onChange) {
        var container = document.getElementById(containerId);
        values.forEach(function (value) {
          var label = document.createElement("label");
          label.className = "check";
          var name = document.createElement("span");
          name.textContent = value;
          var input = document.createElement("input");
          input.type = "checkbox";
          input.checked = true;
          input.addEventListener("change", function () {
            if (input.checked) {
              enabled.add(value);
            } else {
              enabled.delete(value);
            }
            traceRootId = null;
            onChange();
          });
          label.append(name, input);
          container.append(label);
        });
      }

      function createGroupedChecks(containerId, values, enabled, onChange, groupFor) {
        var container = document.getElementById(containerId);
        var grouped = new Map();
        values.forEach(function (value) {
          var group = groupFor(value);
          if (!grouped.has(group)) {
            grouped.set(group, []);
          }
          grouped.get(group).push(value);
        });

        Array.from(grouped.keys()).sort(groupSort).forEach(function (group) {
          var wrapper = document.createElement("div");
          wrapper.className = "filter-group";
          var title = document.createElement("div");
          title.className = "filter-group-title";
          title.textContent = group;
          wrapper.append(title);
          grouped.get(group).sort().forEach(function (value) {
            var label = document.createElement("label");
            label.className = "check";
            var name = document.createElement("span");
            name.textContent = value;
            var input = document.createElement("input");
            input.type = "checkbox";
            input.checked = true;
            input.addEventListener("change", function () {
              if (input.checked) {
                enabled.add(value);
              } else {
                enabled.delete(value);
              }
              traceRootId = null;
              onChange();
            });
            label.append(name, input);
            wrapper.append(label);
          });
          container.append(wrapper);
        });
      }

      function createModeButtons() {
        var container = document.getElementById("view-modes");
        viewModes.forEach(function (mode) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "mode-button" + (mode.id === viewMode ? " active" : "");
          button.textContent = mode.label;
          button.setAttribute("data-mode", mode.id);
          button.addEventListener("click", function () {
            viewMode = mode.id;
            traceRootId = null;
            selectedNodeId = null;
            relayout();
            resetView();
            renderSelection(null);
            render();
            renderModeButtons();
          });
          container.append(button);
        });
      }

      function renderModeButtons() {
        Array.from(document.querySelectorAll(".mode-button")).forEach(function (button) {
          button.classList.toggle("active", button.getAttribute("data-mode") === viewMode);
        });
      }

      function relayout() {
        nodes = layoutNodes(payload.nodes, payload.edges, viewMode);
        nodeById = new Map(nodes.map(function (node) { return [node.id, node]; }));
        edges = payload.edges.filter(function (edge) { return nodeById.has(edge.from) && nodeById.has(edge.to); });
      }

      function render() {
        searchMatchIds = new Set();
        relatedNodeIds = new Set();
        highlightedEdgeIds = new Set();

        var allEnabledNodeIds = new Set(nodes.filter(function (node) {
          return enabledTypes.has(node.type);
        }).map(function (node) { return node.id; }));

        var modeNodeIds = new Set(nodes.filter(matchesMode).filter(function (node) {
          return enabledTypes.has(node.type);
        }).map(function (node) { return node.id; }));

        var visibleNodeIds = traceRootId
          ? traceNodeIds(traceRootId, modeNodeIds)
          : new Set(modeNodeIds);

        if (search) {
          searchMatchIds = findSearchMatches(allEnabledNodeIds);
          relatedNodeIds = collectNeighborhood(searchMatchIds, 1, allEnabledNodeIds);
          visibleNodeIds = new Set(Array.from(relatedNodeIds));
        }

        if (selectedNodeId && visibleNodeIds.has(selectedNodeId)) {
          var selectedNeighborhood = collectNeighborhood(new Set([selectedNodeId]), 1, modeNodeIds);
          selectedNeighborhood.forEach(function (id) { relatedNodeIds.add(id); });
        }

        var visibleNodes = nodes.filter(function (node) { return visibleNodeIds.has(node.id); });
        var visibleEdges = edges.filter(function (edge) {
          var modeAllowsEdge = search || traceRootId ? true : relationshipAllowedByMode(edge);
          return enabledRelationships.has(edge.type) && modeAllowsEdge && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
        });

        visibleEdges.forEach(function (edge) {
          if (selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId)) {
            highlightedEdgeIds.add(edge.id);
          }
          if (searchMatchIds.has(edge.from) || searchMatchIds.has(edge.to)) {
            highlightedEdgeIds.add(edge.id);
          }
        });

        var showNodeLabels = visibleNodes.length <= 180;
        var showEdgeLabels = visibleEdges.length <= 250;
        var nodeRadius = radiusFor(visibleNodes.length);
        lastVisibleNodes = visibleNodes;
        lastVisibleEdges = visibleEdges;

        document.getElementById("visible-nodes").textContent = formatNumber(visibleNodes.length);
        document.getElementById("visible-edges").textContent = formatNumber(visibleEdges.length);
        empty.style.display = visibleNodes.length === 0 ? "grid" : "none";
        edgeLayer.replaceChildren();
        edgeLabelLayer.replaceChildren();
        nodeLayer.replaceChildren();

        visibleEdges.forEach(function (edge) {
          var from = nodeById.get(edge.from);
          var to = nodeById.get(edge.to);
          if (!from || !to) {
            return;
          }
          var line = svgElement("line", {
            class: edgeClass(edge),
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y
          });
          edgeLayer.append(line);

          if (showEdgeLabels) {
            var label = svgElement("text", {
              class: "edge-label",
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2
            });
            label.textContent = edge.type;
            edgeLabelLayer.append(label);
          }
        });

        visibleNodes.forEach(function (node) {
          var group = svgElement("g", {
            class: nodeClass(node),
            transform: "translate(" + node.x + " " + node.y + ")",
            "data-node-id": node.id
          });
          group.append(svgElement("circle", {
            r: nodeRadius,
            fill: colorFor(node.type)
          }));
          var title = svgElement("title", {});
          title.textContent = node.type + ": " + node.name;
          group.append(title);
          if (showNodeLabels || node.id === selectedNodeId) {
            var label = svgElement("text", {
              x: 0,
              y: nodeRadius + 14,
              "text-anchor": "middle"
            });
            label.textContent = compactLabel(node.name);
            group.append(label);
          }
          group.addEventListener("click", function (event) {
            event.stopPropagation();
            selectedNodeId = node.id;
            renderSelection(node);
            render();
          });
          nodeLayer.append(group);
        });

        renderMinimap(visibleNodes, visibleEdges);
        updateTransform();
      }

      function layoutNodes(inputNodes, inputEdges, mode) {
        if (mode === "architecture" || mode === "dependency" || mode === "call") {
          return layeredLayout(inputNodes, mode);
        }

        return componentLayout(inputNodes, inputEdges);
      }

      function layeredLayout(inputNodes, mode) {
        var positions = inputNodes.map(function (node) { return Object.assign({}, node, { x: 0, y: 0 }); });
        var groups = new Map();

        positions.forEach(function (node) {
          var rank = rankFor(node, mode);
          if (!groups.has(rank)) {
            groups.set(rank, []);
          }
          groups.get(rank).push(node);
        });

        Array.from(groups.keys()).sort(function (left, right) { return left - right; }).forEach(function (rank, columnIndex) {
          var group = groups.get(rank).sort(function (left, right) {
            return left.type.localeCompare(right.type) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
          });
          var x = columnIndex * 260;
          var startY = -Math.max(0, group.length - 1) * 42;
          group.forEach(function (node, index) {
            node.x = x;
            node.y = startY + index * 84;
          });
        });

        return positions;
      }

      function componentLayout(inputNodes, inputEdges) {
        var positions = inputNodes.map(function (node) { return Object.assign({}, node, { x: 0, y: 0 }); });
        var positionById = new Map(positions.map(function (node) { return [node.id, node]; }));
        var adjacency = new Map(positions.map(function (node) { return [node.id, new Set()]; }));

        inputEdges.forEach(function (edge) {
          if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) {
            return;
          }
          adjacency.get(edge.from).add(edge.to);
          adjacency.get(edge.to).add(edge.from);
        });

        var visited = new Set();
        var components = [];
        positions.forEach(function (node) {
          if (visited.has(node.id)) {
            return;
          }
          var queue = [node.id];
          var component = [];
          visited.add(node.id);

          for (var index = 0; index < queue.length; index += 1) {
            var id = queue[index];
            var current = positionById.get(id);
            if (current) {
              component.push(current);
            }
            Array.from(adjacency.get(id) || []).sort().forEach(function (next) {
              if (!visited.has(next)) {
                visited.add(next);
                queue.push(next);
              }
            });
          }

          component.sort(function (left, right) {
            var degreeDelta = (adjacency.get(right.id) || new Set()).size - (adjacency.get(left.id) || new Set()).size;
            return degreeDelta || left.id.localeCompare(right.id);
          });
          components.push(component);
        });

        components.sort(function (left, right) {
          return right.length - left.length || left[0].id.localeCompare(right[0].id);
        });

        var cursorX = 0;
        var cursorY = 0;
        var rowHeight = 0;
        var maxRowWidth = Math.max(900, Math.ceil(Math.sqrt(Math.max(positions.length, 1))) * 170);

        components.forEach(function (component) {
          var componentRadius = Math.max(70, Math.sqrt(component.length) * 34);
          if (cursorX > 0 && cursorX + componentRadius * 2 > maxRowWidth) {
            cursorX = 0;
            cursorY += rowHeight + 140;
            rowHeight = 0;
          }
          var centerX = cursorX + componentRadius;
          var centerY = cursorY + componentRadius;

          component.forEach(function (node, index) {
            if (component.length === 1) {
              node.x = centerX;
              node.y = centerY;
              return;
            }
            var ring = Math.floor(Math.sqrt(index));
            var ringStart = ring * ring;
            var ringSize = Math.max(1, (ring + 1) * (ring + 1) - ringStart);
            var angle = ((index - ringStart) / ringSize) * Math.PI * 2 + ring * 0.41;
            var radius = Math.min(componentRadius - 16, 28 + ring * 32);
            node.x = centerX + Math.cos(angle) * radius;
            node.y = centerY + Math.sin(angle) * radius;
          });

          cursorX += componentRadius * 2 + 140;
          rowHeight = Math.max(rowHeight, componentRadius * 2);
        });

        return positions;
      }

      function rankFor(node, mode) {
        if (mode === "call") {
          if (node.type === "Route") {
            return 0;
          }
          if (node.type === "Controller" || node.type === "Middleware" || node.type === "Guard") {
            return 1;
          }
          if (node.type === "Service" || node.type === "Provider" || node.type === "Class" || node.type === "Method") {
            return 2;
          }
          if (node.type === "Repository" || node.type === "Model" || node.type === "DatabaseTable") {
            return 3;
          }
          if (node.type === "Function" || node.type === "Operation") {
            return 4;
          }
          return 5;
        }

        if (node.type === "Workspace") {
          return 0;
        }
        if (node.type === "Application" || node.type === "Package") {
          return 1;
        }
        if (node.type === "Framework" || node.type === "Module" || node.type === "Namespace") {
          return 2;
        }
        if (node.type === "Controller" || node.type === "Route" || node.type === "Middleware" || node.type === "Guard") {
          return 3;
        }
        if (node.type === "Service" || node.type === "Provider" || node.type === "Repository" || node.type === "Factory") {
          return 4;
        }
        if (node.type === "Configuration" || node.type === "EnvironmentVariable" || node.type === "Dependency" || node.type === "DatabaseTable") {
          return 5;
        }
        if (node.type === "Class" || node.type === "Interface" || node.type === "TypeAlias" || node.type === "Enum") {
          return 6;
        }
        if (node.type === "Function" || node.type === "Method" || node.type === "Field") {
          return 7;
        }
        return 8;
      }

      function radiusFor(count) {
        if (count > 5000) {
          return 2.5;
        }
        if (count > 1500) {
          return 3.5;
        }
        if (count > 400) {
          return 5;
        }
        if (count > 180) {
          return 7;
        }
        return 14;
      }

      function matchesMode(node) {
        if (viewMode === "full") {
          return true;
        }
        if (viewMode === "architecture") {
          return ["Workspace", "Application", "Package", "Framework", "Module", "Controller", "Route", "Service", "Provider", "Repository", "Configuration", "EnvironmentVariable", "DatabaseTable"].includes(node.type);
        }
        if (viewMode === "dependency") {
          return ["Workspace", "Application", "Package", "Module", "Dependency", "Configuration", "EnvironmentVariable", "Service", "Provider", "Repository", "Class", "Interface"].includes(node.type);
        }
        if (viewMode === "call") {
          return ["Route", "Controller", "Middleware", "Guard", "Service", "Provider", "Repository", "Class", "Function", "Method", "Operation", "Model", "DatabaseTable"].includes(node.type);
        }
        return true;
      }

      function relationshipAllowedByMode(edge) {
        if (viewMode === "architecture") {
          return ["CONTAINS", "BELONGS_TO", "REGISTERED_IN", "REGISTERS", "DECLARES", "MOUNTS", "HANDLES", "PROVIDES", "CONFIGURES", "DEPENDS_ON", "INJECTS", "USES"].includes(edge.type);
        }
        if (viewMode === "dependency") {
          return ["DEPENDS_ON", "IMPORTS", "EXPORTS", "USES", "INJECTS", "PROVIDES", "CONSUMES", "READS", "CONFIGURES", "CONTAINS"].includes(edge.type);
        }
        if (viewMode === "call") {
          return ["HANDLES", "CALLS", "USES", "INJECTS", "READS", "WRITES", "RETURNS", "THROWS", "AUTHORIZES"].includes(edge.type);
        }
        return true;
      }

      function findSearchMatches(allowedNodeIds) {
        if (!search) {
          return new Set();
        }
        return new Set(nodes.filter(function (node) {
          return allowedNodeIds.has(node.id) && searchableText(node).includes(search);
        }).map(function (node) { return node.id; }));
      }

      function selectFirstSearchMatch() {
        if (!search) {
          return;
        }
        var allowedNodeIds = new Set(nodes.filter(function (node) {
          return enabledTypes.has(node.type);
        }).map(function (node) { return node.id; }));
        var matches = nodes.filter(function (node) {
          return allowedNodeIds.has(node.id) && searchableText(node).includes(search);
        }).sort(function (left, right) {
          return searchRank(left).localeCompare(searchRank(right)) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
        });
        if (matches[0]) {
          selectedNodeId = matches[0].id;
          renderSelection(matches[0]);
          focusNode(matches[0]);
        } else {
          selectedNodeId = null;
          renderSelection(null);
        }
      }

      function searchRank(node) {
        var needle = search.toLowerCase();
        var name = node.name.toLowerCase();
        if (name === needle) {
          return "0";
        }
        if (name.startsWith(needle)) {
          return "1";
        }
        if (node.id.toLowerCase().includes(needle)) {
          return "2";
        }
        return "3";
      }

      function searchableText(node) {
        return [node.id, node.name, node.type, node.file || "", node.package || ""]
          .join(" ")
          .toLowerCase();
      }

      function collectNeighborhood(sourceIds, depth, allowedNodeIds) {
        var result = new Set(sourceIds);
        var frontier = Array.from(sourceIds);
        for (var step = 0; step < depth; step += 1) {
          var next = [];
          frontier.forEach(function (id) {
            edges.forEach(function (edge) {
              if (!enabledRelationships.has(edge.type)) {
                return;
              }
              if (edge.from === id && allowedNodeIds.has(edge.to) && !result.has(edge.to)) {
                result.add(edge.to);
                next.push(edge.to);
              }
              if (edge.to === id && allowedNodeIds.has(edge.from) && !result.has(edge.from)) {
                result.add(edge.from);
                next.push(edge.from);
              }
            });
          });
          frontier = next;
        }
        return result;
      }

      function traceNodeIds(rootId, allowedNodeIds) {
        var result = new Set([rootId]);
        var frontier = [rootId];
        var traceRelationships = new Set(["HANDLES", "CALLS", "USES", "INJECTS", "DEPENDS_ON", "READS", "WRITES", "CONFIGURES", "CONTAINS"]);
        for (var depth = 0; depth < 6; depth += 1) {
          var next = [];
          frontier.forEach(function (id) {
            edges.forEach(function (edge) {
              if (!traceRelationships.has(edge.type) || !enabledRelationships.has(edge.type)) {
                return;
              }
              if (edge.from === id && allowedNodeIds.has(edge.to) && !result.has(edge.to)) {
                result.add(edge.to);
                next.push(edge.to);
                highlightedEdgeIds.add(edge.id);
              }
            });
          });
          frontier = next;
        }
        return result;
      }

      function nodeClass(node) {
        var classes = ["node"];
        if (node.id === selectedNodeId) {
          classes.push("selected");
        }
        if (searchMatchIds.has(node.id)) {
          classes.push("match");
        } else if (relatedNodeIds.has(node.id)) {
          classes.push("related");
        }
        if ((selectedNodeId || search) && !relatedNodeIds.has(node.id) && node.id !== selectedNodeId && !searchMatchIds.has(node.id)) {
          classes.push("dimmed");
        }
        return classes.join(" ");
      }

      function edgeClass(edge) {
        var classes = ["edge"];
        if (highlightedEdgeIds.has(edge.id)) {
          classes.push("highlighted");
        } else if (selectedNodeId || search) {
          classes.push("dimmed");
        }
        return classes.join(" ");
      }

      function renderSelection(node) {
        if (!node) {
          document.getElementById("selection").replaceChildren(emptySelection());
          return;
        }
        var inbound = edges.filter(function (edge) { return edge.to === node.id; });
        var outbound = edges.filter(function (edge) { return edge.from === node.id; });
        var selection = document.getElementById("selection");
        selection.replaceChildren(
          detail("Name", node.name),
          detail("Type", node.type),
          detail("ID", node.id),
          detail("File", node.file || "none"),
          detail("Source", formatSpan(node.span)),
          detail("Package", node.package || "none"),
          detail("Incoming", String(inbound.length)),
          detail("Outgoing", String(outbound.length)),
          actionsFor(node),
          relatedBlock("Depends On", outbound.filter(isDependencyEdge), "to"),
          relatedBlock("Used By", inbound.filter(isDependencyEdge), "from"),
          relatedBlock("Callers", inbound.filter(function (edge) { return edge.type === "CALLS" || edge.type === "HANDLES"; }), "from"),
          relatedBlock("Callees", outbound.filter(function (edge) { return edge.type === "CALLS" || edge.type === "HANDLES"; }), "to"),
          relatedBlock("Contains", outbound.filter(function (edge) { return edge.type === "CONTAINS" || edge.type === "DECLARES" || edge.type === "PROVIDES"; }), "to"),
          metadataBlock(node.metadata)
        );
      }

      function emptySelection() {
        var paragraph = document.createElement("p");
        paragraph.textContent = "Search or select a node to inspect its graph identity, provenance, source location, and adjacent relationships.";
        return paragraph;
      }

      function actionsFor(node) {
        var wrapper = document.createElement("div");
        wrapper.className = "detail-actions";
        var focus = document.createElement("button");
        focus.type = "button";
        focus.textContent = "Focus";
        focus.addEventListener("click", function () {
          selectedNodeId = node.id;
          traceRootId = null;
          search = "";
          document.getElementById("search").value = "";
          if (!matchesMode(node)) {
            viewMode = "full";
            relayout();
            renderModeButtons();
          }
          focusNode(nodeById.get(node.id) || node);
          render();
        });
        var trace = document.createElement("button");
        trace.type = "button";
        trace.textContent = "Trace";
        trace.addEventListener("click", function () {
          selectedNodeId = node.id;
          traceRootId = node.id;
          search = "";
          document.getElementById("search").value = "";
          viewMode = "call";
          relayout();
          renderModeButtons();
          focusNode(nodeById.get(node.id) || node);
          render();
        });
        wrapper.append(focus, trace);
        return wrapper;
      }

      function relatedBlock(title, relationshipEdges, direction) {
        var block = document.createElement("div");
        block.className = "kv";
        var label = document.createElement("span");
        label.textContent = title;
        var list = document.createElement("ul");
        list.className = "relationship-list";
        relationshipEdges.slice(0, 8).forEach(function (edge) {
          var related = nodeById.get(direction === "to" ? edge.to : edge.from);
          if (!related) {
            return;
          }
          var item = document.createElement("li");
          var name = document.createElement("b");
          name.textContent = related.name;
          var meta = document.createElement("span");
          meta.textContent = edge.type + " - " + related.type + (edge.confidence ? " - " + edge.confidence : "");
          item.append(name, meta);
          list.append(item);
        });
        if (list.childNodes.length === 0) {
          var emptyItem = document.createElement("li");
          emptyItem.textContent = "none";
          list.append(emptyItem);
        }
        block.append(label, list);
        return block;
      }

      function isDependencyEdge(edge) {
        return ["DEPENDS_ON", "USES", "INJECTS", "IMPORTS", "READS", "CONFIGURES", "REFERENCES"].includes(edge.type);
      }

      function detail(label, value) {
        var item = document.createElement("div");
        item.className = "kv";
        var key = document.createElement("span");
        key.textContent = label;
        var body = document.createElement("strong");
        body.textContent = value;
        item.append(key, body);
        return item;
      }

      function metadataBlock(metadata) {
        var block = document.createElement("div");
        block.className = "kv";
        var label = document.createElement("span");
        label.textContent = "Metadata";
        var pre = document.createElement("pre");
        pre.textContent = metadata ? JSON.stringify(metadata, null, 2) : "none";
        block.append(label, pre);
        return block;
      }

      function renderSummary() {
        var summary = document.getElementById("summary");
        var topNodeTypes = topEntries(payload.stats.nodeTypes, 5);
        var topRelationships = topEntries(payload.stats.relationships, 5);
        var hub = largestHub();
        var routeCount = payload.stats.nodeTypes.Route || 0;
        var serviceCount = payload.stats.nodeTypes.Service || 0;
        var moduleCount = payload.stats.nodeTypes.Module || 0;
        var environmentCount = payload.stats.nodeTypes.EnvironmentVariable || 0;
        var diagnostics = [
          "This graph contains " + formatNumber(payload.nodes.length) + " nodes and " + formatNumber(payload.edges.length) + " edges.",
          formatNumber(moduleCount) + " modules, " + formatNumber(serviceCount) + " services, " + formatNumber(routeCount) + " routes, and " + formatNumber(environmentCount) + " environment variables are present in the current artifact.",
          hub ? "The largest dependency hub is " + hub.node.name + " (" + hub.node.type + ") with " + formatNumber(hub.degree) + " adjacent relationships." : "No dependency hub was found.",
          "Top node types: " + topNodeTypes.join(", "),
          "Top relationships: " + topRelationships.join(", ")
        ];

        var title = document.createElement("strong");
        title.textContent = "Deterministic graph summary";
        var list = document.createElement("ul");
        list.className = "summary-list";
        diagnostics.forEach(function (line) {
          var item = document.createElement("li");
          item.textContent = line;
          list.append(item);
        });
        summary.replaceChildren(title, list);
      }

      function largestHub() {
        var degrees = new Map();
        edges.forEach(function (edge) {
          degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
          degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
        });
        var best = null;
        degrees.forEach(function (degree, id) {
          var node = nodeById.get(id);
          if (!node) {
            return;
          }
          if (!best || degree > best.degree || (degree === best.degree && node.id.localeCompare(best.node.id) < 0)) {
            best = { node: node, degree: degree };
          }
        });
        return best;
      }

      function topEntries(counts, limit) {
        return Object.entries(counts)
          .sort(function (left, right) { return right[1] - left[1] || left[0].localeCompare(right[0]); })
          .slice(0, limit)
          .map(function (entry) { return entry[0] + " " + formatNumber(entry[1]); });
      }

      function renderMinimap(visibleNodes, visibleEdges) {
        miniEdgeLayer.replaceChildren();
        miniNodeLayer.replaceChildren();
        if (visibleNodes.length === 0) {
          miniViewport.setAttribute("width", "0");
          miniViewport.setAttribute("height", "0");
          return;
        }

        var bounds = graphBounds(visibleNodes);
        var scale = Math.min(160 / Math.max(bounds.width, 1), 104 / Math.max(bounds.height, 1));
        var offsetX = 10 - bounds.minX * scale + (160 - bounds.width * scale) / 2;
        var offsetY = 10 - bounds.minY * scale + (104 - bounds.height * scale) / 2;

        visibleEdges.slice(0, 900).forEach(function (edge) {
          var from = nodeById.get(edge.from);
          var to = nodeById.get(edge.to);
          if (!from || !to) {
            return;
          }
          miniEdgeLayer.append(svgElement("line", {
            class: "mini-edge",
            x1: from.x * scale + offsetX,
            y1: from.y * scale + offsetY,
            x2: to.x * scale + offsetX,
            y2: to.y * scale + offsetY
          }));
        });

        visibleNodes.slice(0, 1200).forEach(function (node) {
          miniNodeLayer.append(svgElement("circle", {
            class: "mini-node",
            cx: node.x * scale + offsetX,
            cy: node.y * scale + offsetY,
            r: visibleNodes.length > 500 ? 1.1 : 1.8
          }));
        });

        var box = svg.getBoundingClientRect();
        var viewportX = (-transform.x / transform.scale) * scale + offsetX;
        var viewportY = (-transform.y / transform.scale) * scale + offsetY;
        var viewportWidth = (box.width / transform.scale) * scale;
        var viewportHeight = (box.height / transform.scale) * scale;
        miniViewport.setAttribute("x", String(Math.max(0, viewportX)));
        miniViewport.setAttribute("y", String(Math.max(0, viewportY)));
        miniViewport.setAttribute("width", String(Math.min(180, viewportWidth)));
        miniViewport.setAttribute("height", String(Math.min(124, viewportHeight)));
      }

      function graphBounds(visibleNodes) {
        var xs = visibleNodes.map(function (node) { return node.x; });
        var ys = visibleNodes.map(function (node) { return node.y; });
        var minX = Math.min.apply(null, xs);
        var maxX = Math.max.apply(null, xs);
        var minY = Math.min.apply(null, ys);
        var maxY = Math.max.apply(null, ys);
        return {
          minX: minX,
          minY: minY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY)
        };
      }

      function focusNode(node) {
        var box = svg.getBoundingClientRect();
        transform.x = box.width / 2 - node.x * transform.scale;
        transform.y = box.height / 2 - node.y * transform.scale;
        updateTransform();
      }

      function formatSpan(span) {
        if (!span) {
          return "none";
        }
        return span.file + ":" + span.startLine + ":" + span.startColumn;
      }

      function formatNumber(value) {
        return Number(value).toLocaleString("en-US");
      }

      function nodeTypeGroup(value) {
        if (["Workspace", "Application", "Package", "Module", "Framework", "Controller", "Route", "Service", "Provider", "Repository"].includes(value)) {
          return "Application";
        }
        if (["Configuration", "EnvironmentVariable", "Dependency", "DatabaseTable", "Container", "Workflow", "Job", "Step", "Task", "Pipeline", "BuildTarget"].includes(value)) {
          return "Infrastructure";
        }
        if (["Function", "Method", "Class", "Interface", "TypeAlias", "Enum", "Namespace", "Import", "Export", "Field"].includes(value)) {
          return "Language";
        }
        return "Runtime";
      }

      function groupSort(left, right) {
        var order = ["Application", "Infrastructure", "Language", "Runtime"];
        return order.indexOf(left) - order.indexOf(right) || left.localeCompare(right);
      }

      function hasArchitectureNodes(inputNodes) {
        return inputNodes.some(function (node) {
          return ["Workspace", "Application", "Package", "Module", "Controller", "Route", "Service", "Provider", "Repository"].includes(node.type);
        });
      }

      function onPointerDown(event) {
        var nodeElement = event.target.closest ? event.target.closest(".node") : null;
        lastPointer = { x: event.clientX, y: event.clientY };
        if (nodeElement) {
          draggingNode = nodeById.get(nodeElement.getAttribute("data-node-id"));
        } else {
          draggingCanvas = true;
        }
        svg.setPointerCapture(event.pointerId);
      }

      function onPointerMove(event) {
        if (!lastPointer) {
          return;
        }
        var dx = event.clientX - lastPointer.x;
        var dy = event.clientY - lastPointer.y;
        lastPointer = { x: event.clientX, y: event.clientY };
        if (draggingNode) {
          draggingNode.x += dx / transform.scale;
          draggingNode.y += dy / transform.scale;
          render();
          return;
        }
        if (draggingCanvas) {
          transform.x += dx;
          transform.y += dy;
          updateTransform();
        }
      }

      function onPointerUp(event) {
        draggingNode = null;
        draggingCanvas = null;
        lastPointer = null;
        if (svg.hasPointerCapture(event.pointerId)) {
          svg.releasePointerCapture(event.pointerId);
        }
      }

      function onWheel(event) {
        event.preventDefault();
        zoom(event.deltaY > 0 ? 0.9 : 1.1);
      }

      function zoom(factor) {
        transform.scale = Math.max(0.2, Math.min(4, transform.scale * factor));
        updateTransform();
      }

      function resetView() {
        var box = svg.getBoundingClientRect();
        transform = { x: box.width / 2, y: box.height / 2, scale: 1 };
        updateTransform();
      }

      function updateTransform() {
        viewport.setAttribute("transform", "translate(" + transform.x + " " + transform.y + ") scale(" + transform.scale + ")");
        if (lastVisibleNodes.length > 0) {
          renderMinimap(lastVisibleNodes, lastVisibleEdges);
        }
      }

      function compactLabel(value) {
        return value.length > 28 ? value.slice(0, 25) + "..." : value;
      }

      function colorFor(value) {
        var hash = 0;
        for (var index = 0; index < value.length; index += 1) {
          hash = (hash + value.charCodeAt(index) * (index + 1)) % palette.length;
        }
        return palette[hash];
      }

      function svgElement(name, attributes) {
        var element = document.createElementNS("http://www.w3.org/2000/svg", name);
        Object.entries(attributes).forEach(function (entry) {
          element.setAttribute(entry[0], String(entry[1]));
        });
        return element;
      }
    })();
  </script>
</body>
</html>
`;
}

function normalizeLimit(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeScriptJson(value: string): string {
  return value
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
