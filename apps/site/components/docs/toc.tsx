"use client";
import { useEffect, useState } from "react";

type Heading = { id: string; text: string; level: number };

export function DocsToc() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const root = document.querySelector("[data-docs-content]");
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("h2, h3")).filter((h) => h.id);
    setHeadings(nodes.map((h) => ({ id: h.id, text: h.textContent ?? "", level: h.tagName === "H3" ? 3 : 2 })));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0.1 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  if (headings.length === 0) return <aside className="docs-toc" aria-hidden="true" />;

  return (
    <aside className="docs-toc">
      <div className="docs-toc-inner">
        <div className="docs-toc-title">On this page</div>
        <ul>
          {headings.map((h) => (
            <li key={h.id} className={`toc-l${h.level}${active === h.id ? " active" : ""}`}>
              <a href={`#${h.id}`}>{h.text}</a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
