import { describe, expect, it } from "vitest";
import { analyzeGoProject } from "@0xsarwagya/ontoly-go";
import type { GoProject } from "@0xsarwagya/ontoly-go";

function analyzeSource(source: string): GoProject {
  return analyzeGoProject({
    root: "/test",
    files: ["main.go"],
    sourceProvider: () => source,
  });
}

describe("Go analyzer", () => {
  it("extracts package name", () => {
    const project = analyzeSource(`package main`);
    expect(project.packages).toHaveLength(1);
    expect(project.packages[0]!.name).toBe("main");
    expect(project.files[0]!.packageName).toBe("main");
  });

  it("extracts imports", () => {
    const project = analyzeSource(`
package main

import (
	"fmt"
	"net/http"
	log "github.com/sirupsen/logrus"
	_ "github.com/lib/pq"
)
`);
    expect(project.imports).toHaveLength(4);
    expect(project.imports[0]!.path).toBe("fmt");
    expect(project.imports[1]!.path).toBe("net/http");
    expect(project.imports[2]!.path).toBe("github.com/sirupsen/logrus");
    expect(project.imports[2]!.alias).toBe("log");
    expect(project.imports[3]!.path).toBe("github.com/lib/pq");
    expect(project.imports[3]!.sideEffect).toBe(true);
  });

  it("extracts structs with fields", () => {
    const project = analyzeSource(`
package main

type User struct {
	Name  string
	Email string ` + "`" + `json:"email"` + "`" + `
	Age   int
}
`);
    expect(project.structs).toHaveLength(1);
    const s = project.structs[0]!;
    expect(s.name).toBe("User");
    expect(s.exported).toBe(true);
    expect(s.fields).toHaveLength(3);
    expect(s.fields[0]!.name).toBe("Name");
    expect(s.fields[0]!.type).toBe("string");
    expect(s.fields[1]!.tag).toBe(`json:"email"`);
  });

  it("detects embedded structs", () => {
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
    expect(project.structs).toHaveLength(2);
    const user = project.structs[1]!;
    expect(user.embeds).toHaveLength(1);
    expect(user.embeds[0]).toBe("Base");
    const embedField = user.fields.find(f => f.embedded);
    expect(embedField).toBeDefined();
    expect(embedField!.name).toBe("Base");
  });

  it("extracts interfaces", () => {
    const project = analyzeSource(`
package main

type Reader interface {
	Read(p []byte) (n int, err error)
}
`);
    expect(project.interfaces).toHaveLength(1);
    const iface = project.interfaces[0]!;
    expect(iface.name).toBe("Reader");
    expect(iface.exported).toBe(true);
    expect(iface.methods).toHaveLength(1);
    expect(iface.methods[0]!.name).toBe("Read");
  });

  it("extracts functions", () => {
    const project = analyzeSource(`
package main

func main() {
	fmt.Println("hello")
}

func add(a, b int) int {
	return a + b
}
`);
    expect(project.functions).toHaveLength(2);
    expect(project.functions[0]!.name).toBe("main");
    expect(project.functions[0]!.exported).toBe(false);
    expect(project.functions[1]!.name).toBe("add");
    expect(project.functions[1]!.exported).toBe(false);
  });

  it("extracts methods with receivers", () => {
    const project = analyzeSource(`
package main

type Server struct {
	port int
}

func (s *Server) Start() error {
	return nil
}

func (s Server) Port() int {
	return s.port
}
`);
    expect(project.methods).toHaveLength(2);
    const start = project.methods[0]!;
    expect(start.name).toBe("Server.Start");
    expect(start.receiverType).toBe("Server");
    expect(start.pointerReceiver).toBe(true);
    expect(start.exported).toBe(true);
    const port = project.methods[1]!;
    expect(port.pointerReceiver).toBe(false);
  });

  it("extracts constants", () => {
    const project = analyzeSource(`
package main

const (
	MaxRetries = 3
	Timeout    = 30
)
`);
    expect(project.constants).toHaveLength(2);
    expect(project.constants[0]!.name).toBe("MaxRetries");
    expect(project.constants[0]!.exported).toBe(true);
    expect(project.constants[0]!.value).toBe("3");
  });

  it("extracts variables", () => {
    const project = analyzeSource(`
package main

var (
	defaultPort int
	Version     string
)
`);
    expect(project.variables).toHaveLength(2);
    expect(project.variables[0]!.name).toBe("defaultPort");
    expect(project.variables[0]!.exported).toBe(false);
    expect(project.variables[1]!.name).toBe("Version");
    expect(project.variables[1]!.exported).toBe(true);
  });

  it("extracts function calls", () => {
    const project = analyzeSource(`
package main

import "fmt"

func main() {
	fmt.Println("hello")
	doWork()
}

func doWork() {}
`);
    expect(project.calls.length).toBeGreaterThanOrEqual(2);
    const println = project.calls.find(c => c.methodName === "Println");
    expect(println).toBeDefined();
    expect(println!.receiverName).toBe("fmt");
    const doWork = project.calls.find(c => c.calleeName === "doWork");
    expect(doWork).toBeDefined();
  });

  it("extracts type aliases", () => {
    const project = analyzeSource(`
package main

type StringSlice = []string
type Handler func(w ResponseWriter, r *Request)
`);
    expect(project.typeAliases).toHaveLength(2);
    expect(project.typeAliases[0]!.name).toBe("StringSlice");
    expect(project.typeAliases[0]!.isAlias).toBe(true);
    expect(project.typeAliases[1]!.name).toBe("Handler");
    expect(project.typeAliases[1]!.isAlias).toBe(false);
  });

  it("handles exported vs unexported correctly", () => {
    const project = analyzeSource(`
package main

type PublicStruct struct {}
type privateStruct struct {}

func PublicFunc() {}
func privateFunc() {}
`);
    const pub = project.structs.find(s => s.name === "PublicStruct");
    const priv = project.structs.find(s => s.name === "privateStruct");
    expect(pub!.exported).toBe(true);
    expect(priv!.exported).toBe(false);

    const pubFn = project.functions.find(f => f.name === "PublicFunc");
    const privFn = project.functions.find(f => f.name === "privateFunc");
    expect(pubFn!.exported).toBe(true);
    expect(privFn!.exported).toBe(false);
  });

  it("handles empty source gracefully", () => {
    const project = analyzeSource(`package main`);
    expect(project.files).toHaveLength(1);
    expect(project.structs).toHaveLength(0);
    expect(project.functions).toHaveLength(0);
  });

  it("reports file count in metadata", () => {
    const project = analyzeGoProject({
      root: "/test",
      files: ["a.go", "b.go"],
      sourceProvider: (p) => p.includes("a.go")
        ? "package main\nfunc A() {}"
        : "package main\nfunc B() {}",
    });
    expect(project.metadata.fileCount).toBe(2);
    expect(project.functions).toHaveLength(2);
  });
});
