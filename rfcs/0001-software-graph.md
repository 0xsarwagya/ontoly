# RFC 0001: Software Graph Specification

## Status

Draft

## Spec Version

Software Graph Spec 1.0

## Summary

This RFC defines Software Graph v1, the stable interchange contract for
Ontoly parsers, the compiler, the query engine, diagnostics, plugins, MCP
integrations, documentation tools, visualization tools, and future SDK
generators.

The Software Graph is an intermediate representation for software. It is
not optimized for a single parser or the current implementation. It is
designed to behave like LLVM IR or the TypeScript Compiler API: small
enough to be implemented reliably, stable enough for downstream tools to
build on, and explicit enough that every relationship can be explained.

## Normative Language

The words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as
defined by RFC 2119.

## Design Goals

1. **Stable contract.** The graph schema MUST be versioned independently
   from Ontoly package versions.
2. **Determinism.** Equivalent repository input and parser configuration
   MUST produce equivalent graph content, stable identifiers, and stable
   content hashes.
3. **Explainability.** Every edge and diagnostic SHOULD include provenance
   sufficient to explain why it exists.
4. **Parser neutrality.** TypeScript is the first parser, not the schema's
   center. OpenAPI, GraphQL, Prisma, SQL, and other parsers MUST be able to
   emit the same graph model.
5. **Graph-native diagnostics.** Diagnostics MUST refer to graph nodes,
   graph edges, and source locations using shared structures, not
   parser-specific formats.
6. **Safe extensibility.** Plugins and parsers MUST be able to attach
   namespaced metadata without changing the core schema.
7. **Interoperability.** JSON serialization MUST support persistence, graph
   diffing, incremental compilation, plugin interoperability, and MCP.
8. **Validation.** An engineer unfamiliar with Ontoly compiler internals
   MUST be able to implement a serializer and validator from this RFC.

## Non-Goals

Software Graph v1 does not define:

- Binary serialization.
- A query language.
- Vector search or embedding storage.
- AI reasoning, prompting, or generation behavior.
- Source formatting or code modification behavior.
- Runtime tracing or observability event formats.
- A database storage engine.
- A plugin execution protocol.
- Complete language-specific AST representations.

The graph may represent facts useful to these systems, but those systems
are consumers, not part of the graph specification.

## Core Terminology

### Software Graph

A versioned, deterministic graph document containing nodes, edges,
diagnostics, metadata, optional derived indexes, and namespaced extensions.

### Node

A typed entity in software. Examples include functions, classes, modules,
routes, models, packages, services, and configuration entries.

### Edge

A typed directed relationship between two nodes. Examples include CALLS,
IMPORTS, IMPLEMENTS, RETURNS, and AUTHORIZES.

### Source

The repository artifact from which a graph fact was derived. A source is
usually a file, but may also be a package manifest, schema document, config
file, generated artifact, or plugin artifact.

### Provenance

Evidence explaining where a graph fact came from and how confidently the
producer can assert it.

### Producer

The tool that emitted a graph, node, edge, diagnostic, or extension. A
producer may be an Ontoly parser, compiler stage, plugin, or external
adapter.

### Core Schema

The fields and values defined by this RFC. Core consumers MUST NOT require
extension metadata to validate or interpret the core schema.

### Extension

Namespaced JSON metadata attached to graphs, nodes, edges, diagnostics, or
provenance records.

## Base Data Types

### JsonValue

All serialized values MUST be JSON values:

```ts
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

type JsonObject = {
  [key: string]: JsonValue;
};
```

Objects MUST NOT contain `undefined`, functions, symbols, bigint values,
cyclic references, or non-finite numbers.

### SourceRef

`SourceRef` identifies an artifact that contributed to the graph.

```ts
interface SourceRef {
  kind: "file" | "package" | "schema" | "config" | "generated" | "virtual";
  path?: string;
  uri?: string;
  language?: string;
  digest?: string;
}
```

Rules:

- `path` MUST be repository-relative when the source is inside the
  repository.
- Paths MUST use `/` separators.
- Absolute local paths MUST NOT appear in canonical graph content.
- `digest`, when present, SHOULD be `sha256:<hex>`.
- `uri` MAY identify external sources such as package registries or remote
  schema documents.

### SourceRange

`SourceRange` identifies a range inside a source artifact.

```ts
interface SourceRange {
  source: SourceRef;
  start: SourcePosition;
  end: SourcePosition;
}

interface SourcePosition {
  line: number;
  column: number;
  offset?: number;
}
```

Rules:

- `line` and `column` are one-based.
- `end` MUST be greater than or equal to `start`.
- `offset`, when present, is zero-based UTF-16 code unit offset unless a
  source extension declares another encoding.

### ExtensionMap

Extensions are namespaced JSON objects.

```ts
type ExtensionMap = {
  [namespace: string]: JsonValue;
};
```

Rules:

- Extension namespaces MUST be globally unique.
- NPM package names are RECOMMENDED, for example
  `@0xsarwagya/ontoly-parser-typescript`.
- Reverse-DNS names are allowed, for example `com.example.security`.
- Extension fields MUST NOT change the meaning of core fields.
- Core validators MAY ignore extensions.

### Provenance

Provenance explains why a graph fact exists.

```ts
interface Provenance {
  kind:
    | "syntax"
    | "type-checker"
    | "schema"
    | "config"
    | "convention"
    | "resolver"
    | "plugin"
    | "manual";
  producer: ProducerRef;
  source?: SourceRef;
  range?: SourceRange;
  confidence: Confidence;
  explanation?: string;
  extensions?: ExtensionMap;
}

interface ProducerRef {
  name: string;
  version: string;
}

type Confidence = "exact" | "resolved" | "inferred" | "low";
```

Confidence rules:

- `exact` means the fact is directly present in source or configuration.
- `resolved` means the fact was produced by deterministic name, type,
  schema, or module resolution.
- `inferred` means the fact was produced by deterministic convention or
  heuristic.
- `low` means the producer could not establish enough evidence for a
  stronger confidence level.
- `inferred` and `low` provenance records MUST include `explanation`.

## Graph Model

The canonical Software Graph document has this shape:

```ts
interface SoftwareGraph {
  specVersion: "1.0.0";
  graphId: string;
  repository: RepositoryDescriptor;
  nodes: SoftwareNode[];
  edges: SoftwareEdge[];
  diagnostics: Diagnostic[];
  metadata: GraphMetadata;
  indexes?: GraphIndexes;
  extensions?: ExtensionMap;
}
```

