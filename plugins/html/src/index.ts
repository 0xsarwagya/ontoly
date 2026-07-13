import type {
  JsonObject,
  NodeType,
  OntolyPlugin,
  PluginArtifact,
  RelationshipType,
  SoftwareGraph,
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
  readonly metadata?: JsonObject | undefined;
}

interface HtmlGraphEdge {
  readonly id: string;
  readonly type: RelationshipType;
  readonly from: string;
  readonly to: string;
  readonly confidence?: string | undefined;
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
    version: "0.1.0-alpha.2",
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
    metadata: node.metadata,
  }));
  const edges = visibleEdges.map((edge): HtmlGraphEdge => ({
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
    confidence: edge.evidence?.[0]?.confidence,
  }));

  return {
    title: options.title ?? `${graph.repository.name} Software Graph`,
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
    }

    button:hover {
      border-color: var(--accent);
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
          <h1>${title}</h1>
          <p id="repository"></p>
          <p id="hash"></p>
        </div>
        <div class="stat-grid">
          <div class="stat"><strong id="visible-nodes">0</strong><span>visible nodes</span></div>
          <div class="stat"><strong id="visible-edges">0</strong><span>visible edges</span></div>
        </div>
        <label>
          Search
          <input id="search" type="search" placeholder="Filter by name, id, file, or type">
        </label>
        <section>
          <h2>Node Types</h2>
          <div id="node-type-filters" class="checks"></div>
        </section>
        <section>
          <h2>Relationships</h2>
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
      var nodes = layoutNodes(payload.nodes, payload.edges);
      var nodeById = new Map(nodes.map(function (node) { return [node.id, node]; }));
      var edges = payload.edges.filter(function (edge) { return nodeById.has(edge.from) && nodeById.has(edge.to); });
      var enabledTypes = new Set(payload.filters.nodeTypes);
      var enabledRelationships = new Set(payload.filters.relationships);
      var selectedNodeId = null;
      var search = "";
      var transform = { x: 0, y: 0, scale: 1 };
      var draggingNode = null;
      var draggingCanvas = null;
      var lastPointer = null;

      var svg = document.getElementById("graph");
      var viewport = document.getElementById("viewport");
      var edgeLayer = document.getElementById("edges");
      var edgeLabelLayer = document.getElementById("edge-labels");
      var nodeLayer = document.getElementById("nodes");
      var empty = document.getElementById("empty");

      document.getElementById("repository").textContent = payload.repository.name + " - " + payload.repository.root;
      document.getElementById("hash").textContent = "Graph hash: " + payload.hash;
      document.getElementById("search").addEventListener("input", function (event) {
        search = event.target.value.trim().toLowerCase();
        render();
      });
      document.getElementById("zoom-in").addEventListener("click", function () { zoom(1.18); });
      document.getElementById("zoom-out").addEventListener("click", function () { zoom(1 / 1.18); });
      document.getElementById("reset").addEventListener("click", resetView);

      createChecks("node-type-filters", payload.filters.nodeTypes, enabledTypes, render);
      createChecks("relationship-filters", payload.filters.relationships, enabledRelationships, render);
      svg.addEventListener("wheel", onWheel, { passive: false });
      svg.addEventListener("pointerdown", onPointerDown);
      svg.addEventListener("pointermove", onPointerMove);
      svg.addEventListener("pointerup", onPointerUp);
      svg.addEventListener("pointercancel", onPointerUp);
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
            onChange();
          });
          label.append(name, input);
          container.append(label);
        });
      }

      function render() {
        var visibleNodes = nodes.filter(matchesNode);
        var visibleNodeIds = new Set(visibleNodes.map(function (node) { return node.id; }));
        var visibleEdges = edges.filter(function (edge) {
          return enabledRelationships.has(edge.type) && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
        });
        var showNodeLabels = visibleNodes.length <= 180;
        var showEdgeLabels = visibleEdges.length <= 250;
        var nodeRadius = radiusFor(visibleNodes.length);

        document.getElementById("visible-nodes").textContent = String(visibleNodes.length);
        document.getElementById("visible-edges").textContent = String(visibleEdges.length);
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
            class: "edge",
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
            class: "node" + (node.id === selectedNodeId ? " selected" : ""),
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

        updateTransform();
      }

      function layoutNodes(inputNodes, inputEdges) {
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

      function matchesNode(node) {
        if (!enabledTypes.has(node.type)) {
          return false;
        }
        if (!search) {
          return true;
        }
        return [node.id, node.name, node.type, node.file || "", node.package || ""]
          .join(" ")
          .toLowerCase()
          .includes(search);
      }

      function renderSelection(node) {
        var inbound = edges.filter(function (edge) { return edge.to === node.id; });
        var outbound = edges.filter(function (edge) { return edge.from === node.id; });
        var selection = document.getElementById("selection");
        selection.replaceChildren(
          detail("Name", node.name),
          detail("Type", node.type),
          detail("ID", node.id),
          detail("File", node.file || "none"),
          detail("Package", node.package || "none"),
          detail("Incoming", String(inbound.length)),
          detail("Outgoing", String(outbound.length)),
          metadataBlock(node.metadata)
        );
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
