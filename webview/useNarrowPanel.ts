import { useEffect, useState } from "react";

/** Matches the webview layout breakpoint in high-contrast.css. */
const NARROW_WIDTH = 720;

export function useNarrowPanel(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_WIDTH);
  useEffect(() => {
    const onResize = (): void => {
      setNarrow(window.innerWidth < NARROW_WIDTH);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return narrow;
}
