import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/site";
import { ScrollReveal } from "@/components/scroll-reveal";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Ontoly — Deterministic Software Graphs for AI Agents & Developers",
    template: "%s · Ontoly",
  },
  description: SITE.description,
  keywords: [...SITE.keywords],
  applicationName: "Ontoly",
  authors: [{ name: SITE.author, url: "https://sarwagya.wtf" }],
  creator: SITE.author,
  publisher: SITE.author,
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: "Ontoly",
    title: "Ontoly — Understand Any Codebase",
    description: SITE.shortDescription,
    images: [{ url: "/assets/social-preview.svg", width: 1200, height: 630, alt: "Ontoly — Deterministic Software Graphs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ontoly — Understand Any Codebase",
    description: SITE.shortDescription,
    images: ["/assets/social-preview.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: { icon: "/logo.svg", shortcut: "/logo.svg", apple: "/logo.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080B14" },
    { media: "(prefers-color-scheme: light)", color: "#F6F7FB" },
  ],
  colorScheme: "dark light",
};

function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Ontoly",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "macOS, Linux, Windows",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: SITE.description,
        url: SITE.url,
        downloadUrl: SITE.npm,
        softwareVersion: SITE.version,
        license: "https://opensource.org/licenses/MIT",
        author: { "@type": "Person", name: SITE.author, url: "https://sarwagya.wtf" },
        keywords: SITE.keywords.join(", "),
        sameAs: [SITE.repo, SITE.npm, SITE.skillsSh],
      },
      {
        "@type": "WebSite",
        name: "Ontoly",
        url: SITE.url,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE.url}/skills?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        name: "Ontoly",
        url: SITE.url,
        logo: `${SITE.url}/logo.svg`,
        sameAs: [SITE.repo, SITE.npm, SITE.skillsSh],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is Ontoly an AI tool?",
            acceptedAnswer: { "@type": "Answer", text: "No. Ontoly does not call language models. It builds a deterministic Software Graph — the same repository produces the same graph every time — that AI agents and developers can query with evidence." },
          },
          {
            "@type": "Question",
            name: "How do AI agents use Ontoly?",
            acceptedAnswer: { "@type": "Answer", text: "Through an MCP server and 14 portable Agent Skills installable into Claude Code, Cursor, GitHub Copilot and other agents. Every answer carries graph evidence — node ids, typed edges, source spans, and a reproducible graph hash." },
          },
          {
            "@type": "Question",
            name: "Does my source code leave my machine?",
            acceptedAnswer: { "@type": "Answer", text: "No. Ontoly is local-first. The graph is built and queried locally; no source code is uploaded." },
          },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body>
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important}.stagger.reveal>*{opacity:1 !important}.hero-copy>*,.hero-visual{opacity:1 !important;animation:none !important}`}</style>
        </noscript>
        <StructuredData />
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
