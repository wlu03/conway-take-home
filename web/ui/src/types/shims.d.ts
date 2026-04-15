// Module shims for third-party packages that ship without types.

declare module "react-cytoscapejs" {
  import type { Core, ElementDefinition } from "cytoscape";
  import type { CSSProperties, ComponentType } from "react";

  export interface CytoscapeComponentProps {
    id?: string;
    className?: string;
    style?: CSSProperties;
    elements?: ElementDefinition[];
    // Loose typing — cytoscape accepts many shapes at runtime
    stylesheet?: unknown;
    layout?: Record<string, unknown>;
    cy?: (cy: Core) => void;
    pan?: { x: number; y: number };
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    zoomingEnabled?: boolean;
    userZoomingEnabled?: boolean;
    boxSelectionEnabled?: boolean;
    autoungrabify?: boolean;
    wheelSensitivity?: number;
    autolock?: boolean;
    autounselectify?: boolean;
  }

  const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}
