import { Link } from "react-router-dom";
import {
  ArrowRight,
  Network,
  ShieldAlert,
  Gauge,
  GitBranch,
  Sparkles,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/svg/Logo";
import { ROUTES } from "@/lib/constants";

export function Landing() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <BackdropGrid />
      <BackdropGlow />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#pipeline" className="transition hover:text-foreground">
            Pipeline
          </a>
          <a href="#stats" className="transition hover:text-foreground">
            Stats
          </a>
        </nav>
        <Button asChild size="sm" variant="outline">
          <Link to={ROUTES.dashboard}>
            Open console
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 px-6 pb-16 pt-16 lg:grid-cols-12 lg:gap-12 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Anti-money-laundering, in your terminal
          </div>

          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
            Catch the laundering<br />
            <span className="bg-gradient-to-r from-primary via-[hsl(0_72%_62%)] to-[hsl(14_92%_60%)] bg-clip-text text-transparent">
              before it settles.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
            MacroBase scores millions of transactions, surfaces structuring
            patterns, and walks the counterparty graph for cycles &mdash; so
            your analysts spend their day on the alerts that matter.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="glow-primary">
              <Link to={ROUTES.dashboard}>
                Launch dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={ROUTES.runs}>Browse runs</Link>
            </Button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
            <Stat value="2-3 hop" label="Cycle detection" />
            <Stat value="MAD-z" label="Anomaly scoring" />
            <Stat value="FATF" label="Jurisdiction risk" />
          </dl>
        </div>

        <div className="relative lg:col-span-6">
          <HeroNetwork />
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24"
      >
        <SectionHeading
          eyebrow="Capabilities"
          title="A complete AML pipeline, end to end"
          description="From CSV ingest to graph features to scored alerts &mdash; everything wired into one console."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<Gauge className="h-5 w-5" />}
            title="Score histograms & KPIs"
            body="Total volume, flagged rate, cutoff, and currency conversion stats at a glance per run."
          />
          <Feature
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Modified-z anomaly scoring"
            body="MAD-based outlier detection that skips zero-variance features, so binary columns can't dominate."
          />
          <Feature
            icon={<Network className="h-5 w-5" />}
            title="Counterparty graph features"
            body="2-3 hop cycle detection, scatter-gather scoring, and shared-counterparty counts via merge ops."
          />
          <Feature
            icon={<GitBranch className="h-5 w-5" />}
            title="Reproducible runs"
            body="Every scored CSV becomes a run with stored features, models, and explainable per-row reasons."
          />
          <Feature
            icon={<Database className="h-5 w-5" />}
            title="Inference on new CSVs"
            body="Score new files against pretrained models in a single command — no retraining needed."
          />
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Built for the analyst"
            body="Filterable transactions table, alert triage queue, and a drill-down counterparty graph view."
          />
        </div>
      </section>

      {/* Pipeline */}
      <section
        id="pipeline"
        className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24"
      >
        <SectionHeading
          eyebrow="Pipeline"
          title="From raw CSV to ranked alerts in four steps"
        />
        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              k: "01",
              t: "Ingest",
              d: "Drop a transactions CSV. The runner normalizes columns and stages a new run.",
            },
            {
              k: "02",
              t: "Feature build",
              d: "Behavioral, jurisdictional, and graph features &mdash; including cycle detection.",
            },
            {
              k: "03",
              t: "Score",
              d: "Modified-z anomaly scoring with cutoff selection and per-row reason codes.",
            },
            {
              k: "04",
              t: "Triage",
              d: "Browse flagged transactions, walk the graph, and resolve alerts in the console.",
            },
          ].map((s) => (
            <li
              key={s.k}
              className="group relative rounded-xl border border-border bg-card/40 p-6 backdrop-blur transition hover:border-primary/40 hover:bg-card/60"
            >
              <div className="font-mono text-xs text-primary/80">{s.k}</div>
              <div className="mt-3 text-base font-semibold text-foreground">
                {s.t}
              </div>
              <p
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: s.d }}
              />
              <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
            </li>
          ))}
        </ol>
      </section>

      {/* Stats strip */}
      <section
        id="stats"
        className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-16 lg:px-10"
      >
        <div className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-card/40 p-8 backdrop-blur md:grid-cols-4 md:p-10">
          <BigStat value="6+" label="Feature families" />
          <BigStat value="3-hop" label="Graph traversal depth" />
          <BigStat value="O(n log n)" label="Score complexity" />
          <BigStat value="100%" label="Reproducible" />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card/80 to-card/30 p-10 backdrop-blur md:p-14">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
            aria-hidden
          />
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="max-w-xl text-balance text-3xl font-bold tracking-tight md:text-4xl">
                Ready to see what your data is hiding?
              </h2>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
                Open the console and load a run &mdash; you can be looking at
                flagged transactions within seconds.
              </p>
            </div>
            <Button asChild size="lg" className="glow-primary">
              <Link to={ROUTES.dashboard}>
                Enter dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-[1400px] border-t border-border px-6 py-8 lg:px-10">
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <Logo />
          <span>&copy; MacroBase &middot; AML Console</span>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-foreground tnum">
        {value}
      </dd>
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight text-foreground tnum md:text-4xl">
        {value}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card/40 p-6 backdrop-blur transition hover:border-primary/40 hover:bg-card/60">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(400px circle at 50% 0%, hsl(0 72% 51% / 0.08), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative z-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/60 text-primary">
          {icon}
        </div>
        <div className="mt-4 text-base font-semibold text-foreground">
          {title}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}

