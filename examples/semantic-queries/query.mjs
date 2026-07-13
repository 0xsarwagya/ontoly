import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSoftwareGraph, createRepositoryIntelligencePass } from "../../packages/compiler/dist/index.js";
import { createTypeScriptFrontendPass } from "../../packages/parser-typescript/dist/index.js";
import { createOpenApiFrontendPass } from "../../packages/parser-openapi/dist/index.js";
import { createQueryEngine } from "../../packages/query/dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../typescript-library");
const graph = await buildSoftwareGraph({
  root,
  passes: [
    createRepositoryIntelligencePass(),
    createTypeScriptFrontendPass(),
    createOpenApiFrontendPass(),
  ],
});
const query = createQueryEngine(graph);

process.stdout.write(`${JSON.stringify({
  repository: graph.repository.name,
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  functions: query.findNodes({ type: "Function" }).map((node) => node.name),
}, null, 2)}\n`);
