import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/svg/Spinner";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { RunStatus } from "@/types/api";

interface Props {
  status: RunStatus;
}

export function RunStatusBadge({ status }: Props) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="info" className="gap-1.5">
          <Clock className="h-3 w-3" />
          Queued
        </Badge>
      );
    case "running":
      return (
        <Badge variant="warning" className="gap-1.5">
          <Spinner size={12} label="Running" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="success" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1.5">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
