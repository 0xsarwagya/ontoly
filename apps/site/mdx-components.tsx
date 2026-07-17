import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";

function slug(children: React.ReactNode): string {
  return String(children)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => <h1 className="doc-h1">{children}</h1>,
    h2: ({ children }) => {
      const id = slug(children);
      return <h2 id={id} className="doc-h2"><a href={`#${id}`} className="doc-anchor">{children}</a></h2>;
    },
    h3: ({ children }) => {
      const id = slug(children);
      return <h3 id={id} className="doc-h3"><a href={`#${id}`} className="doc-anchor">{children}</a></h3>;
    },
    p: ({ children }) => <p className="doc-p">{children}</p>,
    ul: ({ children }) => <ul className="doc-ul">{children}</ul>,
    ol: ({ children }) => <ol className="doc-ol">{children}</ol>,
    li: ({ children }) => <li className="doc-li">{children}</li>,
    a: ({ href, children }) => {
      const external = href?.startsWith("http");
      if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className="doc-a">{children}</a>;
      return <Link href={href ?? "#"} className="doc-a">{children}</Link>;
    },
    strong: ({ children }) => <strong className="doc-strong">{children}</strong>,
    hr: () => <hr className="doc-hr" />,
    table: ({ children }) => <div className="doc-table-wrap"><table className="doc-table">{children}</table></div>,
    blockquote: ({ children }) => <div className="callout callout-note">{children}</div>,
    pre: (props) => <CodeBlock {...props} />,
    code: ({ children, className }) => {
      if (className) return <code className={className}>{children}</code>;
      return <code className="doc-inline-code">{children}</code>;
    },
    Callout,
    ...components,
  };
}
