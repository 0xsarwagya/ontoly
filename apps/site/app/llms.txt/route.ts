import { SITE, SKILLS } from "@/lib/site";
import { DOCS_NAV } from "@/lib/docs-nav";

// https://llmstxt.org — a structured, LLM-friendly index of the site.
export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [];
  lines.push(`# Ontoly`);
  lines.push("");
  lines.push(`> ${SITE.description}`);
  lines.push("");
  lines.push(
    `Ontoly is a deterministic software intelligence engine. It compiles a repository into a typed, provenance-tracked Software Graph that developers and AI agents query with evidence. It does not call language models. Website: ${SITE.url}`,
  );
  lines.push("");

  lines.push(`## Documentation`);
  for (const group of DOCS_NAV) {
    for (const item of group.items) {
      if (item.soon) continue;
      const url = item.href.startsWith("http") ? item.href : `${SITE.url}${item.href}`;
      lines.push(`- [${item.title}](${url}): ${group.title}`);
    }
  }
  lines.push("");

  lines.push(`## AI Agent Skills`);
  lines.push(`- [All Skills](${SITE.url}/skills): 14 portable Agent Skills for Claude Code, Cursor, and Copilot`);
  lines.push(`- [skills.sh](${SITE.skillsSh}): install Ontoly skills from the marketplace`);
  for (const skill of SKILLS) {
    lines.push(`- [${skill.name}](${SITE.url}/skills#${skill.slug}): ${skill.description}`);
  }
  lines.push("");

  lines.push(`## Project`);
  lines.push(`- [GitHub](${SITE.repo}): source, issues, RFCs`);
  lines.push(`- [npm](${SITE.npm}): @0xsarwagya/ontoly-cli`);
  lines.push(`- [Roadmap](${SITE.url}/roadmap)`);
  lines.push(`- [Changelog](${SITE.url}/changelog)`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
