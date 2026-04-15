import { RunSelector } from "./RunSelector";
import { useModels } from "@/hooks/useModels";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Activity } from "lucide-react";

export function TopBar() {
  const { data: models } = useModels();

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card/30 px-6 backdrop-blur">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Activity className="h-4 w-4 text-[hsl(142_70%_55%)]" />
        <span>
          {models?.models_loaded ? "Models loaded" : "Models not loaded"}
        </span>
        {models && (
          <>
            <span className="text-border">•</span>
            <span className="tnum">
              {formatNumber(models.n_features)} features
            </span>
            <span className="text-border">•</span>
            <span className="tnum">
              cutoff {formatPercent(models.cutoff)}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Run
        </span>
        <RunSelector />
      </div>
    </header>
  );
}
