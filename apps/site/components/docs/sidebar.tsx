"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs-nav";
import { DocsSearch } from "@/components/docs/search";
import { VersionSelector } from "@/components/docs/chrome";

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <aside className="docs-sidebar">
      <div className="docs-sidebar-inner">
        <div className="docs-sidebar-top">
          <DocsSearch />
          <VersionSelector />
        </div>
        <nav aria-label="Documentation">
          {DOCS_NAV.map((group) => (
            <div className="docs-group" key={group.title}>
              <div className="docs-group-title">{group.title}</div>
              <ul>
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  if (item.soon) {
                    return (
                      <li key={item.href}>
                        <span className="docs-link soon" aria-disabled="true">
                          {item.title}<span className="soon-badge">soon</span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <Link className={`docs-link${active ? " active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
