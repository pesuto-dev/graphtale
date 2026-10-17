import type { ReactElement, Ref } from "react";
import type { SkillNode } from "@shared/protocol";
import { stepNumberAndTitle } from "./stepMatch";
import { useGoToStep, type GoToStepModel } from "./useGoToStep";

export interface GoToStepProps {
  nodes: SkillNode[];
  onGo: (id: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function GoToStep({ nodes, onGo, inputRef }: GoToStepProps): ReactElement {
  const step = useGoToStep(nodes, onGo);
  return (
    <div className="go-to-step search-field">
      <label htmlFor="go-to-step">Go to step</label>
      <div className="go-to-step-control">
        <GoToStepInput step={step} inputRef={inputRef} />
        {step.shown ? (
          <GoToStepList
            listId={step.listId}
            matches={step.matches}
            activeIndex={step.activeIndex}
            onCommit={step.commit}
          />
        ) : null}
      </div>
      <p className="go-to-step-status" role="status">
        {step.status}
      </p>
    </div>
  );
}

function GoToStepInput({ step, inputRef }: { step: GoToStepModel; inputRef?: Ref<HTMLInputElement> }): ReactElement {
  const current = step.shown ? step.matches[step.activeIndex] : undefined;
  return (
    <input
      id="go-to-step"
      ref={inputRef}
      type="search"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={step.shown}
      aria-controls={step.listId}
      aria-activedescendant={current ? optionId(step.listId, current.id) : undefined}
      placeholder="Title or number"
      autoComplete="off"
      spellCheck={false}
      value={step.query}
      onChange={(event) => { step.onChange(event.target.value); }}
      onKeyDown={step.onKeyDown}
      onFocus={step.onFocus}
      onBlur={step.onBlur}
    />
  );
}

interface GoToStepListProps {
  listId: string;
  matches: SkillNode[];
  activeIndex: number;
  onCommit: (node: SkillNode) => void;
}

function GoToStepList({ listId, matches, activeIndex, onCommit }: GoToStepListProps): ReactElement {
  return (
    <ul id={listId} role="listbox" aria-label="Matching steps" className="go-to-step-list">
      {matches.map((node, index) => (
        <GoToStepOption
          key={node.id}
          listId={listId}
          node={node}
          selected={index === activeIndex}
          onCommit={onCommit}
        />
      ))}
    </ul>
  );
}

interface GoToStepOptionProps {
  listId: string;
  node: SkillNode;
  selected: boolean;
  onCommit: (node: SkillNode) => void;
}

function GoToStepOption({ listId, node, selected, onCommit }: GoToStepOptionProps): ReactElement {
  const parts = stepNumberAndTitle(node);
  const className = selected ? "go-to-step-option is-active" : "go-to-step-option";
  return (
    <li role="presentation">
      <button
        type="button"
        id={optionId(listId, node.id)}
        role="option"
        aria-selected={selected}
        className={className}
        onMouseDown={(event) => { event.preventDefault(); }}
        onClick={() => { onCommit(node); }}
      >
        {parts.number ? <span className="go-to-step-number">{parts.number}</span> : null}
        {parts.number ? " " : null}
        <span>{parts.title}</span>
      </button>
    </li>
  );
}

function optionId(listId: string, nodeId: string): string {
  return `${listId}-${nodeId}`;
}
