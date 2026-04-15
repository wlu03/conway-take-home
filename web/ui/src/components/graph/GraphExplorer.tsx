import { useEffect, useMemo, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition, NodeSingular } from "cytoscape";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import type { GraphData } from "@/types/api";

interface Props {
  data: GraphData;
  centerAccount?: string;
}

type StyleRule = { selector: string; style: Record<string, unknown> };

// Cytoscape's exported Stylesheet type is narrower than the shape the
// library actually accepts at runtime — we keep the rich CSS-prop form
// and cast through `unknown` at the component boundary.
const GRAPH_STYLE: StyleRule[] = [
  {
    selector: "node",
    style: {
      "background-color": "#3d4f6b",
      "border-color": "#8aa4c9",
      "border-width": 1.5,
      "border-opacity": 0.9,
      label: "data(label)",
      color: "#dbe4f0",
      "font-size": "11px",
      "font-family": "Inter, sans-serif",
      "font-weight": 500,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 8,
      "text-wrap": "wrap",
      "text-max-width": "140px",
      "line-height": 1.25,
      "text-background-color": "#0a0f1f",
      "text-background-opacity": 0.92,
      "text-background-padding": "4px",
      "text-background-shape": "roundrectangle",
      "text-border-color": "#2c3342",
      "text-border-width": 1,
      "text-border-opacity": 1,
      width: "mapData(tx_count, 1, 80, 22, 36)",
      height: "mapData(tx_count, 1, 80, 22, 36)",
      "overlay-opacity": 0,
    },
  },
  {
    selector: "node[flagged_count > 0]",
    style: {
      "background-color": "#dc2626",
      "border-color": "#fca5a5",
      "border-width": 2.5,
      color: "#fee2e2",
      "font-weight": 700,
      "text-background-color": "#3a0d10",
      "text-background-opacity": 0.95,
      "text-border-color": "#dc2626",
      "text-border-width": 1.5,
      "z-index": 5,
    },
  },
  {
    selector: "node.center",
    style: {
      "background-color": "#e0323d",
      "border-color": "#ffffff",
      "border-width": 3,
      width: 52,
      height: 52,
      "font-size": "12px",
      "font-weight": 700,
      color: "#ffffff",
      "text-background-color": "#3a0d10",
      "text-border-color": "#dc2626",
      "text-border-width": 2,
      "z-index": 10,
    },
  },
  {
    selector: "edge",
    style: {
      width: "mapData(tx_count, 1, 40, 1, 3.5)",
      "line-color": "#3a4453",
      "target-arrow-color": "#4a5568",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.9,
      "curve-style": "bezier",
      "control-point-step-size": 24,
      opacity: 0.55,
    },
  },
  {
    selector: "edge[any_flagged > 0]",
    style: {
      "line-color": "#ef4444",
      "target-arrow-color": "#fca5a5",
      width: "mapData(tx_count, 1, 40, 2.5, 5)",
      opacity: 0.95,
      "z-index": 6,
    },
  },
];

function truncateId(id: string): string {
  if (id.length <= 10) return id;
  return `…${id.slice(-6)}`;
}