### RepositoryDescriptor

```ts
interface RepositoryDescriptor {
  id: string;
  name: string;
  root?: string;
  vcs?: {
    type: "git" | "none" | "unknown";
    revision?: string;
    branch?: string;
    remote?: string;
  };
  packageManager?: string;
  workspace?: {
    kind: "single-package" | "workspace" | "monorepo";
    packages?: string[];
  };
  extensions?: ExtensionMap;
}
```

Rules:

- `repository.id` SHOULD use `repo:<stable-name>`.
- `repository.root`, when present, MUST be repository-relative or a logical
  root name. Absolute local paths MUST NOT be part of canonical graph
  content.
- VCS information is metadata and MUST NOT be required to interpret nodes
  or edges.

### Graph Invariants

A valid Software Graph MUST satisfy:

- `specVersion` is a supported Software Graph spec version.
- `graphId` is the deterministic content hash of the canonical graph
  content as defined in Serialization.
- Node IDs are unique.
- Edge IDs are unique.
- Every edge `from` and `to` references an existing node.
- Diagnostics reference existing nodes or edges when graph references are
  present.
- Core fields use only values defined by this RFC.
- Optional indexes, if present, match the nodes and edges.
- Extensions do not shadow or redefine core fields.

## Node Model

All nodes share the same envelope:

```ts
interface SoftwareNode {
  id: NodeId;
  type: NodeType;
  name: string;
  qualifiedName?: string;
  description?: string;
  language?: string;
  location?: SourceRange;
  package?: NodeId;
  aliases?: NodeAlias[];
  attributes?: JsonObject;
  provenance: Provenance[];
  extensions?: ExtensionMap;
}

interface NodeAlias {
  id: NodeId;
  reason: "moved" | "renamed" | "reexported" | "legacy" | "generated";
}
```

Common required fields:

- `id`
- `type`
- `name`
- `provenance`

Common optional fields:

- `qualifiedName`
- `description`
- `language`
- `location`
- `package`
- `aliases`
- `attributes`
- `extensions`

Common invariants:

- `id` MUST follow the Stable Identifiers section.
- `type` MUST be one of the canonical node types or an extension node type
  declared by a namespace.
- `name` MUST be human-readable and SHOULD be stable.
- `qualifiedName`, when present, MUST be deterministic within its package
  or module context.
- `package`, when present, MUST reference a Package node.
- `provenance` MUST contain at least one record unless the node is a
  synthetic root node declared by graph metadata.
- `attributes` MUST contain only core attributes documented for the node
  type. Parser-specific data belongs in `extensions`.

## Canonical Node Types

### Repository

Represents a source repository or logical project root.

Required fields:

- Common node fields.
- `id` with `repo` prefix.
- `name`.

Optional metadata:

- `vcsType`
- `defaultBranch`
- `workspaceKind`

Invariants:

- A graph SHOULD contain exactly one primary Repository node.
- A Repository node SHOULD CONTAIN Package or Module nodes.
- Repository nodes MUST NOT have a `package` field.

Example:

```json
{
  "id": "repo:github.com/0xsarwagya/ontoly",
  "type": "Repository",
  "name": "ontoly",
  "provenance": [
    {
      "kind": "config",
      "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
      "confidence": "exact"
    }
  ]
}
```

### Package

Represents a package, workspace member, library, application, or external
dependency package.

Required fields:

- Common node fields.
- `id` with `pkg` prefix.
- `name`.

Optional metadata:

- `version`
- `private`
- `manager`
- `entrypoints`
- `external`

Invariants:

- Internal packages SHOULD BELONG_TO or be CONTAINED by a Repository node.
- External package nodes SHOULD set `attributes.external` to `true`.

Example:

```json
{
  "id": "pkg:@0xsarwagya/ontoly-core",
  "type": "Package",
  "name": "@0xsarwagya/ontoly-core",
  "attributes": { "version": "0.1.0", "private": false },
  "provenance": [
    {
      "kind": "config",
      "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
      "source": { "kind": "package", "path": "packages/core/package.json" },
      "confidence": "exact"
    }
  ]
}
```

### Module

Represents a source module, compilation unit, schema document, or logical
module.

Required fields:

- Common node fields.
- `id` with `mod` prefix.
- `name`.

Optional metadata:

- `format`: `esm`, `commonjs`, `script`, `schema`, or `unknown`.
- `entrypoint`
- `generated`

Invariants:

- Source-file modules SHOULD include `location.source.path`.
- Module IDs MUST NOT use absolute file paths.
- Module nodes SHOULD contain declarations defined in the module.

Example:

```json
{
  "id": "mod:src/auth/service.ts",
  "type": "Module",
  "name": "src/auth/service.ts",
  "language": "typescript",
  "location": {
    "source": { "kind": "file", "path": "src/auth/service.ts", "language": "typescript" },
    "start": { "line": 1, "column": 1 },
    "end": { "line": 120, "column": 1 }
  },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "confidence": "exact"
    }
  ]
}
```

### Namespace

Represents a language namespace or logical grouping that owns symbols.

Required fields:

- Common node fields.
- `id` with `ns` prefix.
- `name`.

Optional metadata:

- `declarationKind`
- `ambient`

Invariants:

- Namespaces SHOULD be CONTAINED by a Module or another Namespace.
- Namespaces MAY contain Function, Class, Interface, TypeAlias, Enum, and
  other Namespace nodes.

Example:

