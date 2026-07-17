import { NPM_PACKAGES } from "@/lib/site";

const REVALIDATE = 3600; // 1 hour ISR

function fmt(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

async function getRepo() {
  try {
    const r = await fetch("https://api.github.com/repos/0xsarwagya/ontoly", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: REVALIDATE },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      stars: typeof d.stargazers_count === "number" ? d.stargazers_count : null,
      license: d.license?.spdx_id && d.license.spdx_id !== "NOASSERTION" ? d.license.spdx_id : "MIT",
    };
  } catch {
    return null;
  }
}

async function getRelease() {
  try {
    const r = await fetch("https://api.github.com/repos/0xsarwagya/ontoly/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: REVALIDATE },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.tag_name === "string" ? d.tag_name.replace(/^v/, "") : null;
  } catch {
    return null;
  }
}

async function getContributors() {
  try {
    const r = await fetch("https://api.github.com/repos/0xsarwagya/ontoly/contributors?per_page=1&anon=1", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: REVALIDATE },
    });
    if (!r.ok) return null;
    const link = r.headers.get("Link");
    const m = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (m) return parseInt(m[1], 10);
    const arr = await r.json();
    return Array.isArray(arr) ? arr.length : null;
  } catch {
    return null;
  }
}

async function getDownloads() {
  try {
    const results = await Promise.allSettled(
      NPM_PACKAGES.map((pkg) =>
        fetch(`https://api.npmjs.org/downloads/point/last-month/${pkg}`, { next: { revalidate: REVALIDATE } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d && typeof d.downloads === "number" ? d.downloads : 0)),
      ),
    );
    let sum = 0, any = false;
    for (const res of results) {
      if (res.status === "fulfilled") { sum += res.value; if (res.value > 0) any = true; }
    }
    return any ? sum : null;
  } catch {
    return null;
  }
}

export async function GithubStats() {
  const [repo, release, contributors, downloads] = await Promise.all([
    getRepo(), getRelease(), getContributors(), getDownloads(),
  ]);

  const cells = [
    { v: fmt(repo?.stars ?? null), k: "Stars", tnum: true },
    { v: release ?? "rc.5", k: "Latest release", mono: true },
    { v: repo?.license ?? "MIT", k: "License" },
    { v: fmt(contributors ?? null), k: "Contributors", tnum: true },
    { v: fmt(downloads ?? null), k: "Downloads / mo", tnum: true },
  ];

  return (
    <section className="band tight" id="open-source">
      <div className="wrap">
        <div className="gh-head reveal">
          <span className="eyebrow">Open source</span>
          <span className="gh-live"><span className="dot" /> live · GitHub &amp; npm</span>
        </div>
        <div className="gh reveal">
          {cells.map((c) => (
            <div className="gcell" key={c.k}>
              <span className={`v${c.tnum ? " tnum" : ""}${c.mono ? " mono" : ""}`}>{c.v}</span>
              <span className="k">{c.k}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