function computeHops(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
  center: string | undefined
): Map<string, number> {
  const hops = new Map<string, number>();
  if (!center) return hops;
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }
  const queue: string[] = [center];
  hops.set(center, 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = hops.get(cur)!;
    for (const nb of adj.get(cur) ?? []) {
      if (!hops.has(nb)) {
        hops.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }
  // Unreachable nodes go to a far outer ring
  for (const n of nodes) {
    if (!hops.has(n.id)) hops.set(n.id, 99);
  }
  return hops;
}

export function GraphExplorer({ data, centerAccount }: Props) {
  const cyRef = useRef<Core | null>(null);

  const { elements, hops } = useMemo(() => {
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const filteredEdges = data.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    const hops = computeHops(data.nodes, filteredEdges, centerAccount);
    const nodeEls: ElementDefinition[] = data.nodes.map((n) => {
      const isFlagged = n.flagged_count > 0;
      const isCenter = !!centerAccount && n.id === centerAccount;
      const base = truncateId(n.id);
      const label = isFlagged
        ? `⚠ ${base}\n${n.flagged_count} flagged`
        : base;
      return {
        data: {
          id: n.id,
          label,
          tx_count: n.tx_count,
          flagged_count: n.flagged_count,
          hop: hops.get(n.id) ?? 99,
        },
        classes: [isCenter ? "center" : "", isFlagged ? "flagged" : ""]
          .filter(Boolean)
          .join(" "),
      };
    });
    const edgeEls: ElementDefinition[] = filteredEdges.map((e, i) => ({
      data: {
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        tx_count: e.tx_count,
        total_amount: e.total_amount,
        any_flagged: e.any_flagged ? 1 : 0,
      },
    }));
    return { elements: [...nodeEls, ...edgeEls], hops };
  }, [data, centerAccount]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Cytoscape parses only comma-separated color strings reliably, and some
    // builds of react-cytoscapejs don't re-apply a module-level stylesheet
    // after HMR or the first paint. We therefore do everything imperatively:
    // set the stylesheet via the official setter form, then apply the
    // flagged/center highlights as INLINE element styles once the layout
    // completes (layoutstop event).
    const setStylesheet = cy.style as unknown as (s: unknown) => unknown;
    setStylesheet.call(cy, GRAPH_STYLE);

    const applyHighlights = () => {
      cy.batch(() => {
        cy.nodes().forEach((n) => {
          const flaggedCount = Number(n.data("flagged_count") ?? 0);
          const isCenter = n.hasClass("center");
          if (isCenter) {
            n.style({
              "background-color": "#e0323d",
              "border-color": "#ffffff",
              "border-width": 3,
              width: 52,
              height: 52,
              color: "#ffffff",
              "font-size": "12px",
              "font-weight": 700,
              "text-background-color": "#3a0d10",
              "text-background-opacity": 0.95,
              "text-border-color": "#dc2626",
              "text-border-width": 2,
              "z-index": 10,
            });
          } else if (flaggedCount > 0) {
            n.style({
              "background-color": "#dc2626",
              "border-color": "#fca5a5",
              "border-width": 2.5,
              color: "#fee2e2",
              "font-weight": 700,
              "text-background-color": "#3a0d10",
              "text-background-opacity": 0.95,
              "text-border-color": "#dc2626",
              "text-border-width": 1.5,
              "z-index": 5,
            });
          }
        });
        cy.edges().forEach((e) => {
          if (Number(e.data("any_flagged") ?? 0) > 0) {
            e.style({
              "line-color": "#ef4444",
              "target-arrow-color": "#fca5a5",
              opacity: 0.95,
              "z-index": 6,
            });
          }
        });
      });
    };

    const maxHop = Math.max(
      1,
      ...Array.from(hops.values()).filter((h) => h < 99)
    );
    const layout = cy.layout({
      name: "concentric",
      animate: false,
      fit: true,
      padding: 60,
      startAngle: (3 / 2) * Math.PI,
      minNodeSpacing: 52,
      spacingFactor: 1.35,
      avoidOverlap: true,
      concentric: (node: NodeSingular) =>
        maxHop - (Number(node.data("hop") ?? 0)),
      levelWidth: () => 1,
    } as unknown as Parameters<Core["layout"]>[0]);

    // Apply highlights after layout finishes so inline styles aren't wiped
    // by any post-layout style recomputation.
    layout.one("layoutstop", () => {
      applyHighlights();
      cy.fit(undefined, 60);
    });
    layout.run();
    // Also apply immediately in case layoutstop doesn't fire for instant layouts.
    applyHighlights();
  }, [elements, hops]);

  return (
    <div className="relative h-full w-full">
      <Card className="relative h-full overflow-hidden p-0">
        <CytoscapeComponent
          cy={(cy: Core) => {
            cyRef.current = cy;
          }}
          elements={elements}
          stylesheet={GRAPH_STYLE}
          layout={{ name: "preset" }}
          style={{ width: "100%", height: "100%" }}
          wheelSensitivity={0.18}
          minZoom={0.2}
          maxZoom={3}
        />

        {/* Floating toolbar */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 rounded-md border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const cy = cyRef.current;
              if (cy) cy.zoom(cy.zoom() * 1.2);
            }}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const cy = cyRef.current;
              if (cy) cy.zoom(cy.zoom() / 1.2);
            }}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => cyRef.current?.fit(undefined, 40)}
            aria-label="Fit to screen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const cy = cyRef.current;
              if (!cy) return;
              cy.layout({ name: "cose", animate: false }).run();
              cy.fit(undefined, 40);
            }}
            aria-label="Reset layout"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Animated legend */}
        <GraphLegend />
      </Card>
    </div>
  );
}

function GraphLegend() {
  return (
    <div className="absolute left-4 top-4 rounded-md border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Legend
      </div>
      <svg
        viewBox="0 0 180 90"
        width="180"
        height="90"
        aria-label="Graph legend"
        role="img"
      >
        <title>Graph legend</title>
        {/* Clean node */}
        <circle cx="14" cy="14" r="6" fill="hsl(215 27% 30%)" />
        <text
          x="28"
          y="18"
          fontSize="10"
          fill="hsl(215 16% 70%)"
          fontFamily="Inter, sans-serif"
        >
          Clean account
        </text>

        {/* Flagged node with pulsing halo */}
        <circle cx="14" cy="36" r="10" fill="hsl(0 72% 51%)" opacity="0.25">
          <animate
            attributeName="r"
            values="8;11;8"
            dur="2.2s"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0.1;0.4"
            dur="2.2s"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="14" cy="36" r="6" fill="hsl(0 72% 55%)" />
        <text
          x="28"
          y="40"
          fontSize="10"
          fill="hsl(215 16% 70%)"
          fontFamily="Inter, sans-serif"
        >
          Flagged account
        </text>

        {/* Edge with traveling dot */}
        <line
          x1="6"
          y1="60"
          x2="22"
          y2="60"
          stroke="hsl(215 27% 35%)"
          strokeWidth="1.5"
        />
        <text
          x="28"
          y="64"
          fontSize="10"
          fill="hsl(215 16% 70%)"
          fontFamily="Inter, sans-serif"
        >
          Clean edge
        </text>

        <line
          x1="6"
          y1="80"
          x2="22"
          y2="80"
          stroke="hsl(0 72% 55%)"
          strokeWidth="2"
        />
        <circle cx="6" cy="80" r="2" fill="hsl(0 72% 70%)">
          <animate
            attributeName="cx"
            from="6"
            to="22"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
        <text
          x="28"
          y="84"
          fontSize="10"
          fill="hsl(215 16% 70%)"
          fontFamily="Inter, sans-serif"
        >
          Flagged edge
        </text>
      </svg>
    </div>
  );
}
