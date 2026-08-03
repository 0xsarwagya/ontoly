---
title: "Feature Matrix"
description: "Supported, experimental, and non-goal surfaces across Ontoly packages, validation, MCP, skills, and graph tooling."
---

## Core

| Feature | Status | Evidence |
| ------- | ------ | -------- |
| Software Graph JSON | Supported | `@0xsarwagya/ontoly-core` |
| Deterministic compiler pipeline | Supported | `@0xsarwagya/ontoly-compiler` |
| Query Engine | Supported | `@0xsarwagya/ontoly-query` |
| Capability API | Supported | `@0xsarwagya/ontoly-capabilities` |
| Repository Intelligence | Supported | `@0xsarwagya/ontoly-intelligence` |
| Deterministic graph diff | Supported | `@0xsarwagya/ontoly-diff` |
| Caching | Supported | `@0xsarwagya/ontoly-cache` |

## Language frontends

| Frontend | Status | Evidence |
| -------- | ------ | -------- |
| JavaScript frontend | Supported | ESM, CommonJS, JSX, and `jsconfig.json` |
| TypeScript frontend | Supported | TS, TSX, MTS, CTS, and `tsconfig.json` |
| Python frontend | Supported | `@0xsarwagya/ontoly-parser-python`, `@0xsarwagya/ontoly-semantic-python` |
| Go frontend | Supported | `@0xsarwagya/ontoly-parser-go`, `@0xsarwagya/ontoly-semantic-go` |
| OpenAPI frontend | Experimental | `@0xsarwagya/ontoly-parser-openapi` |

## Framework analyzers

| Language | Count | Status |
| -------- | ----- | ------ |
| JavaScript / TypeScript | 17 | Supported — see [Framework Matrix](framework-matrix.md) |
| Python | 6 | Supported — Django, FastAPI, PyTorch, TensorFlow, Hugging Face, scikit-learn |
| Go | 6 | Supported — Gin, Echo, Fiber, Chi, gRPC, GORM |

## MCP and skills

| Feature | Status | Evidence |
| ------- | ------ | -------- |
| MCP runtime | Supported | `@0xsarwagya/ontoly-mcp` (32 capabilities across structural, semantic, and history tiers) |
| Agent Skills | Supported | `skills/` — 14 skills shipping in the catalog |
| LLM Enhancement contract | Supported | [LLM Enhancement](llm-enhancement.md) |

## Enhancers

| Enhancer | Status | Evidence |
| -------- | ------ | -------- |
| Semantics enhancer | Supported | `@0xsarwagya/ontoly-enhancer-semantics` |
| History enhancer | Supported | `@0xsarwagya/ontoly-enhancer-history` |

## Validation and quality

| Feature | Status | Evidence |
| ------- | ------ | -------- |
| Semantic evaluation harness | Supported | `validation/semantic/` |
| Validation Lab | Supported | `validation/` |
| Performance lab | Supported | `validation/performance/` |
| Question corpus | Supported | `validation/corpus/` |

## Plugins

| Plugin | Status | Evidence |
| ------ | ------ | -------- |
| HTML graph plugin | Supported | `@0xsarwagya/ontoly-plugin-html` |
| Mermaid plugin | Supported | `@0xsarwagya/ontoly-plugin-mermaid` |

## Not included

| Feature | Status | Reason |
| ------- | ------ | ------ |
| Binary graph format | Roadmap | Waiting for Software Graph spec 1.0 stabilization |
| Hosted service | Non-goal | Ontoly is a library, not a SaaS |
| AI reasoning | Non-goal | LLM-facing usage goes through Skills + MCP, never inside the compiler |
| GraphQL SDL parser | Roadmap | Not in v1.3.0 |
| SQL schema parser | Roadmap | Not in v1.3.0 |
