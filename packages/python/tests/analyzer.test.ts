import { describe, expect, it } from "vitest";
import { analyzePythonProject, type PythonProject } from "@0xsarwagya/ontoly-python";

function analyzeSource(source: string): PythonProject {
  return analyzePythonProject({
    root: "/test",
    files: ["main.py"],
    sourceProvider: () => source,
  });
}

describe("analyzePythonProject", () => {
  it("extracts module-level functions", () => {
    const project = analyzeSource(`
def greet(name):
    print(name)

def add(a, b):
    return a + b
`);
    expect(project.functions).toHaveLength(2);
    expect(project.functions[0]!.name).toBe("greet");
    expect(project.functions[1]!.name).toBe("add");
  });

  it("extracts async functions", () => {
    const project = analyzeSource(`
async def fetch_data(url: str) -> dict:
    return {}
`);
    expect(project.functions).toHaveLength(1);
    expect(project.functions[0]!.async).toBe(true);
    expect(project.functions[0]!.name).toBe("fetch_data");
  });

  it("extracts function parameters with type annotations", () => {
    const project = analyzeSource(`
def process(x: int, y: str = 'default', *args, **kwargs) -> bool:
    pass
`);
    const func = project.functions[0]!;
    expect(func.returnAnnotation).toBe("bool");
    expect(func.parameters).toHaveLength(4);
    expect(func.parameters[0]).toMatchObject({ name: "x", annotation: "int", kind: "positional" });
    expect(func.parameters[1]).toMatchObject({ name: "y", annotation: "str", kind: "positional" });
    expect(func.parameters[2]).toMatchObject({ name: "args", kind: "star" });
    expect(func.parameters[3]).toMatchObject({ name: "kwargs", kind: "double_star" });
  });

  it("extracts classes with bases", () => {
    const project = analyzeSource(`
class Animal:
    pass

class Dog(Animal, Serializable):
    pass
`);
    expect(project.classes).toHaveLength(2);
    expect(project.classes[0]!.name).toBe("Animal");
    expect(project.classes[0]!.bases).toEqual([]);
    expect(project.classes[1]!.name).toBe("Dog");
    expect(project.classes[1]!.bases).toEqual(["Animal", "Serializable"]);
  });

  it("extracts methods from classes", () => {
    const project = analyzeSource(`
class MyClass:
    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        return self.name

    async def fetch(self):
        pass
`);
    expect(project.methods).toHaveLength(3);
    expect(project.methods[0]!.methodName).toBe("__init__");
    expect(project.methods[0]!.className).toBe("MyClass");
    expect(project.methods[1]!.methodName).toBe("greet");
    expect(project.methods[1]!.returnAnnotation).toBe("str");
    expect(project.methods[2]!.async).toBe(true);
  });

  it("detects static methods, classmethods, and properties", () => {
    const project = analyzeSource(`
class Service:
    @staticmethod
    def create():
        pass

    @classmethod
    def from_config(cls, config):
        pass

    @property
    def name(self) -> str:
        return "test"
`);
    expect(project.methods).toHaveLength(3);
    expect(project.methods[0]!.static).toBe(true);
    expect(project.methods[1]!.classmethod).toBe(true);
    expect(project.methods[2]!.property).toBe(true);
  });

  it("extracts import statements", () => {
    const project = analyzeSource(`
import os
import sys
`);
    expect(project.imports).toHaveLength(2);
    expect(project.imports[0]!.module).toBe("os");
    expect(project.imports[0]!.relative).toBe(false);
    expect(project.imports[1]!.module).toBe("sys");
  });

  it("extracts from-import statements", () => {
    const project = analyzeSource(`
from typing import List, Optional
from os.path import join
`);
    expect(project.imports).toHaveLength(2);
    expect(project.imports[0]!.module).toBe("typing");
    expect(project.imports[0]!.names).toEqual([
      { name: "List" },
      { name: "Optional" },
    ]);
    expect(project.imports[1]!.module).toBe("os.path");
    expect(project.imports[1]!.names).toEqual([{ name: "join" }]);
  });

  it("extracts relative imports", () => {
    const project = analyzeSource(`
from . import utils
from ..models import User
from ...core import Base
`);
    expect(project.imports).toHaveLength(3);
    expect(project.imports[0]!.relative).toBe(true);
    expect(project.imports[0]!.relativeLevel).toBe(1);
    expect(project.imports[1]!.relative).toBe(true);
    expect(project.imports[1]!.relativeLevel).toBe(2);
    expect(project.imports[1]!.module).toBe("models");
    expect(project.imports[2]!.relativeLevel).toBe(3);
  });

  it("extracts decorators on functions", () => {
    const project = analyzeSource(`
@app.route('/api', methods=['GET'])
def handler():
    pass
`);
    expect(project.functions).toHaveLength(1);
    expect(project.functions[0]!.decorators).toHaveLength(1);
    expect(project.functions[0]!.decorators[0]!.name).toBe("app.route");
    expect(project.decorators).toHaveLength(1);
  });

  it("extracts decorators on classes", () => {
    const project = analyzeSource(`
@dataclass
class Config:
    name: str
    value: int
`);
    expect(project.classes).toHaveLength(1);
    expect(project.classes[0]!.decorators).toHaveLength(1);
    expect(project.classes[0]!.decorators[0]!.name).toBe("dataclass");
  });

  it("extracts function calls", () => {
    const project = analyzeSource(`
def process():
    result = compute(1, 2)
    db.query(User).filter()
`);
    expect(project.calls.length).toBeGreaterThanOrEqual(1);
    const computeCall = project.calls.find(c => c.calleeName === "compute");
    expect(computeCall).toBeDefined();
    expect(computeCall!.argumentCount).toBe(2);
  });

  it("extracts module-level variables", () => {
    const project = analyzeSource(`
name: str = 'hello'
count = 42
`);
    expect(project.variables).toHaveLength(2);
    expect(project.variables[0]!.name).toBe("name");
    expect(project.variables[0]!.annotation).toBe("str");
    expect(project.variables[1]!.name).toBe("count");
  });

  it("creates source file entries", () => {
    const project = analyzeSource(`x = 1`);
    expect(project.files).toHaveLength(1);
    expect(project.files[0]!.file).toBe("main.py");
  });

  it("handles syntax errors gracefully", () => {
    const project = analyzeSource(`
def valid():
    pass

def broken(
    # missing closing paren and body

def also_valid():
    pass
`);
    expect(project.metadata.parseErrors).toBe(1);
    expect(project.functions.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty files", () => {
    const project = analyzeSource("");
    expect(project.files).toHaveLength(1);
    expect(project.functions).toHaveLength(0);
    expect(project.classes).toHaveLength(0);
  });

  it("handles multiple files", () => {
    const sources: Record<string, string> = {
      "a.py": "def foo(): pass",
      "b.py": "def bar(): pass",
    };
    const project = analyzePythonProject({
      root: "/test",
      files: ["a.py", "b.py"],
      sourceProvider: (path: string) => {
        const name = path.replace("/test/", "");
        return sources[name];
      },
    });
    expect(project.files).toHaveLength(2);
    expect(project.functions).toHaveLength(2);
    expect(project.metadata.fileCount).toBe(2);
  });

  it("extracts class-level assignments", () => {
    const project = analyzeSource(`
class Config:
    DEBUG: bool = True
    HOST: str = 'localhost'
`);
    expect(project.assignments.length).toBeGreaterThanOrEqual(2);
    const debugAssign = project.assignments.find(a => a.target === "DEBUG");
    expect(debugAssign).toBeDefined();
    expect(debugAssign!.annotation).toBe("bool");
  });
});
