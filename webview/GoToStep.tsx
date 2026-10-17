import { useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import type { SkillNode } from "@shared/protocol";
import { rankSteps, stepNumberAndTitle } from "./findInView";

const MAX_MATCHES = 8;

export function GoToStep({
  nodes,
  onGo,
  inputRef,
}: {
  nodes: SkillNode[];
  onGo: (id: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const listId = useId();
  const blurTimer = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const matches = rankSteps(nodes, query).slice(0, MAX_MATCHES);
  const shown = open && query.trim().length > 0 && matches.length > 0;
  const activeIndex = matches.length === 0 ? 0 : Math.min(active, matches.length - 1);

  function commit(node: SkillNode): void {
    onGo(node.id);
    setQuery("");
    setOpen(false);
    setActive(0);
    setStatus(`Showing ${node.label}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      if (!query && !open) {
        return;
      }
      event.preventDefault();
      setQuery("");
      setOpen(false);
      setActive(0);
      setStatus("");
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const chosen = matches[activeIndex];
    if (chosen) {
      commit(chosen);
      return;
    }
    if (query.trim()) {
      setStatus(`No step matches "${query.trim()}".`);
      setOpen(false);
    }
  }

  return (
    <div className="go-to-step search-field">
      <label htmlFor="go-to-step">Go to step</label>
      <div className="go-to-step-control">
        <input
          id="go-to-step"
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown ? optionId(listId, matches[activeIndex].id) : undefined}
          placeholder="Title or number"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
            setStatus("");
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            window.clearTimeout(blurTimer.current);
            if (query.trim()) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {shown ? (
          <ul id={listId} role="listbox" aria-label="Matching steps" className="go-to-step-list">
            {matches.map((node, index) => {
              const parts = stepNumberAndTitle(node);
              return (
                <li key={node.id} role="presentation">
                  <button
                    type="button"
                    id={optionId(listId, node.id)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "go-to-step-option is-active" : "go-to-step-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commit(node)}
                  >
                    {parts.number ? <span className="go-to-step-number">{parts.number}</span> : null}
                    {parts.number ? " " : null}
                    <span>{parts.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <p className="go-to-step-status" role="status">
        {status}
      </p>
    </div>
  );
}

function optionId(listId: string, nodeId: string): string {
  return `${listId}-${nodeId}`;
}
