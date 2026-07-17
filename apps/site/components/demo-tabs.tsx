"use client";
import { useState } from "react";

const TABS = ["search", "impact", "trace", "history", "semantics"] as const;
type Tab = (typeof TABS)[number];

const DEMOS: Record<Tab, string> = {
  search:
    '<div><span class="prompt">$</span> <span class="cmd">ontoly search "who owns authentication?"</span></div>' +
    '<div class="dim"># Semantic Search · recommended capability: FeatureTouchpoints</div><div>&nbsp;</div>' +
    '<div><span class="hl">AuthService</span> <span class="dim">(Service)</span></div>' +
    '<div class="kv">  id: <span class="dim">service:src/auth/auth.service.ts:AuthService</span></div>' +
    '<div class="kv">  score: <span class="num">2060.83</span> · confidence: <span class="num">0.94</span></div>' +
    '<div class="kv">  evidence: exact-normalized-name, phrase-match, token-overlap</div><div>&nbsp;</div>' +
    '<div><span class="ok">✓</span> resolved to real symbols · graph hash <span class="hl">0eaau5s</span></div>',
  impact:
    '<div><span class="prompt">$</span> <span class="cmd">ontoly impact AuthService --mode blast-radius</span></div>' +
    '<div class="dim"># Impact Analysis</div><div>&nbsp;</div>' +
    '<div>AuthService has <span class="num">26</span> dependent node(s); <span class="num">81</span> in deterministic scope.</div>' +
    '<div class="kv">  Confidence: <span class="num">0.95</span> · Evidence: 3</div><div>&nbsp;</div>' +
    '<div class="kv">  Controllers → AuthController, SessionController</div>' +
    '<div class="kv">  Modules → auth.module.ts, app.module.ts</div>' +
    '<div class="kv">  Jobs → TokenCleanupJob</div>',
  trace:
    '<div><span class="prompt">$</span> <span class="cmd">ontoly trace "POST /auth/login" --depth 5</span></div>' +
    '<div class="dim"># Request Lifecycle</div><div>&nbsp;</div>' +
    '<div><span class="hl">Route</span> POST /auth/login</div>' +
    '<div class="kv">  └─ <span style="color:var(--e-mounts)">MOUNTS</span> AuthController.login</div>' +
    '<div class="kv">     └─ <span style="color:var(--e-calls)">CALLS</span> AuthService.validateUser</div>' +
    '<div class="kv">        └─ <span style="color:var(--e-injects)">INJECTS</span> UserRepository</div>' +
    '<div class="kv">        └─ <span style="color:var(--e-calls)">CALLS</span> TokenService.issue</div>' +
    '<div class="kv">           └─ <span style="color:var(--e-imports)">IMPORTS</span> jsonwebtoken</div><div>&nbsp;</div>' +
    '<div><span class="ok">✓</span> 5 hops · deterministic path</div>',
  history:
    '<div><span class="prompt">$</span> <span class="cmd">ontoly hotspots --limit 5</span></div>' +
    '<div class="dim"># Repository Intelligence · Git history</div><div>&nbsp;</div>' +
    '<div class="kv">  churn  stability  file</div>' +
    '<div><span class="num">  142</span>   <span style="color:var(--warn)">0.38</span>     src/auth/auth.service.ts</div>' +
    '<div><span class="num">   97</span>   <span style="color:var(--warn)">0.44</span>     src/billing/invoice.service.ts</div>' +
    '<div><span class="num">   71</span>   <span class="ok">0.71</span>     src/user/user.service.ts</div>' +
    '<div><span class="num">   64</span>   <span class="ok">0.80</span>     src/core/graph.ts</div><div>&nbsp;</div>' +
    '<div><span class="ok">✓</span> ownership + cochanges available</div>',
  semantics:
    '<div><span class="prompt">$</span> <span class="cmd">ontoly semantics inspect AuthService</span></div>' +
    '<div class="dim"># Derived Semantic Model</div><div>&nbsp;</div>' +
    '<div class="kv">  kind: Service <span class="dim">(NestJS provider)</span></div>' +
    '<div class="kv">  decorators: <span style="color:var(--e-decorates)">@Injectable</span></div>' +
    '<div class="kv">  injects: UserRepository, TokenService, ConfigService</div>' +
    '<div class="kv">  methods: validateUser, login, refresh, logout</div>' +
    '<div class="kv">  exposes: 2 routes via AuthController</div><div>&nbsp;</div>' +
    '<div><span class="ok">✓</span> framework-aware · deterministic</div>',
};

export function DemoTabs() {
  const [tab, setTab] = useState<Tab>("search");
  return (
    <div className="demo">
      <div className="demo-tabs" role="tablist" aria-label="Ontoly commands">
        {TABS.map((t) => (
          <button key={t} className="demo-tab" role="tab" aria-selected={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="demo-body" dangerouslySetInnerHTML={{ __html: DEMOS[tab] }} />
    </div>
  );
}
