import type { ReactNode } from "react";

type Variant = "note" | "warning" | "tip";

const ICON: Record<Variant, ReactNode> = {
  note: <path d="M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  warning: <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
  tip: <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />,
};

const LABEL: Record<Variant, string> = { note: "Note", warning: "Warning", tip: "Tip" };

export function Callout({ type = "note", title, children }: { type?: Variant; title?: string; children: ReactNode }) {
  return (
    <div className={`callout callout-${type}`}>
      <div className="callout-head">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[type]}</svg>
        <span>{title ?? LABEL[type]}</span>
      </div>
      <div className="callout-body">{children}</div>
    </div>
  );
}
