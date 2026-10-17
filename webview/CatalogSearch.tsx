import type { KeyboardEvent, ReactElement, Ref } from "react";

export interface CatalogSearchProps {
  query: string;
  status: string;
  inputRef?: Ref<HTMLInputElement>;
  onQuery: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function CatalogSearch(props: CatalogSearchProps): ReactElement {
  const described = props.query.trim().length > 0;
  return (
    <div className="catalog-search search-field">
      <label htmlFor="catalog-search">Search files</label>
      <input
        id="catalog-search"
        ref={props.inputRef}
        type="search"
        value={props.query}
        placeholder="Name, path, or description"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={described ? "catalog-search-status" : undefined}
        onChange={(event) => { props.onQuery(event.target.value); }}
        onKeyDown={props.onKeyDown}
      />
      {described ? (
        <p id="catalog-search-status" className="catalog-search-status" role="status">
          {props.status}
        </p>
      ) : null}
    </div>
  );
}
