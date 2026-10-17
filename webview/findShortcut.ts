export interface FindShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isFindShortcut(event: FindShortcutEvent): boolean {
  const findKey = event.key === "f" || event.key === "F";
  const command = event.metaKey || event.ctrlKey;
  return findKey && command && !event.altKey && !event.shiftKey;
}
