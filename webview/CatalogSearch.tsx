import type { KeyboardEvent, Ref } from "react";

export function CatalogSearch({
  query,
  total,
  matchCount,
  inputRef,
  onQuery,
}: {
  query: string;
  total: number;
  matchCount: number;
  inputRef?: Ref<HTMLInputElement>;
  onQuery: (query: string) => void;
}) {
  const trimmed = query.trim();
  const status = !trimmed
    ? ""
    : matchCount === 0
      ? `No files match "${trimmed}".`
      : `${matchCount} of ${total} files`;
  return (
    <div className="inventory-search search-field">
      <label htmlFor="catalog-search">Search files</label>
      <input
        id="catalog-search"
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Name, path, or description"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={trimmed ? "catalog-search-status" : undefined}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape" && query) {
            event.preventDefault();
            onQuery("");
          }
        }}
      />
      {trimmed ? (
        <p id="catalog-search-status" className="inventory-search-status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
