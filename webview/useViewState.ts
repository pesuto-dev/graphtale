import { useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import {
  emptyDiagnosis,
  type FileContentPayload,
  type GraphView,
  type LayoutDirection,
  type ProcedureDiagnosis,
  type SkillGraph,
} from "@shared/protocol";
import { emptyGraph, initialCompact, initialDirection, initialGraphView } from "./appConfig";
import { useGraphFit } from "./useGraphFit";
import { useNarrowPanel } from "./useNarrowPanel";
import { useViewCommands, type CopyState, type ViewCommands } from "./useViewCommands";

export type ViewError = { message: string; retryable: boolean };

type GraphState = {
  graph: SkillGraph;
  setGraph: Dispatch<SetStateAction<SkillGraph>>;
  procedure: SkillGraph;
  setProcedure: Dispatch<SetStateAction<SkillGraph>>;
  diagnosis: ProcedureDiagnosis;
  setDiagnosis: Dispatch<SetStateAction<ProcedureDiagnosis>>;
  content: FileContentPayload | undefined;
  setContent: Dispatch<SetStateAction<FileContentPayload | undefined>>;
  error: ViewError | undefined;
  setError: Dispatch<SetStateAction<ViewError | undefined>>;
  stale: boolean;
  setStale: Dispatch<SetStateAction<boolean>>;
  copyState: CopyState;
  setCopyState: Dispatch<SetStateAction<CopyState>>;
};

type LayoutState = {
  view: GraphView;
  setView: Dispatch<SetStateAction<GraphView>>;
  direction: LayoutDirection;
  setDirection: Dispatch<SetStateAction<LayoutDirection>>;
  selectedId: string | undefined;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  expandedIds: string[];
  setExpandedIds: Dispatch<SetStateAction<string[]>>;
  inspectorOpen: boolean;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
  fitNonce: number;
  setFitNonce: Dispatch<SetStateAction<number>>;
  compact: boolean;
  setCompact: Dispatch<SetStateAction<boolean>>;
  rootPathRef: MutableRefObject<string>;
  selectedIdRef: MutableRefObject<string | undefined>;
  viewRef: MutableRefObject<GraphView>;
  graphContainerRef: RefObject<HTMLDivElement>;
};

export type ViewState = GraphState & LayoutState & { narrow: boolean } & ViewCommands;

function useGraphState(): GraphState {
  const [graph, setGraph] = useState<SkillGraph>(emptyGraph);
  const [procedure, setProcedure] = useState<SkillGraph>(emptyGraph);
  const [diagnosis, setDiagnosis] = useState<ProcedureDiagnosis>(emptyDiagnosis());
  const [content, setContent] = useState<FileContentPayload | undefined>(undefined);
  const [error, setError] = useState<ViewError | undefined>(undefined);
  const [stale, setStale] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  return {
    graph, setGraph, procedure, setProcedure, diagnosis, setDiagnosis, content, setContent,
    error, setError, stale, setStale, copyState, setCopyState,
  };
}

function useLayoutState(): LayoutState {
  const [view, setView] = useState<GraphView>(() => initialGraphView());
  const [direction, setDirection] = useState<LayoutDirection>(() => initialDirection(initialGraphView()));
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const [compact, setCompact] = useState(() => initialCompact());
  const rootPathRef = useRef("");
  const selectedIdRef = useRef<string | undefined>(undefined);
  const viewRef = useRef<GraphView>(initialGraphView());
  const graphContainerRef = useRef<HTMLDivElement>(null);
  selectedIdRef.current = selectedId;
  viewRef.current = view;
  return {
    view, setView, direction, setDirection, selectedId, setSelectedId, expandedIds, setExpandedIds,
    inspectorOpen, setInspectorOpen, fitNonce, setFitNonce, compact, setCompact,
    rootPathRef, selectedIdRef, viewRef, graphContainerRef,
  };
}

export function useViewState(): ViewState {
  const graphs = useGraphState();
  const layout = useLayoutState();
  const narrow = useNarrowPanel();
  useGraphFit({
    compact: layout.compact,
    view: layout.view,
    direction: layout.direction,
    expandedIds: layout.expandedIds,
    fitNonce: layout.fitNonce,
    narrow,
    inspectorOpen: layout.inspectorOpen,
    containerRef: layout.graphContainerRef,
  });
  const commands = useViewCommands({
    graph: graphs.graph,
    procedure: graphs.procedure,
    diagnosis: graphs.diagnosis,
    direction: layout.direction,
    compact: layout.compact,
    setView: layout.setView,
    setDirection: layout.setDirection,
    setSelectedId: layout.setSelectedId,
    setExpandedIds: layout.setExpandedIds,
    setContent: graphs.setContent,
    setInspectorOpen: layout.setInspectorOpen,
    setCompact: layout.setCompact,
    setFitNonce: layout.setFitNonce,
    setCopyState: graphs.setCopyState,
  });
  return { ...graphs, ...layout, narrow, ...commands };
}
