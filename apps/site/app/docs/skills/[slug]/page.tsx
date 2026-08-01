import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { SITE, SKILLS } from "@/lib/site";

interface Params {
  slug: string;
}

export function generateStaticParams(): Params[] {
  return SKILLS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const skill = SKILLS.find((s) => s.slug === slug);
  if (!skill) return {};
  const title = `${skill.name} · Ontoly Skill`;
  const description = skill.description;
  const url = `${SITE.url}/docs/skills/${skill.slug}`;
  return {
    title,
    description,
    alternates: { canonical: `/docs/skills/${skill.slug}` },
    openGraph: {
      title,
      description,
      url,
      images: [
        {
          url: "/assets/agent-skills-diagram.svg",
          width: 1200,
          height: 630,
          alt: `Ontoly ${skill.name} Skill`,
        },
      ],
    },
    keywords: [
      `${skill.name} skill`,
      "Ontoly Skill",
      "AI agent skill",
      "Claude Code skill",
      "Cursor skill",
      ...skill.capabilities.map((c) => `${c} MCP capability`),
    ],
  };
}

function skillJsonLd(skill: (typeof SKILLS)[number]) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Ontoly ${skill.name} Skill`,
    applicationCategory: "DeveloperApplication",
    description: skill.description,
    url: `${SITE.url}/docs/skills/${skill.slug}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    softwareVersion: SITE.version,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const skill = SKILLS.find((s) => s.slug === slug);
  if (!skill) notFound();

  const installOne = `npx skills add 0xsarwagya/ontoly --skill ${skill.slug}`;
  const installAll = `npx skills add 0xsarwagya/ontoly`;

  return (
    <>
      {skillJsonLd(skill)}
      <div className="skill-detail">
        <span className="eyebrow">
          <Link href="/docs/skills">Skills</Link> · {skill.category}
        </span>
        <h1>{skill.name}</h1>
        <p className="lead">{skill.description}</p>

        <h2>MCP capabilities</h2>
        <p>
          This skill orchestrates the following Ontoly MCP capabilities. Every
          answer is grounded in graph evidence — node ids, typed edges, source
          spans, and a reproducible graph hash.
        </p>
        <ul>
          {skill.capabilities.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>

        <h2>Install</h2>
        <p>
          Install just this skill into any agent supported by{" "}
          <a
            href={SITE.skillsSh}
            target="_blank"
            rel="noopener noreferrer"
          >
            skills.sh
          </a>{" "}
          — Claude Code, Cursor, GitHub Copilot, and more:
        </p>
        <div className="cli-row">
          <code>{installOne}</code>
          <CopyButton text={installOne} />
        </div>
        <p>Or install every Ontoly skill in one command:</p>
        <div className="cli-row">
          <code>{installAll}</code>
          <CopyButton text={installAll} />
        </div>

        <h2>How it works</h2>
        <p>
          Skills teach workflow only. When the agent invokes {skill.name}, it
          calls the MCP capabilities listed above against a deterministic
          Software Graph — never inferring relationships with an LLM. The
          agent then reasons over the returned evidence.
        </p>
        <p>
          See <Link href="/docs/mcp">MCP</Link> for how capabilities are
          exposed to agents,{" "}
          <Link href="/docs/llm-enhancement">LLM Enhancement</Link> for the
          workflow contract, and the full{" "}
          <Link href="/skills">Skills catalog</Link> for every skill Ontoly
          ships.
        </p>

        <h2>Version</h2>
        <p>
          Current: <code>v{SITE.version}</code>. Requires Ontoly ≥{" "}
          <code>{SITE.version}</code>. See the{" "}
          <a
            href={`${SITE.repo}/blob/main/skills/COMPATIBILITY_MATRIX.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Skill Compatibility Matrix
          </a>{" "}
          for details.
        </p>

        <h2>Related skills</h2>
        <ul>
          {SKILLS.filter(
            (s) => s.slug !== skill.slug && s.category === skill.category,
          )
            .slice(0, 4)
            .map((s) => (
              <li key={s.slug}>
                <Link href={`/docs/skills/${s.slug}`}>{s.name}</Link> —{" "}
                {s.description}
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}
