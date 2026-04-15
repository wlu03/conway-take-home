import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RUN_STORAGE_KEY } from "@/lib/constants";

/**
 * Reads/writes the current run id. Priority:
 *   1. URL query param `?run=<id>`
 *   2. localStorage fallback
 * Writing updates both URL and storage so deep links persist.
 */
export function useRunId(): {
  runId: string | null;
  setRunId: (id: string | null) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlRunId = searchParams.get("run");

  const runId = useMemo(() => {
    if (urlRunId) return urlRunId;
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(RUN_STORAGE_KEY);
    }
    return null;
  }, [urlRunId]);

  // Keep URL in sync when we have a stored run but nothing in URL
  useEffect(() => {
    if (!urlRunId && runId) {
      const next = new URLSearchParams(searchParams);
      next.set("run", runId);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRunId, runId]);

  const setRunId = useCallback(
    (id: string | null) => {
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem(RUN_STORAGE_KEY, id);
        else window.localStorage.removeItem(RUN_STORAGE_KEY);
      }
      const next = new URLSearchParams(searchParams);
      if (id) next.set("run", id);
      else next.delete("run");
      // Use navigate so pages that read location re-render
      navigate({ search: next.toString() }, { replace: false });
    },
    [navigate, searchParams]
  );

  return { runId, setRunId };
}
