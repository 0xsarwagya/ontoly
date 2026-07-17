"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs-nav";

type Entry = { title: string; href: string; group: string; soon?: boolean };

const ENTRIES: Entry[] = DOCS_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

export function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pool = ENTRIES.filter((e) => !e.soon);
    if (!query) return pool.slice(0, 8);
    return pool.filter((e) => `${e.title} ${e.group}`.toLowerCase().includes(query)).slice(0, 12);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  useEffect(() => { setSel(0); }, [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); go(results[sel].href); }
  };

  return (
    <>
      <button className="docs-search-trigger" onClick={() => setOpen(true)} aria-label="Search documentation">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <span>Search docs</span>
        <kbd className="mono">⌘K</kbd>
      </button>

      {open && (
        <div className="cmdk-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Search documentation">
          <div className="cmdk" onClick={(e) => e.stopPropagation()}>
            <div className="cmdk-input-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey} placeholder="Search documentation…" aria-label="Search" />
              <kbd className="mono">esc</kbd>
            </div>
            <ul className="cmdk-list">
              {results.length === 0 && <li className="cmdk-empty">No results for “{q}”.</li>}
              {results.map((r, i) => (
                <li key={r.href}>
                  <button className={`cmdk-item${i === sel ? " active" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => go(r.href)}>
                    <span>{r.title}</span>
                    <span className="cmdk-group mono">{r.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
