import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WhyFlaggedFeature } from "@/types/api";
import { cn } from "@/lib/utils";

interface Props {
  features: WhyFlaggedFeature[];
}

export function WhyFlagged({ features }: Props) {
  const top = features.slice(0, 5);
  // Log scale: with extreme outliers (e.g. z=322 alongside z=1.8) a linear
  // bar flattens everything below the top to invisibility. log1p keeps the
  // ordering intact while making small contributors readable.
  const maxLog = Math.max(
    0.01,
    ...top.map((f) => Math.log1p(Math.abs(f.modified_z)))
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Why flagged</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Top features driving this transaction's score (by |modified z|)
        </p>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No feature contributions available
          </p>
        ) : (
          <ul className="space-y-4">
            {top.map((f) => {
              const absZ = Math.abs(f.modified_z);
              const pct = Math.min(1, Math.log1p(absZ) / maxLog);
              const positive = f.modified_z >= 0;
              return (
                <li key={f.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-mono text-foreground">
                      {f.name}
                    </span>
                    <div className="flex items-center gap-3 tnum text-muted-foreground">
                      <span>
                        value{" "}
                        <span className="text-foreground">
                          {f.value.toFixed(3)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          positive ? "text-primary" : "text-[hsl(217_91%_70%)]"
                        )}
                      >
                        z {f.modified_z.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-secondary/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-500"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
