import { useState, type KeyboardEvent } from "react";
import type { SkillNode } from "@shared/protocol";
import { catalogMatchStatus, catalogQueryClears, filterCatalogNodes } from "./catalogQuery";
import { groupInventory, type InventoryGroup } from "./inventoryGroups";

export type CatalogSearchModel = {
  query: string;
  filtered: SkillNode[];
  groups: InventoryGroup[];
  status: string;
  onQuery: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function useCatalogSearch(nodes: SkillNode[]): CatalogSearchModel {
  const [query, setQuery] = useState("");
  const filtered = filterCatalogNodes(nodes, query);
  return {
    query,
    filtered,
    groups: groupInventory(filtered),
    status: catalogMatchStatus(query, filtered.length, nodes.length),
    onQuery: setQuery,
    onKeyDown: (event) => clearCatalogQuery(event, query, setQuery),
  };
}

function clearCatalogQuery(
  event: KeyboardEvent<HTMLInputElement>,
  query: string,
  setQuery: (query: string) => void,
): void {
  if (!catalogQueryClears(event.key, query)) {
    return;
  }
  event.preventDefault();
  setQuery("");
}
