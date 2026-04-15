import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

interface Props {
  features: Record<string, number>;
}

export function FeatureTable({ features }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const entries = useMemo(() => {
    const list = Object.entries(features).map(([k, v]) => ({ k, v }));
    const f = filter.trim().toLowerCase();
    if (f) {
      return list.filter((e) => e.k.toLowerCase().includes(f));
    }
    return list;
  }, [features, filter]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Engineered features</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            All {Object.keys(features).length} features computed for this row
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          className="gap-1"
        >
          {open ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show
            </>
          )}
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter features…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[420px] overflow-auto rounded-md border border-border">
            <table className="w-full text-sm tnum">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Feature
                  </th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ k, v }) => (
                  <tr
                    key={k}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2 font-mono text-xs">{k}</td>
                    <td className="px-4 py-2 text-right">
                      {typeof v === "number" ? v.toFixed(4) : String(v)}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-xs text-muted-foreground"
                    >
                      No features match "{filter}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
