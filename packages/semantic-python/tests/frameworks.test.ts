import { describe, expect, it } from "vitest";
import {
  createDjangoAnalyzer,
  createFastApiAnalyzer,
  createPyTorchAnalyzer,
  createTensorFlowAnalyzer,
  createHuggingFaceAnalyzer,
  createScikitLearnAnalyzer,
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

describe("PyTorch analyzer", () => {
  const analyzer = createPyTorchAnalyzer();

  it("detects PyTorch by imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import torch
import torch.nn as nn
`);
    expect(detection.detected).toBe(true);
    expect(detection.framework).toBe("PyTorch");
    expect(detection.confidence).toBe("exact");
  });

  it("does not detect when no PyTorch imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import numpy as np
`);
    expect(detection.detected).toBe(false);
  });

  it("identifies nn.Module models", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import torch
import torch.nn as nn

class ResNet(nn.Module):
    def __init__(self):
        super().__init__()

    def forward(self, x):
        return x

class Transformer(nn.Module):
    def forward(self, src, tgt):
        pass
`);
    const providers = facts.filter((f) => f.kind === "ProviderDeclared");
    expect(providers).toHaveLength(2);
    expect((providers[0] as any).metadata.mlKind).toBe("model");
  });

  it("identifies Dataset subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import torch
from torch.utils.data import Dataset

class ImageDataset(Dataset):
    def __len__(self):
        return 100
    def __getitem__(self, idx):
        pass
`);
    const datasets = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "dataset",
    );
    expect(datasets).toHaveLength(1);
  });

  it("identifies torch.no_grad decorated functions", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import torch

@torch.no_grad
def evaluate(model, data):
    pass
`);
    const optimized = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "optimized-function",
    );
    expect(optimized).toHaveLength(1);
  });
});

describe("TensorFlow analyzer", () => {
  const analyzer = createTensorFlowAnalyzer();

  it("detects TensorFlow by imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import tensorflow as tf
`);
    expect(detection.detected).toBe(true);
    expect(detection.framework).toBe("TensorFlow");
  });

  it("detects Keras standalone imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import keras
from keras.layers import Dense
`);
    expect(detection.detected).toBe(true);
  });

  it("does not detect when no TF imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import torch
`);
    expect(detection.detected).toBe(false);
  });

  it("identifies keras.Model subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import tensorflow as tf
from keras import Model

class Autoencoder(Model):
    def call(self, x):
        return x
`);
    const models = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "model",
    );
    expect(models).toHaveLength(1);
  });

  it("identifies Layer subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import tensorflow as tf
from keras.layers import Layer

class CustomAttention(Layer):
    def call(self, inputs):
        pass
`);
    const layers = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "layer",
    );
    expect(layers).toHaveLength(1);
  });

  it("identifies Callback subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import tensorflow as tf
from keras.callbacks import Callback

class EarlyStopOnNaN(Callback):
    def on_epoch_end(self, epoch, logs):
        pass
`);
    const callbacks = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "callback",
    );
    expect(callbacks).toHaveLength(1);
  });

  it("identifies @tf.function decorated functions", () => {
    const { facts } = detectAndAnalyze(analyzer, `
import tensorflow as tf

@tf.function
def train_step(data):
    pass
`);
    const graphFns = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "graph-function",
    );
    expect(graphFns).toHaveLength(1);
  });
});

describe("HuggingFace Transformers analyzer", () => {
  const analyzer = createHuggingFaceAnalyzer();

  it("detects HuggingFace by imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
from transformers import AutoModel
`);
    expect(detection.detected).toBe(true);
    expect(detection.framework).toBe("HuggingFace Transformers");
  });

  it("does not detect when no HF imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import torch
`);
    expect(detection.detected).toBe(false);
  });

  it("identifies PreTrainedModel subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from transformers import PreTrainedModel

class CustomBert(PreTrainedModel):
    def forward(self, input_ids):
        pass
`);
    const models = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "model",
    );
    expect(models).toHaveLength(1);
  });

  it("identifies Trainer subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from transformers import Trainer

class CustomTrainer(Trainer):
    def compute_loss(self, model, inputs):
        pass
`);
    const trainers = facts.filter((f) => f.kind === "ControllerDeclared");
    expect(trainers).toHaveLength(1);
    expect((trainers[0] as any).metadata.mlKind).toBe("trainer");
  });

  it("identifies PreTrainedTokenizer subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from transformers import PreTrainedTokenizer

class CustomTokenizer(PreTrainedTokenizer):
    pass
`);
    const tokenizers = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "tokenizer",
    );
    expect(tokenizers).toHaveLength(1);
  });

  it("identifies pipeline calls", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from transformers import pipeline

def load_model():
    return pipeline("sentiment-analysis")
`);
    const pipelines = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "pipeline",
    );
    expect(pipelines).toHaveLength(1);
  });
});

describe("scikit-learn analyzer", () => {
  const analyzer = createScikitLearnAnalyzer();

  it("detects scikit-learn by imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
from sklearn.linear_model import LogisticRegression
`);
    expect(detection.detected).toBe(true);
    expect(detection.framework).toBe("scikit-learn");
  });

  it("does not detect when no sklearn imports", () => {
    const { detection } = detectAndAnalyze(analyzer, `
import pandas as pd
`);
    expect(detection.detected).toBe(false);
  });

  it("identifies BaseEstimator subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from sklearn.base import BaseEstimator, ClassifierMixin

class CustomClassifier(BaseEstimator, ClassifierMixin):
    def fit(self, X, y):
        pass
    def predict(self, X):
        pass
`);
    const estimators = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "estimator",
    );
    expect(estimators).toHaveLength(1);
  });

  it("identifies TransformerMixin subclasses", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from sklearn.base import BaseEstimator, TransformerMixin

class CustomScaler(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        pass
    def transform(self, X):
        pass
`);
    const transformers = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "transformer",
    );
    expect(transformers).toHaveLength(1);
  });

  it("identifies Pipeline calls", () => {
    const { facts } = detectAndAnalyze(analyzer, `
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

def build_pipeline():
    return Pipeline([("scaler", StandardScaler()), ("svc", SVC())])
`);
    const pipelines = facts.filter(
      (f) => f.kind === "ProviderDeclared" && (f as any).metadata?.mlKind === "pipeline",
    );
    expect(pipelines).toHaveLength(1);
  });
});
