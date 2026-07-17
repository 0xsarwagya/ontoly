"use client";
import { useRef, useState, type ComponentPropsWithoutRef, type ReactElement } from "react";

function langOf(children: unknown): string | null {
  const el = children as ReactElement<{ className?: string }> | undefined;
  const cls = el?.props?.className ?? "";
  const m = /language-([a-z0-9]+)/.exec(cls);
  return m ? m[1] : null;
}

export function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  const [done, setDone] = useState(false);
  const lang = langOf(children);

  const copy = () => {
    const text = ref.current?.innerText ?? "";
    const finish = () => { setDone(true); setTimeout(() => setDone(false), 1200); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(finish, finish);
    else finish();
  };

  return (
    <div className="code-wrap">
      <div className="code-bar">
        <span className="code-lang mono">{lang ?? "text"}</span>
        <button className={`code-copy${done ? " done" : ""}`} onClick={copy} aria-label="Copy code">
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre ref={ref} className="doc-pre" {...props}>{children}</pre>
    </div>
  );
}
