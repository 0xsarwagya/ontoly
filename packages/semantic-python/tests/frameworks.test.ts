import { describe, expect, it } from "vitest";
import {
  createDjangoAnalyzer,
  createFastApiAnalyzer,
  type PythonFrameworkAnalyzer,
} from "@0xsarwagya/ontoly-semantic-python";
import { analyzePythonProject } from "@0xsarwagya/ontoly-python";
import type { PythonProject } from "@0xsarwagya/ontoly-python";

function analyzeSource(source: string): PythonProject {
  return analyzePythonProject({
    root: "/test",
    files: ["app.py"],
    sourceProvider: () => source,
  });
}

function detectAndAnalyze(analyzer: PythonFrameworkAnalyzer, source: string) {
  const project = analyzeSource(source);
  return {
    detection: analyzer.detect(project),
    facts: analyzer.analyze(project),
    project,
  };
}

describe("Django analyzer", () => {
  const analyzer = createDjangoAnalyzer();

  it("detects Django by imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
from django.db import models
from django.http import HttpResponse
`);
    expect(detection.detected).toBe(true);
    expect(detection.framework).toBe("Django");
    expect(detection.confidence).toBe("exact");
  });

  it("does not detect when no Django imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import os
import sys
`);
    expect(detection.detected).toBe(false);
  });

  it("identifies Django models", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()

class Post(models.Model):
    title = models.CharField(max_length=200)
`);
    const providers = facts.filter((f) => f.kind === "ProviderDeclared");
    expect(providers).toHaveLength(2);
  });

  it("identifies class-based views", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from django.views import View

class HomeView(View):
    def get(self, request):
        pass

class UserListView(ListView):
    model = User
`);
    const controllers = facts.filter((f) => f.kind === "ControllerDeclared");
    expect(controllers).toHaveLength(2);
  });

  it("identifies function-based views", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from django.http import HttpResponse

def index(request):
    return HttpResponse("Hello")
`);
    const controllers = facts.filter((f) => f.kind === "ControllerDeclared");
    expect(controllers).toHaveLength(1);
  });

  it("identifies middleware", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from django.utils.deprecation import MiddlewareMixin

class AuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        pass
`);
    const middleware = facts.filter((f) => f.kind === "MiddlewareRegistered");
    expect(middleware).toHaveLength(1);
  });
});

describe("FastAPI analyzer", () => {
  const analyzer = createFastApiAnalyzer();

  it("detects FastAPI by imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
from fastapi import FastAPI
`);
    expect(detection.detected).toBe(true);
    expect(detection.framework).toBe("FastAPI");
    expect(detection.confidence).toBe("exact");
  });

  it("does not detect when no FastAPI imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import flask
`);
    expect(detection.detected).toBe(false);
  });

  it("identifies route decorators", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from fastapi import FastAPI

app = FastAPI()

@app.get('/users')
def list_users():
    return []

@app.post('/users')
async def create_user(user: UserCreate):
    return user
`);
    const routes = facts.filter((f) => f.kind === "RouteDeclared");
    expect(routes).toHaveLength(2);
    expect(routes[0]!.kind === "RouteDeclared" && routes[0]!.method).toBe("GET");
    expect(routes[1]!.kind === "RouteDeclared" && routes[1]!.method).toBe("POST");
  });

  it("identifies Pydantic models", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from fastapi import FastAPI
from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str

class UserResponse(BaseModel):
    id: int
    name: str
`);
    const providers = facts.filter((f) => f.kind === "ProviderDeclared");
    expect(providers).toHaveLength(2);
  });

  it("identifies dependency injection via Depends", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from fastapi import FastAPI, Depends

def get_db():
    pass

@app.get('/items')
def list_items(db = Depends(get_db)):
    pass
`);
    const deps = facts.filter((f) => f.kind === "DependencyInjected");
    expect(deps).toHaveLength(1);
  });
});
