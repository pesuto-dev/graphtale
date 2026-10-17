import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SkillNode } from "@shared/protocol";
import { goToStepKey, type GoToStepKeyState } from "./goToStepKey";
import { rankSteps } from "./stepMatch";

const MAX_MATCHES = 8;
const BLUR_MS = 150;

export interface GoToStepModel {
  listId: string;
  query: string;
  status: string;
  shown: boolean;
  matches: SkillNode[];
  activeIndex: number;
  commit: (node: SkillNode) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

interface TimerRef { current: number | undefined }

interface StepSetters {
  onGo: (id: string) => void;
  setQuery: (query: string) => void;
  setOpen: (open: boolean) => void;
  setActive: (active: number) => void;
  setStatus: (status: string) => void;
}

export function useGoToStep(nodes: SkillNode[], onGo: (id: string) => void): GoToStepModel {
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
  const keyState = { query, open, matches, active };

  useEffect(() => () => { window.clearTimeout(blurTimer.current); }, []);

  return {
    listId,
    query,
    status,
    shown,
    matches,
    activeIndex,
    commit: (node) => { commitStep(node, setters); },
    onKeyDown: (event) => { applyGoToStepKey(event, keyState, setters); },
    onChange: (value) => { changeQuery(value, setters); },
    onFocus: () => { focusQuery(query, blurTimer, setOpen); },
    onBlur: () => { blurQuery(blurTimer, setOpen); },
  };
}

function changeQuery(value: string, setters: StepSetters): void {
  setters.setQuery(value);
  setters.setActive(0);
  setters.setOpen(true);
  setters.setStatus("");
}

function focusQuery(query: string, blurTimer: TimerRef, setOpen: (open: boolean) => void): void {
  window.clearTimeout(blurTimer.current);
  if (query.trim()) {
    setOpen(true);
  }
}

function blurQuery(blurTimer: TimerRef, setOpen: (open: boolean) => void): void {
  window.clearTimeout(blurTimer.current);
  blurTimer.current = window.setTimeout(() => { setOpen(false); }, BLUR_MS);
}

function commitStep(node: SkillNode, setters: StepSetters): void {
  setters.onGo(node.id);
  setters.setQuery("");
  setters.setOpen(false);
  setters.setActive(0);
  setters.setStatus(`Showing ${node.label}`);
}

function applyGoToStepKey(event: KeyboardEvent<HTMLInputElement>, state: GoToStepKeyState, setters: StepSetters): void {
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
    changeQuery("", setters);
    setters.setOpen(false);
    return;
  }
  if (next.kind === "miss") {
    setters.setStatus(next.status);
    setters.setOpen(false);
    return;
  }
  commitStep(next.node, setters);
}
