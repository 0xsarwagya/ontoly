import { describe, expect, it } from "vitest";
import { analyzeGoProject } from "@0xsarwagya/ontoly-go";
import type { GoProject } from "@0xsarwagya/ontoly-go";
import {
  createDefaultGoFrameworkRegistry,
  createGoFrameworkRegistry,
  generateGoCompilerArtifacts,
} from "@0xsarwagya/ontoly-semantic-go";

function analyzeSource(source: string): GoProject {
  return analyzeGoProject({
    root: "/test",
    files: ["main.go"],
    sourceProvider: () => source,
  });
}

describe("Go semantic bridge", () => {
  it("generates symbols for structs, functions, and imports", () => {
    const project = analyzeSource(`
package main

import "fmt"

type User struct {
	Name string
}

func main() {
	fmt.Println("hello")
}
`);
    const result = generateGoCompilerArtifacts({ project });

    const scriptSym = result.symbols.find((s) => s.kind === "Script");
    expect(scriptSym).toBeDefined();
    expect(scriptSym!.language).toBe("go");

    const classSym = result.symbols.find((s) => s.kind === "Class" && s.name === "User");
    expect(classSym).toBeDefined();
    expect(classSym!.metadata?.goKind).toBe("struct");

    const funcSym = result.symbols.find((s) => s.kind === "Function" && s.name === "main");
    expect(funcSym).toBeDefined();

    const importSym = result.symbols.find((s) => s.kind === "Import" && s.name === "fmt");
    expect(importSym).toBeDefined();
  });

  it("generates CONTAINS relationships", () => {
    const project = analyzeSource(`
package main

type Server struct {
	port int
}

func Start() {}
`);
    const result = generateGoCompilerArtifacts({ project });

    const contains = result.relationships.filter((r) => r.type === "CONTAINS");
    expect(contains.length).toBeGreaterThanOrEqual(2);
  });

  it("generates EXTENDS for embedded structs", () => {
    const project = analyzeSource(`
package main

type Base struct {
	ID int
}

type User struct {
	Base
	Name string
}
`);
    const result = generateGoCompilerArtifacts({ project });

    const extends_ = result.relationships.filter((r) => r.type === "EXTENDS");
    expect(extends_.length).toBe(1);
    expect(extends_[0]!.evidence?.[0]?.description).toContain("embeds Base");
  });

  it("generates IMPORTS relationships", () => {
    const project = analyzeSource(`
package main

import "net/http"
`);
    const result = generateGoCompilerArtifacts({ project });

    const imports = result.relationships.filter((r) => r.type === "IMPORTS");
    expect(imports.length).toBe(1);

    const pkgSym = result.symbols.find((s) => s.kind === "Package" && s.name === "net/http");
    expect(pkgSym).toBeDefined();
  });

  it("generates CALLS relationships", () => {
    const project = analyzeSource(`
package main

import "fmt"

func main() {
	fmt.Println("hello")
}
`);
    const result = generateGoCompilerArtifacts({ project });

    const calls = result.relationships.filter((r) => r.type === "CALLS");
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("generates method symbols with receiver metadata", () => {
    const project = analyzeSource(`
package main

type Server struct{}

func (s *Server) Start() {}
`);
    const result = generateGoCompilerArtifacts({ project });

    const methodSym = result.symbols.find((s) => s.kind === "Method");
    expect(methodSym).toBeDefined();
    expect(methodSym!.metadata?.receiverType).toBe("Server");
    expect(methodSym!.metadata?.pointerReceiver).toBe(true);
  });

  it("uses empty registry when none provided and no frameworks detected", () => {
    const project = analyzeSource(`package main`);
    const result = generateGoCompilerArtifacts({
      project,
      registry: createGoFrameworkRegistry([]),
    });

    expect(result.detections).toHaveLength(0);
    expect(result.facts).toHaveLength(0);
  });
});

describe("Go framework detection", () => {
  it("detects Gin", () => {
    const project = analyzeSource(`
package main

import "github.com/gin-gonic/gin"

func main() {
	r := gin.Default()
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const gin = detections.find((d) => d.framework === "Gin");
    expect(gin?.detected).toBe(true);
    expect(gin?.evidence).toContain("github.com/gin-gonic/gin");
  });

  it("detects Echo", () => {
    const project = analyzeSource(`
package main

import "github.com/labstack/echo/v4"

func main() {
	e := echo.New()
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const echo = detections.find((d) => d.framework === "Echo");
    expect(echo?.detected).toBe(true);
  });

  it("detects Fiber", () => {
    const project = analyzeSource(`
package main

import "github.com/gofiber/fiber/v2"

func main() {
	app := fiber.New()
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const fiber = detections.find((d) => d.framework === "Fiber");
    expect(fiber?.detected).toBe(true);
  });

  it("detects gRPC", () => {
    const project = analyzeSource(`
package main

import "google.golang.org/grpc"

func main() {
	s := grpc.NewServer()
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const grpc = detections.find((d) => d.framework === "gRPC");
    expect(grpc?.detected).toBe(true);
  });

  it("detects GORM", () => {
    const project = analyzeSource(`
package main

import "gorm.io/gorm"

func main() {
	db := gorm.Open()
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const gorm = detections.find((d) => d.framework === "GORM");
    expect(gorm?.detected).toBe(true);
  });

  it("detects Chi", () => {
    const project = analyzeSource(`
package main

import "github.com/go-chi/chi/v5"

func main() {
	r := chi.NewRouter()
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const chi = detections.find((d) => d.framework === "Chi");
    expect(chi?.detected).toBe(true);
  });

  it("returns no detections for vanilla Go", () => {
    const project = analyzeSource(`
package main

import "fmt"

func main() {
	fmt.Println("hello")
}
`);
    const registry = createDefaultGoFrameworkRegistry();
    const detections = registry.detect(project);
    const detected = detections.filter((d) => d.detected);
    expect(detected).toHaveLength(0);
  });
});

describe("Go framework analysis", () => {
  it("analyzes Gin handler functions", () => {
    const project = analyzeSource(`
package main

import "github.com/gin-gonic/gin"

func GetUser(c *gin.Context) {}
`);
    const result = generateGoCompilerArtifacts({ project });
    const handlers = result.facts.filter(
      (f) => f.kind === "ControllerDeclared" && (f as { metadata?: { ginKind?: string } }).metadata?.ginKind === "handler",
    );
    expect(handlers.length).toBe(1);
  });

  it("analyzes GORM models via embedded gorm.Model", () => {
    const project = analyzeSource(`
package main

import "gorm.io/gorm"

type Product struct {
	gorm.Model
	Name  string
	Price float64
}
`);
    const result = generateGoCompilerArtifacts({ project });
    const models = result.facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as { metadata?: { gormKind?: string } }).metadata?.gormKind === "model",
    );
    expect(models.length).toBe(1);
  });
});
