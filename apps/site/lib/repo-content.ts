import { marked } from "marked";

const RAW = "https://raw.githubusercontent.com/0xsarwagya/ontoly/main";
const REVALIDATE = 3600; // keep in sync with the repo hourly

marked.setOptions({ gfm: true, breaks: false });

export type Section = { title: string; bodyHtml: string };
export type RepoDoc = { intro: string; sections: Section[] } | null;

async function fetchRaw(path: string): Promise<string | null> {
  try {
    const r = await fetch(`${RAW}/${path}`, { next: { revalidate: REVALIDATE } });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/** Split a markdown doc on level-2 headings into an intro + titled sections. */
export async function getRepoDoc(path: string): Promise<RepoDoc> {
  const md = await fetchRaw(path);
  if (!md) return null;

  const parts = md.split(/\n(?=##\s)/);
  const introRaw = (parts.shift() ?? "").replace(/^#\s+.*\n?/, "").trim();
  const intro = introRaw ? await marked.parse(introRaw) : "";

  const sections: Section[] = [];
  for (const part of parts) {
    const heading = part.match(/^##\s+(.*)/);
    const title = heading ? heading[1].trim() : "";
    const body = part.replace(/^##\s+.*\n?/, "");
    sections.push({ title, bodyHtml: await marked.parse(body) });
  }
  return { intro, sections };
}