```json
{
  "id": "ns:src/sdk.ts:Ontoly",
  "type": "Namespace",
  "name": "Ontoly",
  "qualifiedName": "Ontoly",
  "language": "typescript",
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/sdk.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Function

Represents a named callable declaration that is not owned by a class
instance.

Required fields:

- Common node fields.
- `id` with `fn` prefix.
- `name`.

Optional metadata:

- `signature`
- `parameters`
- `returnType`
- `async`
- `generator`
- `visibility`
- `exported`
- `purity`

Invariants:

- A Function SHOULD be CONTAINED by a Module, Namespace, Operation,
  Middleware, or Service.
- Anonymous functions MAY be represented only when a stable name can be
  derived from an assignment, export, route handler, or parent symbol.
- Function IDs SHOULD NOT depend on line numbers unless no stable anchor
  exists. Line-based IDs MUST be marked with `attributes.stability:
  "ephemeral"`.

Example:

```json
{
  "id": "fn:src/auth/service.ts:login",
  "type": "Function",
  "name": "login",
  "qualifiedName": "login",
  "language": "typescript",
  "attributes": {
    "signature": "login(input: LoginInput): Promise<User>",
    "async": true,
    "exported": true
  },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/auth/service.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Method

Represents a callable declaration owned by a Class, Interface, Model,
Service, Resource, or Operation.

Required fields:

- Common node fields.
- `id` with `method` prefix.
- `name`.

Optional metadata:

- `owner`
- `signature`
- `parameters`
- `returnType`
- `async`
- `generator`
- `static`
- `abstract`
- `visibility`

Invariants:

- A Method SHOULD be CONTAINED by its owner node.
- `attributes.owner`, when present, MUST reference the owning node ID.
- The direction of CONTAINS is owner to method.

Example:

```json
{
  "id": "method:src/users/service.ts:UserService.findById",
  "type": "Method",
  "name": "findById",
  "qualifiedName": "UserService.findById",
  "attributes": {
    "owner": "class:src/users/service.ts:UserService",
    "async": true,
    "visibility": "public"
  },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/users/service.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Class

Represents a class declaration or equivalent nominal object type.

Required fields:

- Common node fields.
- `id` with `class` prefix.
- `name`.

Optional metadata:

- `abstract`
- `exported`
- `visibility`
- `decorators`

Invariants:

- A Class SHOULD be CONTAINED by a Module or Namespace.
- EXTENDS edges MUST point from the subclass to the superclass.
- IMPLEMENTS edges MUST point from the class to the interface or contract.

Example:

```json
{
  "id": "class:src/users/service.ts:UserService",
  "type": "Class",
  "name": "UserService",
  "qualifiedName": "UserService",
  "attributes": { "exported": true },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/users/service.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Interface

Represents a structural or nominal contract.

Required fields:

- Common node fields.
- `id` with `iface` prefix.
- `name`.

Optional metadata:

- `exported`
- `genericParameters`
- `ambient`

Invariants:

- Interface nodes MAY contain Field and Method nodes.
- EXTENDS edges between interfaces point from child interface to parent
  interface.
- IMPLEMENTS edges from classes point to Interface nodes.

Example:

```json
{
  "id": "iface:src/auth/types.ts:SessionStore",
  "type": "Interface",
  "name": "SessionStore",
  "attributes": { "exported": true },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/auth/types.ts" },
      "confidence": "exact"
    }
  ]
}
```

### TypeAlias

Represents a named alias for a type expression.

Required fields:

- Common node fields.
- `id` with `type` prefix.
- `name`.

Optional metadata:

- `definition`
- `genericParameters`
- `exported`

Invariants:

- TypeAlias nodes SHOULD use REFERENCES edges for named types inside the
  aliased expression.
- A TypeAlias node MAY be treated as a Model by consumers only when its
  attributes or relationships indicate data-shape semantics.

Example:

```json
{
  "id": "type:src/auth/types.ts:LoginResult",
  "type": "TypeAlias",
  "name": "LoginResult",
  "attributes": {
    "definition": "{ ok: true; user: User } | { ok: false; reason: string }"
  },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/auth/types.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Enum

Represents a named finite set of values.

Required fields:

- Common node fields.
- `id` with `enum` prefix.
- `name`.

Optional metadata:

- `members`
- `exported`
- `const`

Invariants:

- Enum members MAY be represented as Field nodes when downstream tools need
  member-level references.
- Enum node `attributes.members` SHOULD preserve declaration order when
  present.

Example:

```json
{
  "id": "enum:src/auth/role.ts:Role",
  "type": "Enum",
  "name": "Role",
  "attributes": { "members": ["Admin", "User"] },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/auth/role.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Model

Represents a data shape used by APIs, schemas, database entities, or domain
types.

Required fields:

- Common node fields.
- `id` with `model` prefix.
- `name`.

Optional metadata:

- `sourceKind`: `typescript`, `openapi`, `graphql`, `prisma`, `sql`,
  `json-schema`, or `unknown`.
- `schemaName`
- `exported`

Invariants:

- A Model SHOULD contain Field nodes when fields are known.
- Model nodes SHOULD be used for data shapes, not arbitrary TypeScript
  aliases unless data-shape semantics are established.

Example:

```json
{
  "id": "model:User",
  "type": "Model",
  "name": "User",
  "attributes": { "sourceKind": "openapi", "schemaName": "User" },
  "provenance": [
    {
      "kind": "schema",
      "producer": { "name": "@0xsarwagya/ontoly-parser-openapi", "version": "0.1.0" },
      "source": { "kind": "schema", "path": "openapi.yaml" },
      "confidence": "exact"
    }
  ]
}
```

### Field

Represents a property, member, column, schema field, or configuration field
owned by another node.

Required fields:

- Common node fields.
- `id` with `field` prefix.
- `name`.

Optional metadata:

- `owner`
- `dataType`
- `required`
- `readonly`
- `nullable`
- `defaultValue`
- `visibility`

Invariants:

- A Field SHOULD be CONTAINED by a Model, Interface, Class, Enum,
  Configuration, Resource, or Operation.
- `attributes.owner`, when present, MUST reference the owning node.

Example:

```json
{
  "id": "field:model:User:email",
  "type": "Field",
  "name": "email",
  "attributes": {
    "owner": "model:User",
    "dataType": "string",
    "required": true
  },
  "provenance": [
    {
      "kind": "schema",
      "producer": { "name": "@0xsarwagya/ontoly-parser-openapi", "version": "0.1.0" },
      "source": { "kind": "schema", "path": "openapi.yaml" },
      "confidence": "exact"
    }
  ]
}
```

### Route

Represents an externally addressable endpoint route.

Required fields:

- Common node fields.
- `id` with `route` prefix.
- `name`.
- `attributes.method`.
- `attributes.path`.

Optional metadata:

- `protocol`: `http`, `websocket`, `rpc`, `event`, or `unknown`.
- `summary`
- `authenticated`

Invariants:

- Route IDs SHOULD use `route:<METHOD>:<path>`.
- Route nodes SHOULD be EXPOSED by a Module, Resource, Operation, or
  Service.
- Route nodes SHOULD connect to handlers using CALLS, ROUTES_TO if added in
  a future spec, or REFERENCES when the relationship is declarative only.

Example:

```json
{
  "id": "route:POST:/login",
  "type": "Route",
  "name": "POST /login",
  "attributes": { "method": "POST", "path": "/login", "protocol": "http" },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/server/routes.ts" },
      "confidence": "resolved"
    }
  ]
}
```

### Resource

Represents a grouped API, domain, infrastructure, or external resource.

Required fields:

- Common node fields.
- `id` with `resource` prefix.
- `name`.

Optional metadata:

- `resourceKind`: `http`, `database`, `queue`, `bucket`, `cache`,
  `external-api`, `domain`, or `unknown`.
- `external`

Invariants:

- Resources MAY contain Route, Operation, Model, Field, Permission, and
  Event nodes.
- A Resource SHOULD represent a stable conceptual boundary, not a transient
  implementation detail.

Example:

```json
{
  "id": "resource:Auth",
  "type": "Resource",
  "name": "Auth",
  "attributes": { "resourceKind": "domain" },
  "provenance": [
    {
      "kind": "convention",
      "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
      "confidence": "inferred",
      "explanation": "Derived from route and module grouping."
    }
  ]
}
```

### Operation

Represents a named action, API operation, RPC method, resolver, job, command,
or use-case action.

Required fields:

- Common node fields.
- `id` with `op` prefix.
- `name`.

Optional metadata:

- `operationId`
- `operationKind`: `http`, `rpc`, `graphql-resolver`, `job`, `command`,
  `query`, `mutation`, or `unknown`.
- `input`
- `output`

Invariants:

- Operations MAY be linked to Routes, Functions, Methods, Models, and
  Permissions.
- Operation nodes SHOULD be used when the action exists independently from
  one implementation function.

Example:

```json
{
  "id": "op:login",
  "type": "Operation",
  "name": "login",
  "attributes": { "operationKind": "http", "operationId": "login" },
  "provenance": [
    {
      "kind": "schema",
      "producer": { "name": "@0xsarwagya/ontoly-parser-openapi", "version": "0.1.0" },
      "source": { "kind": "schema", "path": "openapi.yaml" },
      "confidence": "exact"
    }
  ]
}
```

### Service

Represents a service boundary, component, or application-layer unit that
owns operations or behavior.

Required fields:

- Common node fields.
- `id` with `service` prefix.
- `name`.

Optional metadata:

- `serviceKind`: `class`, `module`, `process`, `external`, `domain`, or
  `unknown`.
- `external`

Invariants:

- A Service MAY contain Class, Function, Method, Operation, Middleware, and
  Configuration nodes.
- Service nodes SHOULD describe architectural boundaries, not every class
  whose name ends with "Service" unless that convention is intentionally
  configured.

Example:

```json
{
  "id": "service:AuthService",
  "type": "Service",
  "name": "AuthService",
  "attributes": { "serviceKind": "class" },
  "provenance": [
    {
      "kind": "convention",
      "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
      "confidence": "inferred",
      "explanation": "Class name and module path match configured service convention."
    }
  ]
}
```

### Middleware

Represents reusable request, response, event, or execution pipeline
middleware.

Required fields:

- Common node fields.
- `id` with `middleware` prefix.
- `name`.

Optional metadata:

- `middlewareKind`: `http`, `rpc`, `event`, `queue`, `framework`, or
  `unknown`.
- `order`
- `global`

Invariants:

- Middleware SHOULD be linked to Route, Operation, or Service nodes using
  USES or CALLS depending on whether invocation is direct.
- Middleware that enforces access control SHOULD connect to Permission
  nodes using AUTHORIZES when deterministically known.

Example:

```json
{
  "id": "middleware:src/server/auth.ts:requireSession",
  "type": "Middleware",
  "name": "requireSession",
  "attributes": { "middlewareKind": "http" },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/server/auth.ts" },
      "confidence": "resolved"
    }
  ]
}
```

### Event

Represents a domain event, integration event, queue message, topic message,
or observable signal.

Required fields:

- Common node fields.
- `id` with `event` prefix.
- `name`.

Optional metadata:

- `eventKind`: `domain`, `integration`, `queue`, `topic`, `webhook`, or
  `unknown`.
- `payload`
- `topic`

Invariants:

- PUBLISHES edges point from producer nodes to Event nodes.
- SUBSCRIBES edges point from subscriber nodes to Event nodes.

Example:

```json
{
  "id": "event:UserCreated",
  "type": "Event",
  "name": "UserCreated",
  "attributes": { "eventKind": "domain", "payload": "model:User" },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/users/events.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Permission

Represents a permission, role, scope, policy action, or authorization
capability.

Required fields:

- Common node fields.
- `id` with `perm` prefix.
- `name`.

Optional metadata:

- `permissionKind`: `role`, `scope`, `policy`, `capability`, or
  `unknown`.
- `value`

Invariants:

- AUTHORIZES edges SHOULD point from the node enforcing authorization to
  the Permission node.
- Permissions MAY BELONG_TO Resource nodes.

Example:

```json
{
  "id": "perm:auth.login",
  "type": "Permission",
  "name": "auth.login",
  "attributes": { "permissionKind": "scope", "value": "auth:login" },
  "provenance": [
    {
      "kind": "config",
      "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
      "source": { "kind": "config", "path": "src/auth/permissions.ts" },
      "confidence": "exact"
    }
  ]
}
```

### Configuration

Represents a named configuration object, setting, feature flag, or config
section.

Required fields:

- Common node fields.
- `id` with `config` prefix.
- `name`.

Optional metadata:

- `configKind`: `object`, `file`, `feature-flag`, `runtime`, `build`, or
  `unknown`.
- `defaultValue`
- `required`

Invariants:

- Configuration nodes SHOULD contain Field nodes when subfields are known.
- READS edges SHOULD point from consumer nodes to Configuration nodes.
- WRITES edges SHOULD point from mutating nodes to Configuration nodes.

Example:

```json
{
  "id": "config:src/config.ts:authConfig",
  "type": "Configuration",
  "name": "authConfig",
  "attributes": { "configKind": "object" },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/config.ts" },
      "confidence": "exact"
    }
  ]
}
```

### EnvironmentVariable

Represents an environment variable read, declaration, or required runtime
setting.

Required fields:

- Common node fields.
- `id` with `env` prefix.
- `name`.

Optional metadata:

- `required`
- `defaultValue`
- `sensitive`
- `runtime`: `node`, `browser`, `edge`, `ci`, `container`, or `unknown`.

Invariants:

- EnvironmentVariable IDs SHOULD use the variable name, for example
  `env:DATABASE_URL`.
- READS edges SHOULD point from consumer nodes to EnvironmentVariable nodes.
- Sensitive values MUST NOT be stored in the graph. Only names and
  non-secret metadata are allowed.

Example:

```json
{
  "id": "env:DATABASE_URL",
  "type": "EnvironmentVariable",
  "name": "DATABASE_URL",
  "attributes": { "required": true, "sensitive": true, "runtime": "node" },
  "provenance": [
    {
      "kind": "syntax",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "source": { "kind": "file", "path": "src/db.ts" },
      "confidence": "resolved"
    }
  ]
}
```

## Edge Model

All edges share the same envelope:

```ts
interface SoftwareEdge {
  id: EdgeId;
  type: RelationshipType;
  from: NodeId;
  to: NodeId;
  confidence: Confidence;
  provenance: Provenance[];
  attributes?: JsonObject;
  extensions?: ExtensionMap;
}
```

Required fields:

- `id`
- `type`
- `from`
- `to`
- `confidence`
- `provenance`

Invariants:

- `from` and `to` MUST reference existing nodes.
- `id` MUST follow the Stable Identifiers section.
- `confidence` MUST be the weakest confidence level among the provenance
  records that justify the edge.
- `provenance` MUST contain at least one record.
- Multiple source occurrences of the same logical relationship SHOULD be
  represented as one edge with multiple provenance records.
- Parser-specific edge data belongs in `extensions`.

Confidence ordering from strongest to weakest:

```text
exact > resolved > inferred > low
```

## Canonical Relationship Types

### CALLS

Semantics: A callable or operation invokes another callable or operation.

Direction: caller to callee.

Confidence rules:

- `exact` when a direct call target is syntactically unambiguous.
- `resolved` when deterministic symbol or type resolution identifies the
  target.
- `inferred` when a framework convention identifies the target.
- `low` when the call target is approximate.

Provenance requirements:

- MUST include syntax, resolver, schema, or plugin provenance.
- Inferred or low-confidence CALLS edges MUST include an explanation.

### IMPORTS

Semantics: A module, package, or namespace imports another module, package,
or namespace.

Direction: importer to imported entity.

Confidence rules:

- `exact` when the import specifier is explicit.
- `resolved` when the specifier is resolved to a concrete graph node.
- `low` when the specifier cannot be resolved.

Provenance requirements:

- MUST include the source range or config entry containing the import when
  available.
- Unresolved imports SHOULD also produce a diagnostic.

### EXPORTS

Semantics: A module, package, namespace, or schema exposes a symbol through
an export surface.

Direction: exporter to exported node.

Confidence rules:

- `exact` for explicit exports.
- `resolved` for reexports resolved through deterministic module
  resolution.
- `inferred` for convention-based public APIs.

Provenance requirements:

- MUST include syntax, config, or resolver provenance.
- Reexports SHOULD include attributes describing the export name.

### IMPLEMENTS

Semantics: A class, model, service, operation, or resource satisfies a
contract.

Direction: implementer to contract.

Confidence rules:

- `exact` when the implementation is explicitly declared.
- `resolved` when a type checker or schema resolver verifies the contract.
- `inferred` when inferred from naming or framework convention.

Provenance requirements:

- MUST identify the declaration or schema rule supporting the relationship.

### EXTENDS

Semantics: A node inherits from, specializes, or extends another node.

Direction: extending node to base node.

Confidence rules:

- `exact` for explicit language or schema extension.
- `resolved` when the base symbol is resolved deterministically.
- `inferred` only for documented framework conventions.

Provenance requirements:

- MUST include syntax, schema, or resolver provenance.

### DEPENDS_ON

Semantics: A node requires another node to build, run, type-check, or
function correctly.

Direction: dependent to dependency.

Confidence rules:

- `exact` for manifest or config dependencies.
- `resolved` for compiler-derived dependency relationships.
- `inferred` for convention-derived dependencies.

Provenance requirements:

- MUST include config, resolver, schema, or plugin provenance.
- SHOULD include attributes describing dependency kind, for example
  `runtime`, `dev`, `peer`, `build`, or `type`.

### USES

Semantics: A node refers to or uses another node without necessarily
calling, importing, reading, or writing it.

Direction: user to used node.

Confidence rules:

- `exact` for explicit type annotations or schema references.
- `resolved` when name resolution determines the target.
- `inferred` for convention-based use.

Provenance requirements:

- MUST include syntax, schema, or resolver provenance.
- SHOULD use a more specific relationship when one applies.

### READS

Semantics: A node reads a field, configuration value, environment variable,
resource, or data store.

Direction: reader to read target.

Confidence rules:

- `exact` for direct property, variable, or config reads.
- `resolved` when the read target is resolved through type or schema
  analysis.
- `inferred` for framework or ORM conventions.

Provenance requirements:

- MUST identify the read expression or config rule when available.

### WRITES

Semantics: A node mutates or writes a field, configuration value, resource,
model, or data store.

Direction: writer to written target.

Confidence rules:

- `exact` for direct assignments, mutations, or write calls with known
  targets.
- `resolved` when the write target is determined by type, schema, or ORM
  resolution.
- `inferred` for conventions.

Provenance requirements:

- MUST identify the write expression or schema operation when available.

### RETURNS

Semantics: A callable, operation, route, or schema operation returns a type,
model, resource, or value shape.

Direction: returning node to returned node.

Confidence rules:

- `exact` for explicit return declarations or schema response declarations.
- `resolved` for type-checker resolved return types.
- `inferred` for inferred return types.

Provenance requirements:

- MUST include syntax, type-checker, or schema provenance.
- Inferred return relationships SHOULD include an explanation.

### THROWS

Semantics: A callable, method, operation, route, or middleware may throw,
raise, reject, or return an error condition represented by another node.

Direction: throwing node to thrown/error node.

Confidence rules:

- `exact` for explicit throw declarations, throw expressions, or schema
  error responses.
- `resolved` when the thrown type is resolved.
- `inferred` for conventional error paths.

Provenance requirements:

- MUST include source or schema provenance when available.

### CREATES

Semantics: A node creates, constructs, instantiates, allocates, or registers
another node.

Direction: creator to created node.

Confidence rules:

- `exact` for explicit constructors, schema declarations, or registration
  calls.
- `resolved` when type resolution identifies the created target.
- `inferred` for framework registration conventions.

Provenance requirements:

- MUST identify construction, declaration, or registration evidence.

### AUTHORIZES

Semantics: A node enforces, requires, grants, or checks a permission.

Direction: authorizing/enforcing node to Permission node.

Confidence rules:

- `exact` for explicit permission checks or policy declarations.
- `resolved` when a framework or policy resolver identifies the permission.
- `inferred` for naming or route convention.

Provenance requirements:

- MUST include config, syntax, schema, or plugin provenance.
- Inferred authorization edges MUST include an explanation.

### BELONGS_TO

Semantics: A node is owned by, grouped under, or logically belongs to
another node, without necessarily being structurally contained in source.

Direction: member to owner.

Confidence rules:

- `exact` for explicit ownership declarations.
- `resolved` for deterministic manifest, schema, or workspace ownership.
- `inferred` for naming or folder conventions.

Provenance requirements:

- MUST identify the ownership rule.
- SHOULD prefer CONTAINS for structural containment.

### CONTAINS

Semantics: A node structurally contains another node.

Direction: container to contained node.

Confidence rules:

- `exact` for direct source, schema, or config containment.
- `resolved` for compiler-resolved containment.
- `inferred` for configured project conventions.

Provenance requirements:

- MUST include syntax, schema, config, or compiler provenance.

Invariants:

- CONTAINS SHOULD form a directed acyclic graph.
- A node MAY have more than one container only when the graph represents
  multiple valid views, such as reexports or generated schema ownership.

### REFERENCES

Semantics: A node refers to another node in a way that does not imply a
more specific relationship.

Direction: referring node to referenced node.

Confidence rules:

- `exact` for explicit references.
- `resolved` when name or schema resolution identifies the target.
- `low` for unresolved approximate references.

Provenance requirements:

- MUST include evidence of the reference.
- Producers SHOULD emit a more specific relationship when possible.

### SUBSCRIBES

Semantics: A node subscribes to, listens for, observes, or handles an event.

Direction: subscriber to Event node.

Confidence rules:

- `exact` for explicit subscription declarations.
- `resolved` when event names or topics are resolved.
- `inferred` for framework conventions.

Provenance requirements:

- MUST include syntax, config, schema, or plugin provenance.

### PUBLISHES

Semantics: A node emits, publishes, dispatches, or enqueues an event.

Direction: publisher to Event node.

Confidence rules:

- `exact` for explicit publish or dispatch calls.
- `resolved` when event names or topics are resolved.
- `inferred` for framework conventions.

Provenance requirements:

- MUST include syntax, config, schema, or plugin provenance.

## Stable Identifiers

Stable IDs are deterministic strings used for caching, diffing, indexing,
and cross-tool references.

### ID Requirements

IDs MUST:

- Be deterministic for equivalent graph input.
- Avoid absolute local paths.
- Use normalized `/` path separators.
- Use canonical casing from source where language semantics are
  case-sensitive.
- Remain stable across rebuilds whenever the represented entity has not
  been renamed, moved, or structurally changed.
- Be unique within a graph.

IDs SHOULD:

- Prefer explicit names over generated hashes.
- Prefer repository-relative paths over absolute paths.
- Prefer public export names for public API nodes when a stable public
  export identity exists.
- Use aliases to preserve history across moves or renames when known.

IDs MUST NOT:

- Include timestamps.
- Include machine-specific absolute paths.
- Include random values.
- Include line or column numbers unless the node is marked ephemeral.

### ID Prefixes

Canonical prefixes:

| Node Type | Prefix | Example |
| --- | --- | --- |
| Repository | `repo` | `repo:github.com/0xsarwagya/ontoly` |
| Package | `pkg` | `pkg:@0xsarwagya/ontoly-core` |
| Module | `mod` | `mod:src/auth/service.ts` |
| Namespace | `ns` | `ns:src/sdk.ts:Ontoly` |
| Function | `fn` | `fn:src/auth/service.ts:login` |
| Method | `method` | `method:src/users.ts:UserService.findById` |
| Class | `class` | `class:src/users.ts:UserService` |
| Interface | `iface` | `iface:src/auth.ts:SessionStore` |
| TypeAlias | `type` | `type:src/auth.ts:LoginResult` |
| Enum | `enum` | `enum:src/auth.ts:Role` |
| Model | `model` | `model:User` |
| Field | `field` | `field:model:User:email` |
| Route | `route` | `route:POST:/login` |
| Resource | `resource` | `resource:Auth` |
| Operation | `op` | `op:login` |
| Service | `service` | `service:AuthService` |
| Middleware | `middleware` | `middleware:src/auth.ts:requireSession` |
| Event | `event` | `event:UserCreated` |
| Permission | `perm` | `perm:auth.login` |
| Configuration | `config` | `config:src/config.ts:authConfig` |
| EnvironmentVariable | `env` | `env:DATABASE_URL` |

### ID Grammar

```text
node-id = prefix ":" identity
identity = component *( ":" component )
component = 1*id-char
```

`:` separates components. Literal `:`, `%`, newline, and other unsafe
characters inside a component MUST be percent-encoded.

Recommended patterns:

```text
repo:<repository-name-or-url>
pkg:<package-name>
mod:<repo-relative-path>
fn:<repo-relative-path>:<qualified-name>
method:<repo-relative-path>:<owner-qualified-name>.<method-name>
class:<repo-relative-path>:<qualified-name>
iface:<repo-relative-path>:<qualified-name>
type:<repo-relative-path>:<qualified-name>
enum:<repo-relative-path>:<qualified-name>
field:<owner-id>:<field-name>
route:<METHOD>:<route-path>
model:<model-name>
op:<operation-id>
env:<VARIABLE_NAME>
```

### Ambiguity

When two nodes would otherwise have the same ID, the producer MUST add a
deterministic qualifier.

Allowed qualifiers:

- Export name.
- Owner qualified name.
- Signature hash.
- Schema pointer.
- Stable generated declaration name.

Signature hashes MUST be derived from normalized semantic signatures, not
raw source text.

Example:

```text
fn:src/math.ts:add#sig:8cc4d2
```

### Edge IDs

Edge IDs are deterministic:

```text
edge:<relationship-lowercase>:<hash>
```

The hash input is the canonical edge key:

```json
{
  "type": "CALLS",
  "from": "fn:src/auth.ts:login",
  "to": "method:src/users.ts:UserStore.findByEmail",
  "qualifier": null
}
```

`qualifier` is optional and SHOULD be omitted unless multiple logical edges
of the same type between the same endpoints must be distinguished.

## Diagnostics Model

Diagnostics are graph-native findings. They are not TypeScript diagnostics,
OpenAPI diagnostics, or plugin logs, though they may be derived from any of
those sources.

```ts
interface Diagnostic {
  id: DiagnosticId;
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  category?: DiagnosticCategory;
  source?: SourceRef;
  range?: SourceRange;
  relatedNodes?: NodeId[];
  relatedEdges?: EdgeId[];
  provenance: Provenance[];
  attributes?: JsonObject;
  extensions?: ExtensionMap;
}

type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

type DiagnosticCategory =
  | "schema"
  | "resolution"
  | "relationship"
  | "consistency"
  | "performance"
  | "security"
  | "style"
  | "unknown";
```

Required fields:

- `id`
- `code`
- `severity`
- `message`
- `provenance`

Rules:

- `code` MUST be stable and graph-native, for example
  `UNRESOLVED_REFERENCE`, `DUPLICATE_NODE_ID`, `CIRCULAR_IMPORT`, or
  `LOW_CONFIDENCE_RELATIONSHIP`.
- Parser-specific codes MAY appear in extensions but SHOULD NOT be used as
  core diagnostic codes.
- `severity` describes graph validity or usefulness:
  - `error`: graph content is invalid, incomplete, or unsafe to consume for
    affected nodes or edges.
  - `warning`: graph content is valid but likely incomplete or surprising.
  - `info`: useful contextual information.
  - `hint`: optional guidance.
- `relatedNodes` and `relatedEdges` MUST reference existing graph IDs.
- Diagnostics SHOULD include source or range when the issue can be located.
- Diagnostics MUST include provenance.

Diagnostic IDs:

```text
diag:<code-lowercase>:<hash>
```

The hash input SHOULD include code, primary location, related node IDs,
related edge IDs, and normalized message text.

Example:

```json
{
  "id": "diag:unresolved_reference:4f1a20",
  "code": "UNRESOLVED_REFERENCE",
  "severity": "warning",
  "message": "Could not resolve imported symbol createUser.",
  "category": "resolution",
  "source": { "kind": "file", "path": "src/users/index.ts", "language": "typescript" },
  "relatedNodes": ["mod:src/users/index.ts"],
  "provenance": [
    {
      "kind": "resolver",
      "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
      "confidence": "exact"
    }
  ]
}
```

## Metadata Model

```ts
interface GraphMetadata {
  createdAt?: string;
  contentHash: string;
  producer: ProducerRef;
  producers?: ProducerRef[];
  repositoryDigest?: string;
  nodeCount: number;
  edgeCount: number;
  diagnosticCount: number;
  sourceCount?: number;
  build?: {
    durationMs?: number;
    incremental?: boolean;
    cacheHit?: boolean;
  };
  compatibility?: {
    minimumConsumerVersion?: string;
    features?: string[];
  };
  extensions?: ExtensionMap;
}
```

Rules:

- `contentHash` MUST be computed from canonical graph content as defined in
  Serialization.
- `createdAt`, `build.durationMs`, and other volatile fields MUST NOT be
  included in `contentHash`.
- `nodeCount`, `edgeCount`, and `diagnosticCount` MUST match graph arrays.
- Producers SHOULD list all parser and plugin producers that contributed
  core graph facts.

## Indexes

Indexes are optional derived structures.

```ts
interface GraphIndexes {
  nodesByType?: { [type: string]: NodeId[] };
  edgesByType?: { [type: string]: EdgeId[] };
  inboundEdgesByNode?: { [nodeId: string]: EdgeId[] };
  outboundEdgesByNode?: { [nodeId: string]: EdgeId[] };
  edgesBySource?: { [sourcePath: string]: EdgeId[] };
}
```

Rules:

- Indexes MUST be reproducible from nodes and edges.
- Indexes MUST NOT be required to interpret graph content.
- Indexes MUST NOT be included in `contentHash`.
- Consumers MAY discard and rebuild indexes.
- Validators SHOULD verify indexes when present.

## Versioning Strategy

Software Graph spec versions are independent from Ontoly package versions.

The version format is semantic:

```text
MAJOR.MINOR.PATCH
```

Rules:

- `MAJOR` changes for breaking schema or semantic changes.
- `MINOR` changes for additive backward-compatible features.
- `PATCH` changes for clarifications, typo fixes, and non-semantic
  corrections.
- A graph document MUST declare `specVersion`.
- Plugins and consumers SHOULD declare graph compatibility ranges.

Example plugin compatibility declaration:

```json
{
  "name": "@0xsarwagya/ontoly-plugin-mermaid",
  "version": "0.1.0",
  "softwareGraph": {
    "compatibleSpec": "^1.0.0"
  }
}
```

Compatibility rules:

- A v1 consumer MUST reject unknown major versions by default.
- A v1 consumer SHOULD accept newer v1 minor versions if it can ignore
  unknown core additions and extensions.
- Producers MUST NOT emit breaking v2 semantics under a v1 version.

## Serialization Format

Software Graph v1 uses canonical JSON.

### Document Shape

```json
{
  "specVersion": "1.0.0",
  "graphId": "graph:sha256:...",
  "repository": {},
  "nodes": [],
  "edges": [],
  "diagnostics": [],
  "metadata": {},
  "indexes": {},
  "extensions": {}
}
```

### Canonical JSON Rules

For canonical serialization:

- Encoding MUST be UTF-8.
- Object keys MUST be sorted lexicographically.
- Optional fields with no value MUST be omitted.
- Arrays with semantic identity MUST be sorted:
  - `nodes` by `id`.
  - `edges` by `id`.
  - `diagnostics` by `id`.
  - `provenance` by canonical JSON representation unless source order is
    semantically required.
- JSON numbers MUST be finite.
- Paths MUST use `/`.
- Absolute local paths MUST NOT appear in canonical content.
- Extension objects MUST follow the same canonical rules.

### Content Hash

`metadata.contentHash` and `graphId` are derived from canonical graph
content.

Hash input includes:

- `specVersion`
- `repository`
- `nodes`
- `edges`
- `diagnostics`
- non-volatile `metadata` fields except `contentHash`
- `extensions` when present

Hash input excludes:

- `graphId`
- `metadata.contentHash`
- `metadata.createdAt`
- `metadata.build.durationMs`
- `indexes`

`graphId` format:

```text
graph:sha256:<hex>
```

### Persistence

The canonical JSON document SHOULD be persisted as:

```text
.ontoly/graph.json
```

Derived files MAY be persisted alongside it:

```text
.ontoly/indexes.json
.ontoly/diagnostics.json
.ontoly/metadata.json
.ontoly/cache.json
```

The canonical source of truth remains `graph.json`.

### Diffing

Graph diffing SHOULD compare:

- Node additions, removals, and changes by node ID.
- Edge additions, removals, and changes by edge ID.
- Diagnostic additions, removals, and changes by diagnostic ID.
- Metadata changes separately from semantic graph changes.

Indexes MUST be ignored for semantic graph diffing.

### Incremental Compilation

Incremental compilers SHOULD track source digests and the node/edge IDs
derived from each source.

The spec does not define an incremental cache format, but canonical graph
IDs, source digests, provenance, and stable IDs MUST be sufficient for an
implementation to invalidate affected graph regions.

## Extension Mechanism

Extensions allow plugins and parsers to attach metadata safely.

Extensions MAY appear on:

- Graph documents.
- Repository descriptors.
- Nodes.
- Edges.
- Diagnostics.
- Provenance records.
- Metadata.

Extension namespace rules:

- Namespace MUST be globally unique.
- Namespace SHOULD be the producer package name.
- Namespace contents MUST be JSON.
- Namespace contents MUST NOT be required for core validation.
- Namespace contents MUST NOT redefine core fields.
- Namespace owners SHOULD document their extension schema.

Extension node and relationship types:

- Extension node types MUST use a namespace-qualified type string, for
  example `@example/ontoly-plugin:Queue`.
- Extension relationship types MUST use a namespace-qualified type string,
  for example `@example/ontoly-plugin:ENQUEUES`.
- Extension types MUST NOT use unqualified core names.
- Core consumers MAY preserve extension types without understanding their
  semantics.
- Plugins that require extension types MUST declare that requirement in
  their compatibility metadata.

Example:

```json
{
  "id": "fn:src/auth/service.ts:login",
  "type": "Function",
  "name": "login",
  "provenance": [],
  "extensions": {
    "@0xsarwagya/ontoly-parser-typescript": {
      "tsSymbolFlags": ["Function", "Export"],
      "declarationKind": "FunctionDeclaration"
    }
  }
}
```

Extension compatibility:

- Consumers MUST ignore unknown extensions unless explicitly configured to
  require them.
- Plugins MUST NOT use extensions to bypass core schema validation.
- A future core schema MAY promote a widely used extension field into the
  core schema only through an RFC.

## Future Compatibility

The v1 schema reserves room for:

- Additional node types.
- Additional relationship types.
- Additional diagnostic categories.
- Additional provenance kinds.
- Binary serialization.
- Cross-repository graphs.
- Graph patches and graph deltas.
- Richer type systems.
- Runtime traces linked to static graph nodes.

Adding any of these to the core schema requires an RFC when it affects:

- Software Graph shape.
- Node or edge semantics.
- Stable ID rules.
- Serialization.
- Version negotiation.
- Plugin interoperability.

## Validation Requirements

A v1 validator MUST check:

1. `specVersion` is supported.
2. `graphId` format is valid.
3. Required top-level fields exist.
4. Node IDs are unique and valid.
5. Edge IDs are unique and valid.
6. Edge endpoints exist.
7. Diagnostic references exist.
8. Required node fields exist.
9. Required edge fields exist.
10. Provenance records are valid.
11. Confidence values are valid.
12. Canonical relationship direction rules are not violated when
    statically checkable.
13. Optional indexes match graph content when present.
14. Extension namespaces are valid.
15. Metadata counts match graph arrays.

A validator SHOULD also:

- Recompute and verify `metadata.contentHash`.
- Recompute and verify `graphId`.
- Warn about low-confidence relationships without explanations.
- Warn about ephemeral IDs.
- Warn about absolute local paths.

## Minimal Valid Graph Example

```json
{
  "specVersion": "1.0.0",
  "graphId": "graph:sha256:example",
  "repository": {
    "id": "repo:example",
    "name": "example"
  },
  "nodes": [
    {
      "id": "repo:example",
      "type": "Repository",
      "name": "example",
      "provenance": [
        {
          "kind": "config",
          "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
          "confidence": "exact"
        }
      ]
    },
    {
      "id": "mod:src/index.ts",
      "type": "Module",
      "name": "src/index.ts",
      "language": "typescript",
      "provenance": [
        {
          "kind": "syntax",
          "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
          "source": { "kind": "file", "path": "src/index.ts", "language": "typescript" },
          "confidence": "exact"
        }
      ]
    },
    {
      "id": "fn:src/index.ts:main",
      "type": "Function",
      "name": "main",
      "language": "typescript",
      "provenance": [
        {
          "kind": "syntax",
          "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
          "source": { "kind": "file", "path": "src/index.ts", "language": "typescript" },
          "confidence": "exact"
        }
      ]
    }
  ],
  "edges": [
    {
      "id": "edge:contains:example1",
      "type": "CONTAINS",
      "from": "repo:example",
      "to": "mod:src/index.ts",
      "confidence": "exact",
      "provenance": [
        {
          "kind": "config",
          "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
          "confidence": "exact"
        }
      ]
    },
    {
      "id": "edge:contains:example2",
      "type": "CONTAINS",
      "from": "mod:src/index.ts",
      "to": "fn:src/index.ts:main",
      "confidence": "exact",
      "provenance": [
        {
          "kind": "syntax",
          "producer": { "name": "@0xsarwagya/ontoly-parser-typescript", "version": "0.1.0" },
          "source": { "kind": "file", "path": "src/index.ts", "language": "typescript" },
          "confidence": "exact"
        }
      ]
    }
  ],
  "diagnostics": [],
  "metadata": {
    "contentHash": "sha256:example",
    "producer": { "name": "@0xsarwagya/ontoly-compiler", "version": "0.1.0" },
    "nodeCount": 3,
    "edgeCount": 2,
    "diagnosticCount": 0
  }
}
```

The example uses placeholder hashes. A conforming serializer MUST replace
them with hashes computed from canonical content.

## Open Questions

- Should v1 include a formal JSON Schema artifact in addition to this RFC?
- Should graph documents support multiple repositories in v1, or should
  cross-repository graphs wait for v2?
- Should public API symbols prefer package export IDs over source-path IDs
  by default?
- Should route handler relationships receive a dedicated ROUTES_TO edge in
  v1.1, or should CALLS and REFERENCES remain sufficient?
- Should binary serialization be standardized as a v1.x extension or
  deferred to v2?
