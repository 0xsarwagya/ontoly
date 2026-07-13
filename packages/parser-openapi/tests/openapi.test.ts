import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSoftwareGraphWithArtifacts } from "@0xsarwagya/ontoly-compiler";
import { createOpenApiFrontendPass } from "../src/index";

describe("openapi frontend", () => {
  it("emits deterministic API graph facts from JSON OpenAPI documents", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-openapi-"));
    await writeFile(
      join(root, "openapi.json"),
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Users API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              operationId: "listUsers",
              tags: ["users"],
              parameters: [{ name: "limit", in: "query", required: false }],
              security: [{ bearerAuth: [] }],
              responses: {
                "200": {
                  description: "ok",
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: "object",
              required: ["id"],
              properties: {
                id: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
      }, null, 2),
      "utf8",
    );

    const result = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [createOpenApiFrontendPass()],
    });
    const graph = result.graph;

    expect(result.status).toBe("success");
    expect(graph?.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      "config:openapi.json:openapi",
      "route:GET:/users",
      "op:openapi.json:listUsers",
      "model:User",
      "field:openapi.json:User.id",
      "resource:users",
      "permission:bearerAuth",
    ]));
    expect(graph?.edges.map((edge) => ({
      type: edge.type,
      from: edge.from,
      to: edge.to,
    }))).toEqual(expect.arrayContaining([
      {
        type: "HANDLES",
        from: "route:GET:/users",
        to: "op:openapi.json:listUsers",
      },
      {
        type: "REFERENCES",
        from: "op:openapi.json:listUsers",
        to: "model:User",
      },
      {
        type: "AUTHORIZES",
        from: "permission:bearerAuth",
        to: "op:openapi.json:listUsers",
      },
    ]));
  });
});