/* ---------------- background art ---------------- */

function BackdropGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "linear-gradient(to right, hsl(215 27% 16%) 1px, transparent 1px), linear-gradient(to bottom, hsl(215 27% 16%) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage:
          "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 90%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 90%)",
      }}
      aria-hidden
    />
  );
}

function BackdropGlow() {
  return (
    <>
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[-100px] top-[20%] h-[360px] w-[360px] rounded-full bg-[hsl(14_92%_60%)]/10 blur-[120px]"
        aria-hidden
      />
    </>
  );
}

/* ---------------- hero animated transaction graph ---------------- */

function HeroNetwork() {
  return (
    <div className="relative aspect-square w-full max-w-[560px] mx-auto">
      <svg
        viewBox="0 0 560 560"
        className="h-full w-full"
        role="img"
        aria-labelledby="hero-title hero-desc"
      >
        <title id="hero-title">Counterparty transaction graph</title>
        <desc id="hero-desc">
          Animated graph: nodes pulse, edges draw on mount, particles travel
          along edges, and one node is flagged as suspicious.
        </desc>

        <defs>
          <radialGradient id="hero-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity="0.18" />
            <stop offset="60%" stopColor="hsl(0 72% 51%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="hero-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0 90% 70%)" />
            <stop offset="100%" stopColor="hsl(0 72% 45%)" />
          </radialGradient>

          <radialGradient id="hero-node-clean" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(210 40% 98%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(215 16% 50%)" stopOpacity="0.6" />
          </radialGradient>

          <radialGradient id="hero-node-flag" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38 92% 65%)" />
            <stop offset="100%" stopColor="hsl(14 92% 50%)" />
          </radialGradient>

          <linearGradient id="hero-edge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0 72% 55%)" stopOpacity="0.1" />
            <stop offset="50%" stopColor="hsl(0 72% 62%)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(0 72% 55%)" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="hero-edge-flag" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(38 92% 60%)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="hsl(14 92% 60%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(38 92% 60%)" stopOpacity="0.15" />
          </linearGradient>

          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Reusable motion paths */}
          <path id="p1" d="M 120 150 L 280 90" />
          <path id="p2" d="M 280 90 L 440 150" />
          <path id="p3" d="M 440 150 L 460 320" />
          <path id="p4" d="M 460 320 L 320 440" />
          <path id="p5" d="M 320 440 L 130 380" />
          <path id="p6" d="M 130 380 L 120 150" />
          <path id="p7" d="M 280 90 L 320 440" />
          <path id="p8" d="M 120 150 L 460 320" />
          <path id="p9" d="M 280 240 L 440 150" />
          <path id="p10" d="M 280 240 L 130 380" />
          <path id="p11" d="M 280 240 L 460 320" />
        </defs>

        {/* Background halo */}
        <circle cx="280" cy="280" r="260" fill="url(#hero-bg)" />

        {/* Concentric rings — slow rotating dashed orbits */}
        <g
          fill="none"
          stroke="hsl(215 27% 22%)"
          strokeWidth="1"
          strokeDasharray="2 8"
          opacity="0.55"
        >
          <circle cx="280" cy="280" r="220">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 280 280"
              to="360 280 280"
              dur="60s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="280" cy="280" r="170">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 280 280"
              to="0 280 280"
              dur="80s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="280" cy="280" r="115">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 280 280"
              to="360 280 280"
              dur="100s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Edges — drawn on mount */}
        <g
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="hero-edges"
        >
          <use href="#p1" stroke="url(#hero-edge)" className="hero-edge edge-1" />
          <use href="#p2" stroke="url(#hero-edge)" className="hero-edge edge-2" />
          <use href="#p3" stroke="url(#hero-edge-flag)" strokeWidth="2" className="hero-edge edge-3" />
          <use href="#p4" stroke="url(#hero-edge-flag)" strokeWidth="2" className="hero-edge edge-4" />
          <use href="#p5" stroke="url(#hero-edge)" className="hero-edge edge-5" />
          <use href="#p6" stroke="url(#hero-edge)" className="hero-edge edge-6" />
          <use href="#p7" stroke="url(#hero-edge)" className="hero-edge edge-7" />
          <use href="#p8" stroke="url(#hero-edge)" className="hero-edge edge-8" />
          <use href="#p9" stroke="url(#hero-edge)" className="hero-edge edge-9" />
          <use href="#p10" stroke="url(#hero-edge)" className="hero-edge edge-10" />
          <use href="#p11" stroke="url(#hero-edge-flag)" strokeWidth="2" className="hero-edge edge-11" />
        </g>

        {/* Particles travelling along edges */}
        <g filter="url(#hero-glow)">
          {[
            { id: "p1", dur: "3.6s", begin: "0s", color: "hsl(0 72% 65%)" },
            { id: "p2", dur: "4.2s", begin: "0.4s", color: "hsl(0 72% 65%)" },
            { id: "p7", dur: "5s", begin: "0.9s", color: "hsl(0 72% 70%)" },
            { id: "p8", dur: "5.4s", begin: "0.2s", color: "hsl(0 72% 70%)" },
            { id: "p9", dur: "3.4s", begin: "1.1s", color: "hsl(0 72% 65%)" },
            { id: "p11", dur: "3.8s", begin: "0.7s", color: "hsl(38 92% 65%)" },
            { id: "p3", dur: "3.2s", begin: "0.3s", color: "hsl(14 92% 65%)" },
            { id: "p4", dur: "3.4s", begin: "1.4s", color: "hsl(14 92% 65%)" },
            { id: "p5", dur: "4.6s", begin: "0.6s", color: "hsl(0 72% 65%)" },
          ].map((p, i) => (
            <circle key={i} r="2.6" fill={p.color}>
              <animateMotion
                dur={p.dur}
                begin={p.begin}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#${p.id}`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.85;1"
                dur={p.dur}
                begin={p.begin}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* Nodes */}
        <Node cx={120} cy={150} r={11} delay={0.55} label="EU-3" />
        <Node cx={280} cy={90} r={13} delay={0.65} label="US-1" />
        <Node cx={440} cy={150} r={11} delay={0.75} label="HK-2" />
        <Node cx={130} cy={380} r={11} delay={0.85} label="UK-4" />
        <Node cx={320} cy={440} r={12} delay={0.95} label="SG-5" />

        {/* Center hub */}
        <g className="hero-node-pop" style={{ animationDelay: "1.05s" }}>
          <circle
            cx="280"
            cy="240"
            r="28"
            fill="hsl(0 72% 51%)"
            opacity="0.18"
          >
            <animate
              attributeName="r"
              values="26;34;26"
              dur="3.4s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          </circle>
          <circle
            cx="280"
            cy="240"
            r="16"
            fill="url(#hero-node)"
            filter="url(#hero-glow)"
          >
            <animate
              attributeName="r"
              values="15;17.5;15"
              dur="2.2s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          </circle>
          <text
            x="280"
            y="244"
            textAnchor="middle"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fontWeight="700"
            fill="hsl(0 0% 100%)"
          >
            HUB
          </text>
        </g>

        {/* Flagged node — suspicious */}
        <g className="hero-node-pop" style={{ animationDelay: "1.2s" }}>
          <circle cx="460" cy="320" r="22" fill="hsl(14 92% 50% / 0.18)">
            <animate
              attributeName="r"
              values="20;30;20"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
            <animate
              attributeName="opacity"
              values="0.6;0.1;0.6"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          </circle>
          <circle
            cx="460"
            cy="320"
            r="13"
            fill="url(#hero-node-flag)"
            filter="url(#hero-glow)"
          />
          <circle
            cx="460"
            cy="320"
            r="13"
            fill="none"
            stroke="hsl(38 92% 65%)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 460 320"
              to="360 460 320"
              dur="6s"
              repeatCount="indefinite"
            />
          </circle>
          {/* Floating tag */}
          <g transform="translate(478 286)" className="hero-tag">
            <rect
              x="0"
              y="0"
              width="78"
              height="22"
              rx="11"
              fill="hsl(14 92% 50%)"
              opacity="0.95"
            />
            <text
              x="39"
              y="15"
              textAnchor="middle"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              fill="white"
              letterSpacing="0.5"
            >
              FLAGGED
            </text>
          </g>
        </g>

        <style>{`
          .hero-edge {
            stroke-dasharray: 380;
            stroke-dashoffset: 380;
            animation: heroDraw 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          .edge-1  { animation-delay: 0.05s; }
          .edge-2  { animation-delay: 0.15s; }
          .edge-3  { animation-delay: 0.25s; }
          .edge-4  { animation-delay: 0.35s; }
          .edge-5  { animation-delay: 0.45s; }
          .edge-6  { animation-delay: 0.55s; }
          .edge-7  { animation-delay: 0.20s; }
          .edge-8  { animation-delay: 0.30s; }
          .edge-9  { animation-delay: 0.40s; }
          .edge-10 { animation-delay: 0.50s; }
          .edge-11 { animation-delay: 0.60s; }
          @keyframes heroDraw { to { stroke-dashoffset: 0; } }

          .hero-node-pop {
            opacity: 0;
            transform-origin: center;
            animation: heroPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          @keyframes heroPop {
            from { opacity: 0; transform: scale(0.4); }
            to   { opacity: 1; transform: scale(1); }
          }

          .hero-tag {
            opacity: 0;
            animation: heroTagIn 0.6s ease-out 1.6s forwards,
                       heroTagFloat 3s ease-in-out 2.2s infinite;
          }
          @keyframes heroTagIn {
            from { opacity: 0; transform: translate(478px, 280px); }
            to   { opacity: 1; transform: translate(478px, 286px); }
          }
          @keyframes heroTagFloat {
            0%, 100% { transform: translate(478px, 286px); }
            50%      { transform: translate(478px, 282px); }
          }
        `}</style>
      </svg>
    </div>
  );
}

function Node({
  cx,
  cy,
  r,
  delay,
  label,
}: {
  cx: number;
  cy: number;
  r: number;
  delay: number;
  label: string;
}) {
  return (
    <g className="hero-node-pop" style={{ animationDelay: `${delay}s` }}>
      <circle
        cx={cx}
        cy={cy}
        r={r + 6}
        fill="hsl(0 72% 51% / 0.12)"
      >
        <animate
          attributeName="r"
          values={`${r + 5};${r + 9};${r + 5}`}
          dur="3s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
        />
      </circle>
      <circle cx={cx} cy={cy} r={r} fill="url(#hero-node-clean)" />
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
        fontWeight="700"
        fill="hsl(224 71% 8%)"
      >
        {label}
      </text>
    </g>
  );
}
