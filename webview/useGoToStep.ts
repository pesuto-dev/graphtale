import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import type { SkillNode } from "@shared/protocol";
import { rankSteps } from "./findInView";
import { goToStepKey } from "./goToStepKey";

const MAX_MATCHES = 8;
const BLUR_MS = 150;

type SetText = Dispatch<SetStateAction<string>>;
type SetFlag = Dispatch<SetStateAction<boolean>>;
type SetIndex = Dispatch<SetStateAction<number>>;

export function useGoToStep(nodes: SkillNode[], onGo: (id: string) => void) {
  const listId = useId();
  const blurTimer = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const matches = rankSteps(nodes, query).slice(0, MAX_MATCHES);
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));
  const shown = open && query.trim().length > 0 && matches.length > 0;
  const setters = { onGo, setQuery, setOpen, setActive, setStatus };

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  return {
    listId,
    query,
    status,
    shown,
    matches,
    activeIndex,
    commit: (node: SkillNode) => commitStep(node, setters),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) =>
      applyGoToStepKey(event, { query, open, matches, active }, setters),
    onChange(value: string) {
      setQuery(value);
      setActive(0);
      setOpen(true);
      setStatus("");
    },
    onFocus() {
      window.clearTimeout(blurTimer.current);
      if (query.trim()) {
        setOpen(true);
      }
    },
    onBlur() {
      blurTimer.current = window.setTimeout(() => setOpen(false), BLUR_MS);
    },
  };
}

function commitStep(node: SkillNode, setters: StepSetters): void {
  setters.onGo(node.id);
  setters.setQuery("");
  setters.setOpen(false);
  setters.setActive(0);
  setters.setStatus(`Showing ${node.label}`);
}

function applyGoToStepKey(
  event: KeyboardEvent<HTMLInputElement>,
  state: { query: string; open: boolean; matches: SkillNode[]; active: number },
  setters: StepSetters,
): void {
  const next = goToStepKey(event.key, state);
  if (!next) {
    return;
  }
  event.preventDefault();
  if (next.kind === "move") {
    setters.setOpen(true);
    setters.setActive(next.active);
    return;
  }
  if (next.kind === "clear") {
    setters.setQuery("");
    setters.setOpen(false);
    setters.setActive(0);
    setters.setStatus("");
    return;
  }
  if (next.kind === "miss") {
    setters.setStatus(next.status);
    setters.setOpen(false);
    return;
  }
  commitStep(next.node, setters);
}

type StepSetters = {
  onGo: (id: string) => void;
  setQuery: SetText;
  setOpen: SetFlag;
  setActive: SetIndex;
  setStatus: SetText;
};
