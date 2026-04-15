import { useState, type ReactNode, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createRun } from "@/lib/api";
import { Spinner } from "@/components/svg/Spinner";
import { cn } from "@/lib/utils";

interface Props {
  children?: ReactNode;
}

export function UploadDialog({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [includeGraph, setIncludeGraph] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("No file selected");
      return createRun(file, includeGraph);
    },
    onSuccess: (data) => {
      toast.success("Run queued", {
        description: `Run ${data.run_id} has been submitted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      setOpen(false);
      setFile(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error("Upload failed", { description: message });
    },
  });

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) {
      setFile(f);
    } else {
      toast.error("Please drop a CSV file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            <UploadCloud className="h-4 w-4" />
            Upload CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New scoring run</DialogTitle>
          <DialogDescription>
            Upload a transaction CSV. Must match the training schema.
          </DialogDescription>
        </DialogHeader>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          htmlFor="upload-file"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 transition-colors",
            dragOver
              ? "border-primary/60 bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-accent/30"
          )}
        >
          {file ? (
            <>
              <FileText className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop a CSV or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  .csv only
                </p>
              </div>
            </>
          )}
          <input
            id="upload-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex items-start gap-3 rounded-md border border-border bg-card/60 p-3">
          <input
            id="include-graph"
            type="checkbox"
            checked={includeGraph}
            onChange={(e) => setIncludeGraph(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[hsl(0_72%_51%)]"
          />
          <div className="flex-1">
            <label
              htmlFor="include-graph"
              className="text-sm font-medium text-foreground"
            >
              Include graph features
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cycle detection, scatter-gather, fan-in / fan-out. Slower on
              large datasets.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!file || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Spinner size={14} label="Uploading" />
                Uploading…
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Submit run
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
