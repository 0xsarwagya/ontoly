"use client";
import { useEffect, useRef } from "react";

const LINES: [string, number][] = [
  ['<span class="prompt">$</span> <span class="cmd">ontoly build .</span>', 0],
  ['<span class="ok">✓</span> <span class="num">2,888</span> nodes', 1],
  ['<span class="ok">✓</span> <span class="num">7,853</span> edges', 1],
  ['<span class="ok">✓</span> NestJS detected', 1],
  ['<span class="ok">✓</span> Semantic Index built', 1],
  ['<span class="ok">✓</span> History indexed &nbsp;<span class="dim">· hash 0eaau5s</span>', 1],
  ["", 0],
  ['<span class="prompt">$</span> <span class="cmd">ontoly search "what owns graph construction?"</span>', 0],
  ['<span class="dim">1.</span> <span class="hl">buildSoftwareGraphWithArtifacts</span> <span class="dim">packages/compiler</span>', 1],
  ['   <span class="dim">Confidence</span> <span class="num">0.90</span>', 1],
  ["", 0],
  ['<span class="prompt">$</span> <span class="cmd">ontoly impact buildSoftwareGraphWithArtifacts --mode blast-radius</span>', 0],
  ['<span class="num">26</span> affected nodes', 1],
];

export function HeroTerminal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = ref.current;
    if (!body) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    body.innerHTML = "";
    let i = 0;
    let timer: number | undefined;
    const step = () => {
      if (i >= LINES.length) return;
      const d = document.createElement("div");
      d.className = "ln";
      d.innerHTML = LINES[i][0] || "&nbsp;";
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      i++;
      if (reduce) step();
      else timer = window.setTimeout(step, LINES[i - 1] && LINES[i - 1][1] ? 90 : 240);
    };
    step();
    return () => { if (timer) window.clearTimeout(timer); };
  }, []);

  return (
    <div className="terminal" aria-label="Ontoly command line example">
      <div className="term-bar"><span className="tdot" /><span className="tdot" /><span className="tdot" /><span className="tname">bash — ontoly</span></div>
      <div className="term-body" ref={ref} />
    </div>
  );
}
