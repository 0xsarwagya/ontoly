"use client";
import { useEffect, useRef } from "react";
import { EDGE_TYPES } from "@/lib/site";

type Node = { x: number; y: number; r: number; label: string; kind: string };

const NODES: Node[] = [
  { x: 0.5, y: 0.16, r: 16, label: "Route", kind: "route" },
  { x: 0.28, y: 0.34, r: 20, label: "Controller", kind: "ctrl" },
  { x: 0.72, y: 0.32, r: 14, label: "Module", kind: "mod" },
  { x: 0.5, y: 0.5, r: 24, label: "Service", kind: "svc" },
  { x: 0.22, y: 0.66, r: 14, label: "Repository", kind: "repo" },
  { x: 0.78, y: 0.6, r: 13, label: "TokenSvc", kind: "svc2" },
  { x: 0.44, y: 0.82, r: 12, label: "Job", kind: "job" },
  { x: 0.66, y: 0.82, r: 12, label: "Decorator", kind: "dec" },
  { x: 0.86, y: 0.44, r: 11, label: "jsonwebtoken", kind: "pkg" },
];
const EDGES = [
  { a: 0, b: 1, type: "mounts" }, { a: 1, b: 3, type: "calls" }, { a: 2, b: 3, type: "injects" },
  { a: 3, b: 4, type: "injects" }, { a: 3, b: 5, type: "calls" }, { a: 5, b: 8, type: "imports" },
  { a: 3, b: 6, type: "calls" }, { a: 7, b: 3, type: "decorates" }, { a: 1, b: 2, type: "imports" },
];

export function HeroGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    let pal: Record<string, string> = {};
    const loadPalette = () => {
      pal = {
        calls: cssVar("--e-calls"), imports: cssVar("--e-imports"), injects: cssVar("--e-injects"),
        mounts: cssVar("--e-mounts"), decorates: cssVar("--e-decorates"),
        node: cssVar("--panel"), nodeStroke: cssVar("--border-strong"), text: cssVar("--muted"), accent: cssVar("--accent-2"),
        fontMono: cssVar("--font-mono"),
      };
    };
    loadPalette();
    const onTheme = () => loadPalette();
    window.addEventListener("ontoly-theme", onTheme);

    const phase = NODES.map((_, i) => i * 1.7);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const pos = (n: Node, i: number, t: number) => ({
      x: n.x * W + Math.sin(t * 0.6 + phase[i]) * 5,
      y: n.y * H + Math.cos(t * 0.5 + phase[i] * 1.3) * 5,
    });
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const P = NODES.map((n, i) => pos(n, i, t));
      EDGES.forEach((e) => {
        const A = P[e.a], B = P[e.b], col = pal[e.type] || pal.accent;
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.4;
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - 14;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(mx, my, B.x, B.y); ctx.stroke();
        const prog = (t * 0.25 + (e.a * 0.13 + e.b * 0.07)) % 1;
        const px = (1 - prog) * (1 - prog) * A.x + 2 * (1 - prog) * prog * mx + prog * prog * B.x;
        const py = (1 - prog) * (1 - prog) * A.y + 2 * (1 - prog) * prog * my + prog * prog * B.y;
        ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 2.1, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      NODES.forEach((n, i) => {
        const p = P[i], r = n.r * (1 + Math.sin(t * 1.1 + phase[i]) * 0.04);
        if (n.kind === "svc") {
          const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 2.6);
          g.addColorStop(0, pal.accent + "55"); g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = pal.node; ctx.strokeStyle = n.kind === "svc" ? pal.accent : pal.nodeStroke;
        ctx.lineWidth = n.kind === "svc" ? 2 : 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = n.kind === "svc" || n.kind === "ctrl" ? pal.accent : pal.text;
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = pal.text; ctx.font = `10px ${pal.fontMono}`; ctx.textAlign = "center";
        ctx.fillText(n.label, p.x, p.y + r + 12);
      });
    };

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => { draw((now - start) / 1000); raf = requestAnimationFrame(loop); };
    resize();
    if (reduce) draw(0.6);
    else raf = requestAnimationFrame(loop);

    const onResize = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); resize(); if (reduce) draw(0.6); };
    window.addEventListener("resize", onResize);
    const vio = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) { if (!reduce && !raf) raf = requestAnimationFrame(loop); }
        else if (raf) { cancelAnimationFrame(raf); raf = 0; }
      });
    }, { threshold: 0.05 }) : null;
    vio?.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("ontoly-theme", onTheme);
      vio?.disconnect();
    };
  }, []);

  return (
    <div className="graph-card">
      <canvas ref={canvasRef} role="img" aria-label="Animated Software Graph of connected nodes with typed edges: CALLS, IMPORTS, INJECTS, MOUNTS, DECORATES" />
      <div className="graph-hash mono">graph · 0eaau5s</div>
      <div className="graph-legend" aria-hidden="true">
        {EDGE_TYPES.map((e) => (
          <span className="lg" key={e.name}><span className="sw" style={{ background: `var(${e.varName})` }} />{e.name}</span>
        ))}
      </div>
    </div>
  );
}
